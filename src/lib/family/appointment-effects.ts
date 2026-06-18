/**
 * appointment-effects — efectos compartidos de FamilyAppointment APROBADA.
 *
 * Sprint Coordinador (jun-2026, paso 2A): se extraen aquí los efectos del
 * PATCH-approve para que el POST-create-APPROVED (paso 2B, Wanda crea cita
 * staff-side que nace APPROVED) los reuse SIN duplicar.
 *
 * Reglas:
 *  - buildApprovedAppointmentEventData es PURO (sin DB). El caller lo usa
 *    dentro de su propio prisma.$transaction para preservar la atomicidad
 *    (cita ↔ evento), invariante que vive en el handler, no aquí.
 *  - sendApprovedAppointmentNotifications es best-effort: notif + ICS + email
 *    nunca propagan error al caller. Si todo falla, la cita aprobada queda.
 *  - El gateo del email (skip si falta familyMember.email o SENDGRID_API_KEY)
 *    se preserva idéntico al que estaba inline en el PATCH original.
 *  - El logTag de cada stage se hardcodea para preservar EXACTAMENTE el
 *    formato de log que tenía el PATCH (búsqueda en Vercel logs no rompe).
 */

import { EventType, Prisma } from '@prisma/client';
import sgMail from '@sendgrid/mail';
import { prisma } from '@/lib/prisma';
import { astDateTime, parseTimeOfDay, formatASTDateLong, AST_TZ_LABEL } from '@/lib/dates';
import { buildAppointmentICS, googleCalendarLink } from '@/lib/ics';
import { buildAppointmentCopy } from '@/lib/family/appointment-copy';

// Init SendGrid una vez por proceso, igual que hacía el PATCH al cargar el módulo.
if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

// ── Tipos / mappings compartidos ───────────────────────────────────────────

