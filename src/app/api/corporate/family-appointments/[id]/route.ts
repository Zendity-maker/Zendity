import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { astDateTime, parseTimeOfDay } from '@/lib/dates';
import { EventType } from '@prisma/client';
import sgMail from '@sendgrid/mail';

if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

const ALLOWED_ROLES = ['DIRECTOR', 'ADMIN', 'SUPERVISOR', 'NURSE'];

const TYPE_LABELS: Record<string, string> = {
    VISIT:            'Visita Presencial',
    VIDEO_CALL:       'Videollamada',
    PHONE_CALL:       'Llamada Telefónica',
    DIRECTOR_MEETING: 'Reunión con Director',
    SPECIAL_OCCASION: 'Ocasión Especial',
};

// Mapeo de FamilyAppointment.type (string) → EventType (enum del calendario).
// Las llamadas usan tipos dedicados para que el calendario las pinte distinto
// de las visitas presenciales (ver corporate/calendar/page.tsx eventPropGetter).
// DIRECTOR_MEETING y SPECIAL_OCCASION son eventos presenciales en la sede,
// por lo que se mantienen como FAMILY_VISIT.
function mapToEventType(apptType: string): EventType {
    switch (apptType) {
        case 'VIDEO_CALL':       return EventType.FAMILY_VIDEO_CALL;
        case 'PHONE_CALL':       return EventType.FAMILY_PHONE_CALL;
        case 'VISIT':
        case 'DIRECTOR_MEETING':
        case 'SPECIAL_OCCASION':
        default:                 return EventType.FAMILY_VISIT;
    }
}

// Fallback de remitente — el resto del codebase (family/invite, zendi/moments, etc.)
// usa este mismo hardcoded. Sin él, si SENDGRID_FROM_EMAIL no está en Vercel env,
// el SDK recibe `from: undefined`, tira local, lo agarra el try/catch silente y
// el correo nunca llega a SendGrid. Tenía que pasar en algún momento. Ahora no.
const SENDER_FALLBACK_EMAIL = 'notificaciones@zendity.com';
function senderFrom(hqName: string) {
    return {
        email: process.env.SENDGRID_FROM_EMAIL || SENDER_FALLBACK_EMAIL,
        name: hqName,  // la familia ve "Vivid Senior Living" como remitente
    };
}

// Logging enriquecido — el catch antes solo imprimía `emailErr.message`, que para
// SendGrid es opaco. Lo que importa al diagnosticar es `response.body` (que dice
// "Sender Identity not verified", "Maximum credits exceeded", etc.) más el code
// y el to. Esto es lo que ocultó el bug 6 rondas; no volver a esconderlo.
function logEmailError(stage: 'APPROVE' | 'REJECT', to: string, err: unknown) {
    const e = err as { code?: string | number; message?: string; response?: { body?: unknown } };
    console.error(
        `[family-appointments PATCH ${stage}] Email error:`,
        'to=' + to,
        'code=' + (e?.code ?? 'n/a'),
        'message=' + (e?.message ?? 'n/a'),
        'sg_body=' + JSON.stringify(e?.response?.body ?? null),
    );
}

