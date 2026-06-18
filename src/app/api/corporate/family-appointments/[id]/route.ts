import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { astDateTime, parseTimeOfDay, formatASTDateLong } from '@/lib/dates';
import { withPhiAccessLog } from '@/lib/phi-audit';
import sgMail from '@sendgrid/mail';
import {
    TYPE_LABELS,
    senderFrom,
    logEmailError,
    buildApprovedAppointmentEventData,
    sendApprovedAppointmentNotifications,
} from '@/lib/family/appointment-effects';

// Sprint Coordinador (jun-2026): COORDINATOR puede aprobar/rechazar TODAS
// las citas familiares (cambio de criterio vs Q2 del sprint inicial donde
// aprobar quedó en DIR/ADMIN). Refactor a requireRole con secondaryRoles
// queda como deuda anotada — este fix es quirúrgico; Wanda es COORDINATOR
// primario puro, no toca el path dual-rol.
const ALLOWED_ROLES = ['DIRECTOR', 'ADMIN', 'SUPERVISOR', 'NURSE', 'COORDINATOR'];

// Tag de log del REJECT — formato EXACTO preservado del PATCH original
// (`[family-appointments PATCH REJECT]`). El APPROVE ya no se loguea desde
// aquí; vive dentro del helper sendApprovedAppointmentNotifications con su
// propio tag idéntico al original.
const REJECT_LOG_TAG = '[family-appointments PATCH REJECT]';

// PHI audit (Pilar 1) — Sprint Coordinador (jun-2026): cierra gap del PATCH
// que modificaba FamilyAppointment ligada a patientId + familyMemberId sin
// auditoría. getPatientId hace lookup al DB con el id del param para que la
// fila quede con patientId NOT NULL, consistente con los demás endpoints
// wrapped en el sprint. Acción default WRITE (cubre APPROVE y REJECT).
export const PATCH = withPhiAccessLog(patchHandler, {
    resourceType: 'FamilyAppointment',
    getPatientId: async ({ params }) => {
        const { id } = await params;
        const appt = await prisma.familyAppointment.findUnique({
            where: { id },
            select: { patientId: true },
        });
        return appt?.patientId ?? undefined;
    },
});

