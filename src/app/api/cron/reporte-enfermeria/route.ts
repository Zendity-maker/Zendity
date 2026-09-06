/**
 * REPORTE SEMANAL DE ENFERMERÍA — lunes 8:30 AM AST ("30 12 * * 1" en UTC).
 *
 * POR QUÉ EXISTE. Enfermería tiene su lista de trabajo en /care/enfermeria, y
 * esa pantalla es una foto de AHORA: dice qué hay pendiente, no qué lleva tres
 * semanas pendiente ni qué se resolvió. Y hay que entrar a mirarla — quien no
 * sabe que hay algo pendiente no entra a comprobarlo. Es la misma razón por la
 * que 16 planes de cuido completos pasaron 106 días sin firmar y dos
 * observaciones de personal 56 y 45 días paradas.
 *
 * El correo llega solo. Nadie tiene que acordarse.
 *
 * LOS NOMBRES VAN EN EL PDF, NUNCA EN EL CUERPO. Es la regla del proyecto: un
 * correo no lleva diagnósticos ni datos clínicos identificables. El cuerpo dice
 * cuántos y de qué tipo; el adjunto dice quiénes. Mismo reparto que el paquete
 * de continuidad, que va por este mismo camino los lunes a las 6.
 *
 * A QUIÉN. Enfermería y dirección de cada sede activa, mirando también los
 * roles SECUNDARIOS: en Cupey nadie tiene NURSE como rol primario —la única
 * cuenta con ese rol está desactivada— y quien hace enfermería es una DIRECTOR
 * con NURSE secundario. Un envío que mire solo el rol primario no llegaría a la
 * persona que hace el trabajo.
 *
 * SI NO HAY NADA, NO SE ENVÍA. Un correo semanal que llega diciendo "cero" se
 * convierte en un correo que no se abre, y el día que traiga algo tampoco se
 * abrirá. Se envía cuando hay deuda que atender.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { Role } from '@prisma/client';
import sgMail from '@sendgrid/mail';
import { construirReporte } from '@/lib/reporte-enfermeria';
import { generarReporteEnfermeriaPDF } from '@/lib/reporte-enfermeria-pdf';
import { logPhiAccess } from '@/lib/phi-audit';

export const dynamic = 'force-dynamic';

/** Quien hace o supervisa enfermería. Primario o secundario. */
const ROLES: Role[] = ['NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN'];

