/**
 * EL ENVÍO DE LOS REPORTES SEMANALES
 * ──────────────────────────────────
 * Uno solo para los tres —enfermería, supervisión y dirección— porque lo que
 * cambia entre ellos es QUÉ se calcula y A QUIÉN va, no cómo se manda.
 *
 * TRES REGLAS QUE APLICAN A LOS TRES:
 *
 *   · LOS NOMBRES VAN EN EL PDF, NUNCA EN EL CUERPO. Es la regla del proyecto:
 *     un correo no lleva diagnósticos ni datos clínicos identificables. El
 *     cuerpo dice cuántos y de qué tipo; el adjunto dice quiénes.
 *
 *   · LOS DESTINATARIOS MIRAN ROLES SECUNDARIOS. En Cupey nadie tiene NURSE
 *     como rol primario —esa cuenta está desactivada— y quien hace enfermería
 *     es una DIRECTOR con NURSE secundario. Un envío por rol primario no
 *     llegaría a la persona que hace el trabajo.
 *
 *   · SI NO HAY NADA, NO SE ENVÍA. Un correo semanal que llega diciendo "cero"
 *     se convierte en un correo que no se abre, y el día que traiga algo
 *     tampoco se abrirá.
 */
import sgMail from '@sendgrid/mail';
import { prisma } from '@/lib/prisma';
import type { Role } from '@prisma/client';
import { logPhiAccess } from '@/lib/phi-audit';
import type { ReporteSemanal } from '@/lib/reporte-enfermeria';
import { generarReporteSemanalPDF } from '@/lib/reporte-enfermeria-pdf';

if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

export interface ResultadoEnvio {
    sede: string;
    enviado?: number;
    pendiente?: number;
    saltada?: string;
}

export async function enviarReporte(
    reporte: ReporteSemanal,
    roles: Role[],
    opciones: { rutaCron: string; recurso: string; entrada: string },
): Promise<ResultadoEnvio> {
    const { sedeNombre: sede } = reporte;

    if (reporte.residentesActivos === 0) return { sede, saltada: 'sin residentes activos' };
    if (reporte.totalPendiente === 0) return { sede, saltada: 'nada pendiente' };

    const destinatarios = await prisma.user.findMany({
        where: {
            headquartersId: reporte.sedeId, isActive: true, isDeleted: false,
            OR: [{ role: { in: roles } }, { secondaryRoles: { hasSome: roles } }],
        },
        select: { email: true },
    });
    const emails = [...new Set(
        destinatarios.map(d => d.email).filter((e): e is string => !!e && e.includes('@')),
    )];
    if (emails.length === 0) return { sede, saltada: 'sin destinatarios' };

    const remitente = process.env.SENDGRID_FROM_EMAIL;
    if (!process.env.SENDGRID_API_KEY || !remitente) {
        return { sede, saltada: 'SendGrid no configurado', pendiente: reporte.totalPendiente };
    }

    const pdf = generarReporteSemanalPDF(reporte);
    const hoy = new Date().toLocaleDateString('es-PR', { day: '2-digit', month: 'long', timeZone: 'America/Puerto_Rico' });

    // Solo titulares y números. Ningún nombre.
    const filas = reporte.bloques
        .filter(b => b.numero <= 3 && b.total > 0)
        .map(b => `<tr><td style="padding:6px 0;font-size:14px;color:#12211D;">${b.titulo}</td>`
            + `<td style="padding:6px 0;font-size:14px;font-weight:800;color:#12211D;text-align:right;">${b.total}</td></tr>`)
        .join('');
    const resuelto = reporte.bloques.find(b => b.numero === 5 || b.numero === 4);

    await sgMail.send({
        to: emails,
        from: remitente,
        isMultiple: true,
        subject: `${reporte.titulo.replace('Reporte semanal de ', '')} — ${sede} — ${reporte.totalPendiente} ${reporte.totalPendiente === 1 ? 'cosa' : 'cosas'} (${hoy})`,
        html: `<meta charset="utf-8"><div style="background:#ffffff;color:#12211D;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;line-height:1.65;padding:28px;max-width:560px;margin:0 auto;">
<p style="margin:0 0 6px;font-size:18px;font-weight:800;">${reporte.titulo}</p>
<p style="margin:0 0 20px;font-size:14px;color:#66766F;">${sede} · ${reporte.residentesActivos} residentes activos</p>
<table style="width:100%;border-collapse:collapse;margin:0 0 18px;">${filas}</table>
<div style="background:#F1F7F4;border-left:4px solid #0F6E56;padding:14px 16px;margin:0 0 18px;">
<p style="margin:0;font-size:14px;"><strong>El detalle y los nombres van en el PDF adjunto.</strong> Ordenado de lo más urgente a lo menos.</p>
</div>
${resuelto && resuelto.total > 0
    ? `<p style="margin:0 0 18px;font-size:14px;">Esta semana quedó registrado trabajo en <strong>${resuelto.lineas.length}</strong> frentes. El detalle, al final del adjunto.</p>`
    : ''}
<p style="margin:0 0 18px;font-size:14px;color:#66766F;">Todo esto se calcula contra el expediente cada lunes. Nada se marca a mano como hecho: cada línea desaparece sola cuando el trabajo se registra.</p>
<p style="margin:0;font-size:13px;color:#66766F;">Se entra por <strong>${opciones.entrada}</strong> en app.zendity.com.</p>
</div>`,
        attachments: [{
            content: Buffer.from(pdf).toString('base64'),
            filename: `${opciones.recurso.toLowerCase()}-${sede.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.pdf`,
            type: 'application/pdf',
            disposition: 'attachment',
        }],
    });

    // El adjunto lleva nombres: es una divulgación de PHI fuera del sistema.
    logPhiAccess({
        action: 'DISCLOSURE',
        resourceType: opciones.recurso,
        hqId: reporte.sedeId,
        userId: null,
        routePath: opciones.rutaCron,
        context: {
            destinatarios: emails.length,
            pendiente: reporte.totalPendiente,
            residentes: reporte.residentesActivos,
            automatico: true,
        },
    });

    return { sede, enviado: emails.length, pendiente: reporte.totalPendiente };
}

/** La puerta del cron. Idéntica en los tres. */
export function verificarCron(req: Request): Response | null {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
        return Response.json({ error: 'CRON_SECRET no configurado' }, { status: 500 });
    }
    if (req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
        return Response.json({ error: 'Firma CRON inválida' }, { status: 401 });
    }
    return null;
}