// PATCH — aprobar o rechazar una cita
async function patchHandler(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const session = await getServerSession(authOptions);
        if (!session || !ALLOWED_ROLES.includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }

        const staffId = (session.user as any).id;
        const hqId    = (session.user as any).headquartersId;
        const { action, rejectedReason } = await req.json();

        if (!['APPROVE', 'REJECT'].includes(action)) {
            return NextResponse.json({ success: false, error: 'Acción inválida' }, { status: 400 });
        }

        const appt = await prisma.familyAppointment.findUnique({
            where: { id },
            include: {
                patient:      { select: { name: true, headquartersId: true } },
                familyMember: { select: { name: true, email: true } },
            },
        });

        if (!appt) return NextResponse.json({ success: false, error: 'Cita no encontrada' }, { status: 404 });
        if (appt.patient.headquartersId !== hqId) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 403 });
        }
        if (appt.status !== 'PENDING') {
            return NextResponse.json({ success: false, error: 'Esta cita ya fue procesada' }, { status: 409 });
        }

        const hq = await prisma.headquarters.findUnique({
            where: { id: hqId },
            select: { name: true, billingAddress: true, familyWhatsAppNumber: true },
        });
        const hqName = hq?.name || 'Vivid Senior Living';
        const hqAddress = hq?.billingAddress ?? null;
        const hqWhatsApp = hq?.familyWhatsAppNumber ?? null;

        const typeLabel    = TYPE_LABELS[appt.type] || appt.type;
        // Fecha formateada anclada a AST — la familia vive fuera de PR; con
        // toLocaleDateString sin timeZone, el servidor (UTC) o el cliente del email
        // podrían interpretar la fecha en otra zona.
        const formattedDate = formatASTDateLong(appt.requestedDate);

        // ── APROBAR ────────────────────────────────────────────────────────────
        if (action === 'APPROVE') {
            // Construir startTime / endTime anclados a AST (no al reloj UTC del servidor).
            // requestedDate viene como medianoche AST → UTC; requestedTime es hora de pared AST.
            let startTime: Date;
            let endTime: Date;
            try {
                const { hour, minute } = parseTimeOfDay(appt.requestedTime);
                startTime = astDateTime(appt.requestedDate, hour, minute);
                endTime = new Date(startTime.getTime() + appt.durationMins * 60_000);
            } catch (err) {
                console.error('[family-appointments PATCH] Hora inválida:', err);
                return NextResponse.json(
                    { success: false, error: `Hora inválida en la solicitud: "${appt.requestedTime}"` },
                    { status: 400 }
                );
            }

            // ATÓMICO: la cita pasa a APPROVED Y el evento se crea en la misma transacción.
            // Si el create del evento falla, el update se revierte y la cita queda PENDING
            // — evitando el estado fantasma "APPROVED sin evento" del bug original.
            // El builder es PURO; el invariante atómico se preserva con el $transaction local.
            const [updated] = await prisma.$transaction([
                prisma.familyAppointment.update({
                    where: { id },
                    data: { status: 'APPROVED', approvedById: staffId, approvedAt: new Date() },
                }),
                prisma.headquartersEvent.create({
                    data: buildApprovedAppointmentEventData({
                        apptType:         appt.type,
                        hqId,
                        patientId:        appt.patientId,
                        patientName:      appt.patient.name,
                        familyMemberName: appt.familyMember.name,
                        description:      appt.description,
                        startTime,
                        endTime,
                    }),
                }),
            ]);

            // Side-effects post-DB — notif in-app + ICS + email con SendGrid.
            // Best-effort: el helper NUNCA propaga error. Si SendGrid está
            // sin créditos o falla, queda en logs (logEmailError) y la cita
            // aprobada permanece. Mismos gates que tenía inline.
            await sendApprovedAppointmentNotifications({
                stage:             'APPROVE_PATCH',
                appointmentId:     updated.id,
                apptType:          appt.type,
                requestedDate:     appt.requestedDate,
                requestedTime:     appt.requestedTime,
                durationMins:      appt.durationMins,
                description:       appt.description,
                patientName:       appt.patient.name,
                familyMemberId:    appt.familyMemberId,
                familyMemberName:  appt.familyMember.name,
                familyMemberEmail: appt.familyMember.email,
                hqName,
                hqAddress,
                hqWhatsApp,
                startTime,
                endTime,
            });

            return NextResponse.json({ success: true, appointment: updated });
        }

        // ── RECHAZAR ───────────────────────────────────────────────────────────
        const reason = rejectedReason?.trim() || 'Tu solicitud no pudo ser aprobada. Por favor contáctanos para reagendar.';

        const updated = await prisma.familyAppointment.update({
            where: { id },
            data: { status: 'REJECTED', rejectedReason: reason, approvedById: staffId, approvedAt: new Date() },
        });

        // Notificación in-app (best-effort)
        try {
            const famUser = await prisma.user.findFirst({
                where: { email: appt.familyMember.email },
                select: { id: true },
            });
            if (famUser) {
                await prisma.notification.create({
                    data: {
                        userId:  famUser.id,
                        type:    'FAMILY_VISIT',
                        title:   '❌ Solicitud no aprobada',
                        message: reason,
                        isRead:  false,
                        link:    '/family/calendar',
                    },
                });
            }
        } catch { /* no-fatal */ }

        // Email al familiar — mismo gate explícito que el bloque de aprobación.
        // (REJECT se mantiene inline por ahora — el helper compartido es
        // específicamente para APPROVE, único bloque que se reusa en POST-create-APPROVED.)
        if (!appt.familyMember.email) {
            console.warn(
                '[family-appointments PATCH REJECT] email skip:',
                'FamilyMember', appt.familyMemberId, 'sin email — datos sucios',
            );
        } else if (!process.env.SENDGRID_API_KEY) {
            console.warn(
                '[family-appointments PATCH REJECT] email skip:',
                'SENDGRID_API_KEY no configurado en este entorno',
            );
        } else {
            try {
                await sgMail.send({
                    to:      appt.familyMember.email,
                    from:    senderFrom(hqName),
                    subject: `❌ Solicitud de cita — ${typeLabel} el ${formattedDate}`,
                    html: `
<div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:560px;margin:0 auto;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
  <div style="background:#64748b;padding:28px 24px;text-align:center;">
    <p style="color:rgba(255,255,255,.8);margin:0;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;">${hqName}</p>
    <h2 style="color:#ffffff;margin:8px 0 0;font-size:22px;font-weight:800;">Solicitud No Aprobada</h2>
  </div>
  <div style="padding:32px;background:#ffffff;color:#334155;font-size:15px;line-height:1.7;">
    <p style="margin:0 0 20px;">Estimado/a <strong>${appt.familyMember.name}</strong>,</p>
    <p>Lamentamos informarle que su solicitud de <strong>${typeLabel}</strong> para el <strong>${formattedDate}</strong> no ha podido ser aprobada en esta ocasión.</p>
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:16px 20px;margin:20px 0;">
      <p style="margin:0;color:#7f1d1d;font-size:14px;">${reason}</p>
    </div>
    <p style="color:#475569;">Por favor comuníquese con nosotros a través del portal o llámenos directamente para coordinar una nueva fecha.</p>
    <div style="margin-top:20px;text-align:center;">
      <a href="${process.env.NEXTAUTH_URL || 'https://app.zendity.com'}/family/calendar"
         style="display:inline-block;background:#0d9488;color:#ffffff;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;">
        Ir al portal →
      </a>
    </div>
    <p style="margin:24px 0 0;color:#64748b;font-size:13px;">— Equipo de ${hqName}</p>
  </div>
  <div style="background:#f8fafc;padding:16px;text-align:center;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;">
    <p style="margin:0;font-weight:700;text-transform:uppercase;letter-spacing:.1em;">Zéndity OS</p>
  </div>
</div>`,
                });
            } catch (emailErr) {
                logEmailError(REJECT_LOG_TAG, appt.familyMember.email, emailErr);
            }
        }

        return NextResponse.json({ success: true, appointment: updated });

    } catch (e) {
        console.error('[corporate/family-appointments PATCH]', e);
        return NextResponse.json({ success: false, error: 'Error al procesar la cita' }, { status: 500 });
    }
}
