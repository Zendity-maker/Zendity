import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCronSecret } from '@/lib/cron-auth';
import { notifyRoles } from '@/lib/notifications';
import { logError } from '@/lib/logger';
import sgMail from '@sendgrid/mail';

if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/check-licenses — diario, 8 AM AST (12 UTC).
 *
 * Avisa del vencimiento de licencia a 7, 3 y 1 día, y alerta a Zendity cuando
 * ya venció.
 *
 * NO SUSPENDE AUTOMÁTICAMENTE (cambiado 17-ago-2026). Antes hacía
 * `updateMany({ licenseActive: false })` sin avisar a nadie — solo un
 * console.log. Mientras nada respetaba `licenseActive` eso era inofensivo;
 * desde que el enforcement vive en requireSession/requireRole, ese mismo
 * cron apagaría un hogar entero a medianoche, en silencio, con residentes
 * dentro y sin que nadie hubiera entregado la Hoja de Continuidad.
 *
 * Cortar el servicio de un hogar tiene consecuencias clínicas: es una
 * decisión deliberada, no un efecto secundario de un cron. Al vencer, este
 * cron ALERTA a Zendity y la suspensión se ejecuta desde /admin → Sedes,
 * donde la hoja de continuidad se descarga en el mismo flujo.
 *
 * Auth: Bearer CRON_SECRET.
 */

const AVISOS = [7, 3, 1];

export async function GET(req: Request) {
    const denied = requireCronSecret(req);
    if (denied) return denied;

    try {
        const now = new Date();
        const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

        const activas = await prisma.headquarters.findMany({
            where: { isActive: true, licenseActive: true },
            select: { id: true, name: true, licenseExpiry: true, ownerEmail: true, ownerName: true },
        });

        const avisados: { hq: string; dias: number }[] = [];
        const vencidas: { hq: string; diasVencida: number }[] = [];

        for (const hq of activas) {
            if (!hq.licenseExpiry) continue;
            const exp = new Date(Date.UTC(
                hq.licenseExpiry.getUTCFullYear(), hq.licenseExpiry.getUTCMonth(), hq.licenseExpiry.getUTCDate()
            ));
            const dias = Math.round((exp.getTime() - startOfToday.getTime()) / 86400000);

            // ── Ya vencida → alerta a Zendity, sin apagar nada ──────────
            if (dias < 0) {
                vencidas.push({ hq: hq.name, diasVencida: -dias });
                const title = `Licencia vencida — ${hq.name}`;
                if (await yaNotificado(title, startOfToday)) continue;
                await notifySuperAdmins({
                    title,
                    message: `La licencia de ${hq.name} venció hace ${-dias} día(s) y el servicio sigue activo. Suspende desde /admin → Sedes (descarga primero la Hoja de Continuidad).`,
                });
                continue;
            }

            // ── Avisos previos: 7, 3 y 1 día ────────────────────────────
            if (!AVISOS.includes(dias)) continue;
            const title = `Tu licencia Zendity vence en ${dias} día${dias !== 1 ? 's' : ''}`;
            if (await yaNotificado(title, startOfToday, hq.id)) continue;

            const cuando = dias === 1 ? 'mañana' : `en ${dias} días`;
            await notifyRoles(hq.id, ['DIRECTOR', 'ADMIN'], {
                type: 'SHIFT_ALERT',
                title,
                message: `La licencia de ${hq.name} vence ${cuando}. Comunícate con Zendity para renovarla y evitar la interrupción del servicio.`,
                link: '/corporate',
            });

            // Email al titular: la campana puede no verse a tiempo y esto
            // tiene consecuencia operativa real.
            if (hq.ownerEmail && process.env.SENDGRID_API_KEY) {
                try {
                    await sgMail.send({
                        to: hq.ownerEmail,
                        from: process.env.SENDGRID_FROM_EMAIL || 'notificaciones@zendity.com',
                        subject: `Tu licencia Zendity vence ${cuando} — ${hq.name}`,
                        html: `<div style="font-family:system-ui,sans-serif;max-width:540px;margin:0 auto;padding:24px;">
                            <h2 style="color:#0F6E56;">Renovación de licencia</h2>
                            <p>Hola ${hq.ownerName || ''},</p>
                            <p>La licencia de <strong>${hq.name}</strong> vence <strong>${cuando}</strong>.</p>
                            <p style="background:#FEF3C7;border-left:4px solid #D97706;padding:12px 16px;border-radius:0 8px 8px 0;">
                                Si vence sin renovarse, el acceso al sistema se suspende y la operación
                                deberá continuar con documentación en papel.
                            </p>
                            <p>Comunícate con nosotros para renovarla.</p>
                            <p style="color:#64748b;font-size:13px;margin-top:32px;">— Zéndity</p>
                        </div>`,
                    });
                } catch { /* best-effort: el aviso in-app ya se creó */ }
            }

            // Zendity también se entera: es quien gestiona el cobro.
            await notifySuperAdmins({
                title: `Renovación próxima — ${hq.name}`,
                message: `La licencia de ${hq.name} vence ${cuando}. Gestiona la renovación desde /admin → Sedes.`,
            });

            avisados.push({ hq: hq.name, dias });
        }

        return NextResponse.json({
            success: true,
            revisadas: activas.length,
            avisados,
            vencidasSinSuspender: vencidas,
            nota: 'Este cron nunca suspende: alerta para que la suspensión sea una decisión deliberada desde /admin.',
        });
    } catch (error) {
        logError('cron.check-licenses', error);
        return NextResponse.json({ success: false, error: 'Error revisando licencias' }, { status: 500 });
    }
}

/** Dedup: el cron corre diario y no debe repetir el mismo aviso el mismo día. */
async function yaNotificado(title: string, since: Date, hqId?: string): Promise<boolean> {
    const n = await prisma.notification.count({
        where: {
            title,
            createdAt: { gte: since },
            ...(hqId ? { user: { headquartersId: hqId } } : {}),
        },
    });
    return n > 0;
}

async function notifySuperAdmins(payload: { title: string; message: string }) {
    const admins = await prisma.user.findMany({
        where: { role: 'SUPER_ADMIN', isActive: true, isDeleted: false },
        select: { id: true },
    });
    if (admins.length === 0) return;
    await prisma.notification.createMany({
        data: admins.map(a => ({
            userId: a.id,
            type: 'SHIFT_ALERT',
            title: payload.title,
            message: payload.message,
            link: '/admin',
            isRead: false,
        })),
    });
}