// PATCH — aprobar o rechazar una cita
export async function PATCH(
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
            select: { name: true },
        });
        const hqName = hq?.name || 'Vivid Senior Living';

        const typeLabel    = TYPE_LABELS[appt.type] || appt.type;
        const formattedDate = new Date(appt.requestedDate).toLocaleDateString('es-PR', {
            weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
        });

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

            // Tipo del evento alineado al canal: visita / videollamada / llamada.
            const eventType = mapToEventType(appt.type);

            // ATÓMICO: la cita pasa a APPROVED Y el evento se crea en la misma transacción.
            // Si el create del evento falla, el update se revierte y la cita queda PENDING
            // — evitando el estado fantasma "APPROVED sin evento" del bug original.
            const [updated] = await prisma.$transaction([
                prisma.familyAppointment.update({
                    where: { id },
                    data: { status: 'APPROVED', approvedById: staffId, approvedAt: new Date() },
                }),
                prisma.headquartersEvent.create({
                    data: {
                        headquartersId:   hqId,
                        title:            `${typeLabel} — ${appt.familyMember.name} con ${appt.patient.name}`,
                        description:      appt.description || undefined,
                        type:             eventType,
                        status:           'PENDING',
                        startTime,
                        endTime,
                        patientId:        appt.patientId,
                        targetPopulation: 'SPECIFIC',
                        targetPatients:   [appt.patientId],
                    },
                }),
            ]);

            // Notificación in-app al familiar (best-effort)
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
                            title:   '✅ Cita aprobada',
                            message: `Tu ${typeLabel} del ${formattedDate} a las ${appt.requestedTime} fue aprobada. Te esperamos en ${hqName}.`,
                            isRead:  false,
                            link:    '/family/calendar',
                        },
                    });
                }
            } catch { /* no-fatal */ }

            // Email al familiar — gate explícito y NO silencioso:
            //   - si falta el email del familiar (datos sucios) → console.warn explícito
            //   - si falta la API key (config) → console.warn explícito
            //   - si se intenta y falla → console.error enriquecido con response.body
            if (!appt.familyMember.email) {
                console.warn(
                    '[family-appointments PATCH APPROVE] email skip:',
                    'FamilyMember', appt.familyMemberId, 'sin email — datos sucios',
                );
            } else if (!process.env.SENDGRID_API_KEY) {
                console.warn(
                    '[family-appointments PATCH APPROVE] email skip:',
                    'SENDGRID_API_KEY no configurado en este entorno',
                );
            } else {
                try {
                    await sgMail.send({
                        to:      appt.familyMember.email,
                        from:    senderFrom(hqName),
                        subject: `✅ Cita aprobada — ${typeLabel} el ${formattedDate}`,
                        html: `
<div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:560px;margin:0 auto;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
  <div style="background:#0d9488;padding:28px 24px;text-align:center;">
    <p style="color:rgba(255,255,255,.8);margin:0;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;">${hqName}</p>
    <h2 style="color:#ffffff;margin:8px 0 0;font-size:22px;font-weight:800;">✅ Cita Aprobada</h2>
  </div>
  <div style="padding:32px;background:#ffffff;color:#334155;font-size:15px;line-height:1.7;">
    <p style="margin:0 0 20px;">Estimado/a <strong>${appt.familyMember.name}</strong>,</p>
    <p>Su solicitud de <strong>${typeLabel}</strong> ha sido aprobada.</p>
    <div style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:12px;padding:20px;margin:20px 0;">
      <div style="margin-bottom:8px;"><span style="color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase;">Tipo</span><br/><strong>${typeLabel}</strong></div>
      <div style="margin-bottom:8px;"><span style="color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase;">Fecha</span><br/><strong>${formattedDate}</strong></div>
      <div style="margin-bottom:8px;"><span style="color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase;">Hora</span><br/><strong>${appt.requestedTime}</strong></div>
      <div style="margin-bottom:8px;"><span style="color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase;">Duración</span><br/><strong>${appt.durationMins} minutos</strong></div>
      <div><span style="color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase;">Residente</span><br/><strong>${appt.patient.name}</strong></div>
    </div>
    ${appt.description ? `<p style="background:#f8fafc;padding:12px 16px;border-radius:10px;font-size:14px;color:#475569;margin:0 0 20px;"><em>${appt.description}</em></p>` : ''}
    <div style="margin-top:24px;text-align:center;">
      <a href="${process.env.NEXTAUTH_URL || 'https://app.zendity.com'}/family/calendar"
         style="display:inline-block;background:#0d9488;color:#ffffff;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;">
        Ver en el portal →
      </a>
    </div>
    <p style="margin:24px 0 0;color:#475569;">Te esperamos. ¡Hasta pronto!</p>
    <p style="margin:4px 0 0;color:#94a3b8;font-size:13px;">— Equipo de ${hqName}</p>
  </div>
  <div style="background:#f8fafc;padding:16px;text-align:center;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;">
    <p style="margin:0;font-weight:700;text-transform:uppercase;letter-spacing:.1em;">Zéndity OS</p>
  </div>
</div>`,
                    });
                } catch (emailErr) {
                    logEmailError('APPROVE', appt.familyMember.email, emailErr);
                }
            }

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
                logEmailError('REJECT', appt.familyMember.email, emailErr);
            }
        }

        return NextResponse.json({ success: true, appointment: updated });

    } catch (e) {
        console.error('[corporate/family-appointments PATCH]', e);
        return NextResponse.json({ success: false, error: 'Error al procesar la cita' }, { status: 500 });
    }
}