export async function GET(req: Request) {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
        return NextResponse.json({ error: 'CRON_SECRET no configurado' }, { status: 500 });
    }
    if (req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Firma CRON inválida' }, { status: 401 });
    }

    try {
        const sedes = await prisma.headquarters.findMany({
            where: { isActive: true },
            select: { id: true, name: true },
        });
        const remitente = process.env.SENDGRID_FROM_EMAIL;
        const resultados: Record<string, unknown>[] = [];

        for (const sede of sedes) {
            const reporte = await construirReporte(sede.id, sede.name);

            if (reporte.residentesActivos === 0) {
                resultados.push({ sede: sede.name, saltada: 'sin residentes activos' });
                continue;
            }
            if (reporte.totalPendiente === 0) {
                resultados.push({ sede: sede.name, saltada: 'nada pendiente', residentes: reporte.residentesActivos });
                continue;
            }

            const destinatarios = await prisma.user.findMany({
                where: {
                    headquartersId: sede.id, isActive: true, isDeleted: false,
                    // Roles secundarios incluidos: ver el comentario de cabecera.
                    OR: [
                        { role: { in: ROLES } },
                        { secondaryRoles: { hasSome: ROLES } },
                    ],
                },
                select: { email: true },
            });
            const emails = [...new Set(destinatarios.map(d => d.email).filter((e): e is string => !!e && e.includes('@')))];
            if (emails.length === 0) {
                resultados.push({ sede: sede.name, saltada: 'sin destinatarios' });
                continue;
            }

            if (!process.env.SENDGRID_API_KEY || !remitente) {
                resultados.push({ sede: sede.name, saltada: 'SendGrid no configurado', pendiente: reporte.totalPendiente });
                continue;
            }
            sgMail.setApiKey(process.env.SENDGRID_API_KEY);

            const pdf = generarReporteEnfermeriaPDF(reporte);
            const hoy = new Date().toLocaleDateString('es-PR', { day: '2-digit', month: 'long', timeZone: 'America/Puerto_Rico' });

            // El cuerpo lleva CUÁNTOS y de qué tipo. Nunca quiénes.
            const filas = reporte.bloques
                .filter(b => b.numero <= 3 && b.total > 0)
                .map(b => `<tr><td style="padding:6px 0;font-size:14px;color:#12211D;">${b.titulo}</td>`
                    + `<td style="padding:6px 0;font-size:14px;font-weight:800;color:#12211D;text-align:right;">${b.total}</td></tr>`)
                .join('');
            const resuelto = reporte.bloques.find(b => b.numero === 4);

            await sgMail.send({
                to: emails,
                from: remitente,
                isMultiple: true,
                subject: `Enfermería — ${sede.name} — ${reporte.totalPendiente} cosas esperando (${hoy})`,
                html: `<meta charset="utf-8"><div style="background:#ffffff;color:#12211D;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;line-height:1.65;padding:28px;max-width:560px;margin:0 auto;">
<p style="margin:0 0 6px;font-size:18px;font-weight:800;">Reporte semanal de enfermería</p>
<p style="margin:0 0 20px;font-size:14px;color:#66766F;">${sede.name} · ${reporte.residentesActivos} residentes activos</p>
<table style="width:100%;border-collapse:collapse;margin:0 0 18px;">${filas}</table>
<div style="background:#F1F7F4;border-left:4px solid #0F6E56;padding:14px 16px;margin:0 0 18px;">
<p style="margin:0;font-size:14px;"><strong>Los nombres van en el PDF adjunto.</strong> Ordenado de lo más urgente a lo menos: primero lo que lleva días esperando, después lo que se salió de norma, y al final lo que se resolvió esta semana.</p>
</div>
${resuelto && resuelto.total > 0
    ? `<p style="margin:0 0 18px;font-size:14px;color:#12211D;">Esta semana se resolvieron <strong>${resuelto.total}</strong> cosas. El detalle está en el bloque 4 del adjunto.</p>`
    : ''}
<p style="margin:0 0 18px;font-size:14px;color:#66766F;">Todo esto se calcula contra el expediente cada lunes. Nada se marca a mano como hecho: cada línea desaparece sola cuando el trabajo se registra.</p>
<p style="margin:0;font-size:13px;color:#66766F;">Se entra por <strong>Enfermería</strong> en app.zendity.com.</p>
</div>`,
                attachments: [{
                    content: Buffer.from(pdf).toString('base64'),
                    filename: `enfermeria-${sede.name.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.pdf`,
                    type: 'application/pdf',
                    disposition: 'attachment',
                }],
            });

            // El adjunto lleva nombres de residentes: es una divulgación de PHI
            // fuera del sistema y queda registrada como tal.
            logPhiAccess({
                action: 'DISCLOSURE',
                resourceType: 'ReporteEnfermeria',
                hqId: sede.id,
                userId: null,
                routePath: '/api/cron/reporte-enfermeria',
                context: {
                    destinatarios: emails.length,
                    pendiente: reporte.totalPendiente,
                    residentes: reporte.residentesActivos,
                    automatico: true,
                },
            });

            resultados.push({ sede: sede.name, enviado: emails.length, pendiente: reporte.totalPendiente });
        }

        return NextResponse.json({ success: true, sedes: resultados });
    } catch (e) {
        console.error('[cron/reporte-enfermeria]', e);
        return NextResponse.json({ success: false, error: (e as Error).message }, { status: 500 });
    }
}