export const TYPE_LABELS: Record<string, string> = {
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
export function mapToEventType(apptType: string): EventType {
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
// el correo nunca llega a SendGrid.
const SENDER_FALLBACK_EMAIL = 'notificaciones@zendity.com';
export function senderFrom(hqName: string) {
    return {
        email: process.env.SENDGRID_FROM_EMAIL || SENDER_FALLBACK_EMAIL,
        name: hqName,
    };
}

// Logging enriquecido — el catch antes solo imprimía `emailErr.message`, que para
// SendGrid es opaco. Lo que importa al diagnosticar es `response.body` (que dice
// "Sender Identity not verified", "Maximum credits exceeded", etc.) más el code
// y el to. Esto es lo que ocultó el bug 6 rondas; no volver a esconderlo.
//
// logTag permite que el caller controle el prefijo de log para preservar
// formato exacto entre call-sites (PATCH-approve, PATCH-reject, POST-create).
export function logEmailError(logTag: string, to: string, err: unknown) {
    const e = err as { code?: string | number; message?: string; response?: { body?: unknown } };
    console.error(
        `${logTag} Email error:`,
        'to=' + to,
        'code=' + (e?.code ?? 'n/a'),
        'message=' + (e?.message ?? 'n/a'),
        'sg_body=' + JSON.stringify(e?.response?.body ?? null),
    );
}

// ── Builder PURO del data del HeadquartersEvent (sin DB) ───────────────────

export interface BuildApprovedEventDataArgs {
    apptType:         string;
    hqId:             string;
    patientId:        string;
    patientName:      string;
    familyMemberName: string;
    description?:     string | null;
    startTime:        Date;
    endTime:          Date;
}

/**
 * Construye el data del prisma.headquartersEvent.create para una cita APROBADA.
 * Determinístico, sin side-effects. El caller debe envolverlo en su propio
 * $transaction junto al update/create de FamilyAppointment para mantener
 * atomicidad (si falla el create del evento, la cita queda en estado previo).
 *
 * Espejo EXACTO del bloque inline que tenía el PATCH-approve antes del refactor:
 * mismos campos, mismo formato de título, mismo mapping de tipo, mismo
 * targetPopulation/targetPatients para que el listener del calendario apunte
 * al paciente correcto.
 */
export function buildApprovedAppointmentEventData(
    args: BuildApprovedEventDataArgs
): Prisma.HeadquartersEventUncheckedCreateInput {
    const typeLabel = TYPE_LABELS[args.apptType] || args.apptType;
    return {
        headquartersId:   args.hqId,
        title:            `${typeLabel} — ${args.familyMemberName.trim()} con ${args.patientName.trim()}`,
        description:      args.description || undefined,
        type:             mapToEventType(args.apptType),
        status:           'PENDING',
        startTime:        args.startTime,
        endTime:          args.endTime,
        patientId:        args.patientId,
        targetPopulation: 'SPECIFIC',
        targetPatients:   [args.patientId],
    };
}

// ── Sub-helper del HTML del email (puro, devuelve payload listo) ───────────

export type EffectStage = 'APPROVE_PATCH' | 'CREATE_APPROVED';

// Tags hardcoded para preservar EXACTAMENTE el formato de log del PATCH
// original. Si se busca '[family-appointments PATCH APPROVE]' en Vercel logs
// el match sigue funcionando después del refactor.
const STAGE_LOG_TAG: Record<EffectStage, string> = {
    APPROVE_PATCH:   '[family-appointments PATCH APPROVE]',
    CREATE_APPROVED: '[family-appointments POST CREATE_APPROVED]',
};

export interface BuildApprovedEmailArgs {
    appointmentId:    string;
    apptType:         string;
    requestedTime:    string;          // "10:00 AM"
    durationMins:     number;
    description?:     string | null;
    patientName:      string;
    familyMemberName: string;
    formattedDate:    string;          // formatASTDateLong(requestedDate)
    hqName:           string;
    hqAddress?:       string | null;
    hqWhatsApp?:      string | null;
    startTime:        Date;
    endTime:          Date;
}

export interface ApprovedEmailPayload {
    subject:     string;
    html:        string;
    attachments: Array<{
        content:     string;
        filename:    string;
        type:        string;
        disposition: string;
    }>;
    gcalUrl:     string;
}

/**
 * Construye { subject, html, attachments, gcalUrl } para el email de cita
 * APROBADA. PURO — no manda nada. Espejo EXACTO del HTML que tenía el PATCH.
 */
export function buildApprovedAppointmentEmail(args: BuildApprovedEmailArgs): ApprovedEmailPayload {
    const typeLabel = TYPE_LABELS[args.apptType] || args.apptType;

    // Copy ramificada por tipo (WhatsApp vs presencial). Misma fuente para
    // notificación, email y descripción del ICS.
    const copy = buildAppointmentCopy({
        apptType:       args.apptType,
        hqName:         args.hqName,
        hqAddress:      args.hqAddress ?? null,
        whatsAppNumber: args.hqWhatsApp ?? null,
        description:    args.description ?? null,
    });

    const icsContent = buildAppointmentICS({
        id:             args.appointmentId,
        title:          `${typeLabel} con ${args.patientName.trim()}`,
        description:    copy.icsDescription,
        startUtc:       args.startTime,
        endUtc:         args.endTime,
        location:       copy.location,
        organizerName:  args.hqName,
        organizerEmail: process.env.SENDGRID_FROM_EMAIL || undefined,
    });
    const gcalUrl = googleCalendarLink({
        id:          args.appointmentId,
        title:       `${typeLabel} con ${args.patientName.trim()}`,
        description: copy.icsDescription,
        startUtc:    args.startTime,
        endUtc:      args.endTime,
        location:    copy.location,
    });

    const subject = `✅ Cita aprobada — ${typeLabel} el ${args.formattedDate}`;

    const html = `
<div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:560px;margin:0 auto;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
  <div style="background:#0d9488;padding:28px 24px;text-align:center;">
    <p style="color:rgba(255,255,255,.8);margin:0;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;">${args.hqName}</p>
    <h2 style="color:#ffffff;margin:8px 0 0;font-size:22px;font-weight:800;">✅ Cita Aprobada</h2>
  </div>
  <div style="padding:32px;background:#ffffff;color:#334155;font-size:15px;line-height:1.7;">
    <p style="margin:0 0 20px;">Estimado/a <strong>${args.familyMemberName}</strong>,</p>
    <p>Su solicitud de <strong>${typeLabel}</strong> ha sido aprobada.</p>
    <div style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:12px;padding:20px;margin:20px 0;">
      <div style="margin-bottom:8px;"><span style="color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase;">Tipo</span><br/><strong>${typeLabel}</strong></div>
      <div style="margin-bottom:8px;"><span style="color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase;">Fecha</span><br/><strong>${args.formattedDate}</strong></div>
      <div style="margin-bottom:8px;"><span style="color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase;">Hora</span><br/><strong>${args.requestedTime}</strong> <span style="color:#64748b;font-weight:500;font-size:13px;">(${AST_TZ_LABEL})</span></div>
      <div style="margin-bottom:8px;"><span style="color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase;">Duración</span><br/><strong>${args.durationMins} minutos</strong></div>
      <div><span style="color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase;">Residente</span><br/><strong>${args.patientName.trim()}</strong></div>
    </div>
    ${args.description ? `<p style="background:#f8fafc;padding:12px 16px;border-radius:10px;font-size:14px;color:#475569;margin:0 0 20px;"><em>${args.description}</em></p>` : ''}
    <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:12px;padding:14px 18px;margin:20px 0;">
      <p style="margin:0 0 4px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#0369a1;">
        Cómo conectar
      </p>
      <p style="margin:0;font-size:14px;color:#0c4a6e;line-height:1.55;">
        ${copy.connectionInstructions}
      </p>
    </div>
    <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:14px 18px;margin:20px 0;">
      <p style="margin:0;font-size:13px;color:#9a3412;line-height:1.5;">
        ⏰ <strong>La hora arriba es hora de Vivid (Puerto Rico, AST).</strong>
        Si vives en otra zona, abre el archivo <code>cita.ics</code> adjunto o usa el botón de Google Calendar abajo —
        tu calendario convertirá automáticamente a tu hora local.
      </p>
    </div>
    <div style="margin-top:24px;text-align:center;">
      <a href="${gcalUrl}"
         style="display:inline-block;background:#1a73e8;color:#ffffff;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;margin:0 4px 8px 0;">
        📅 Añadir a Google Calendar
      </a>
      <a href="${process.env.NEXTAUTH_URL || 'https://app.zendity.com'}/family/calendar"
         style="display:inline-block;background:#0d9488;color:#ffffff;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;margin:0 4px 8px 0;">
        Ver en el portal →
      </a>
    </div>
    <p style="margin:24px 0 0;color:#475569;">Te esperamos. ¡Hasta pronto!</p>
    <p style="margin:4px 0 0;color:#94a3b8;font-size:13px;">— Equipo de ${args.hqName}</p>
  </div>
  <div style="background:#f8fafc;padding:16px;text-align:center;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;">
    <p style="margin:0;font-weight:700;text-transform:uppercase;letter-spacing:.1em;">Zéndity OS</p>
  </div>
</div>`;

    const attachments = [
        {
            content:     Buffer.from(icsContent, 'utf8').toString('base64'),
            filename:    `cita-${args.appointmentId}.ics`,
            type:        'text/calendar; charset=utf-8; method=PUBLISH',
            disposition: 'attachment',
        },
    ];

    return { subject, html, attachments, gcalUrl };
}

// ── Side-effects orquestador (post-DB) ─────────────────────────────────────

export interface SendApprovedNotificationsArgs {
    stage:            EffectStage;
    appointmentId:    string;
    apptType:         string;
    requestedDate:    Date;
    requestedTime:    string;
    durationMins:     number;
    description?:     string | null;
    patientName:      string;
    familyMemberId:   string;
    familyMemberName: string;
    familyMemberEmail?: string | null;
    hqName:           string;
    hqAddress?:       string | null;
    hqWhatsApp?:      string | null;
    startTime:        Date;
    endTime:          Date;
}

/**
 * Efectos post-transacción de una cita APROBADA: notificación in-app +
 * email con ICS + Google Calendar link. Best-effort, never throws — si
 * cualquier sub-paso falla, la cita aprobada permanece como source of truth
 * y el fallo se loguea sin interrumpir al caller.
 *
 * Espejo EXACTO de los efectos que tenía inline el PATCH-approve original.
 */
export async function sendApprovedAppointmentNotifications(
    args: SendApprovedNotificationsArgs
): Promise<void> {
    const logTag    = STAGE_LOG_TAG[args.stage];
    const typeLabel = TYPE_LABELS[args.apptType] || args.apptType;
    const formattedDate = formatASTDateLong(args.requestedDate);

    // Copy de conexión — se necesita aquí para la notif in-app (mismo string
    // que va en el email a través del builder).
    const copy = buildAppointmentCopy({
        apptType:       args.apptType,
        hqName:         args.hqName,
        hqAddress:      args.hqAddress ?? null,
        whatsAppNumber: args.hqWhatsApp ?? null,
        description:    args.description ?? null,
    });

    // ── Notificación in-app al familiar (best-effort) ──────────────────────
    if (args.familyMemberEmail) {
        try {
            const famUser = await prisma.user.findFirst({
                where: { email: args.familyMemberEmail },
                select: { id: true },
            });
            if (famUser) {
                await prisma.notification.create({
                    data: {
                        userId:  famUser.id,
                        type:    'FAMILY_VISIT',
                        title:   '✅ Cita aprobada',
                        message: `Tu ${typeLabel} del ${formattedDate} a las ${args.requestedTime} (${AST_TZ_LABEL}) fue aprobada. ${copy.connectionInstructions}`,
                        isRead:  false,
                        link:    '/family/calendar',
                    },
                });
            }
        } catch { /* no-fatal */ }
    }

    // ── Email + ICS + GCal (best-effort, gateado) ──────────────────────────
    if (!args.familyMemberEmail) {
        console.warn(
            `${logTag} email skip:`,
            'FamilyMember', args.familyMemberId, 'sin email — datos sucios',
        );
        return;
    }
    if (!process.env.SENDGRID_API_KEY) {
        console.warn(
            `${logTag} email skip:`,
            'SENDGRID_API_KEY no configurado en este entorno',
        );
        return;
    }

    const payload = buildApprovedAppointmentEmail({
        appointmentId:    args.appointmentId,
        apptType:         args.apptType,
        requestedTime:    args.requestedTime,
        durationMins:     args.durationMins,
        description:      args.description,
        patientName:      args.patientName,
        familyMemberName: args.familyMemberName,
        formattedDate,
        hqName:           args.hqName,
        hqAddress:        args.hqAddress,
        hqWhatsApp:       args.hqWhatsApp,
        startTime:        args.startTime,
        endTime:          args.endTime,
    });

    try {
        await sgMail.send({
            to:          args.familyMemberEmail,
            from:        senderFrom(args.hqName),
            subject:     payload.subject,
            attachments: payload.attachments,
            html:        payload.html,
        });
    } catch (emailErr) {
        logEmailError(logTag, args.familyMemberEmail, emailErr);
    }
}
