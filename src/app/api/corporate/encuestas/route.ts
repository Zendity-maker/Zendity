import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { requireRole } from '@/lib/api-auth';
import { resolveEffectiveHqId } from '@/lib/hq-resolver';
import { prepararEnvio, satisfaccion, periodoActual } from '@/lib/encuesta-familia';
import sgMail from '@sendgrid/mail';

/**
 * GET  /api/corporate/encuestas   → satisfaccion del trimestre
 * POST /api/corporate/encuestas   → envia la encuesta del trimestre a la sede
 *
 * Trimestral y por sede, como pidio Andres. El indice unico
 * (familyMemberId, periodo) hace el envio idempotente: pulsar dos veces no
 * manda dos encuestas a la misma familia.
 */
export const dynamic = 'force-dynamic';

const ROLES = ['DIRECTOR', 'ADMIN', 'SUPER_ADMIN', 'COORDINATOR'];

export async function GET(req: Request) {
    try {
        const auth = await requireRole(ROLES);
        if (auth instanceof NextResponse) return auth;
        const session = await getServerSession(authOptions);
        const hqId = await resolveEffectiveHqId(session!, new URL(req.url).searchParams.get('hqId'));
        return NextResponse.json({ success: true, satisfaccion: await satisfaccion(hqId) });
    } catch (e: any) {
        console.error('[encuestas GET]', e);
        return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const auth = await requireRole(ROLES);
        if (auth instanceof NextResponse) return auth;
        const session = await getServerSession(authOptions);
        const body = await req.json().catch(() => ({}));
        const hqId = await resolveEffectiveHqId(session!, body.hqId ?? null);

        const r = await prepararEnvio(hqId, body.periodo || periodoActual());

        // Se preparan primero y se mandan despues, a proposito: si el correo
        // falla, la invitacion ya existe y el enlace sigue siendo valido.
        const base = process.env.NEXTAUTH_URL || 'https://app.zendity.com';
        // Remitente desde la variable de entorno, nunca hardcodeado (CLAUDE.md).
        const remitente = process.env.SENDGRID_FROM_EMAIL;
        if (process.env.SENDGRID_API_KEY) sgMail.setApiKey(process.env.SENDGRID_API_KEY);
        let enviados = 0, fallidos = 0;

        for (const inv of r.invitaciones) {
            const enlace = `${base}/encuesta/${inv.token}`;
            try {
                if (!process.env.SENDGRID_API_KEY || !remitente) throw new Error('SendGrid no configurado');
                await sgMail.send({
                    to: inv.email,
                    from: remitente,
                    subject: '¿Cómo lo estamos haciendo?',
                    // Sin PHI: ni diagnosticos ni datos clinicos. Solo la
                    // invitacion y el enlace.
                    html: `<p>Hola ${inv.nombre},</p>
<p>Nos gustaría saber cómo vemos las cosas desde su lado. Son tres preguntas y toma menos de un minuto.</p>
<p style="margin:24px 0;"><a href="${enlace}" style="background:#0F6E56;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;">Responder la encuesta</a></p>
<p style="color:#64748b;font-size:14px;">O copie este enlace: ${enlace}</p>
<p style="color:#64748b;font-size:14px;">Su respuesta llega identificada a la dirección del hogar, para poder darle seguimiento si hace falta.</p>`,
                });
                enviados++;
            } catch {
                fallidos++;
            }
        }

        return NextResponse.json({
            success: true,
            periodo: r.periodo,
            preparadas: r.creadas,
            yaExistian: r.yaExistian,
            sinCorreo: r.sinCorreo,
            enviados,
            fallidos,
        });
    } catch (e: any) {
        console.error('[encuestas POST]', e);
        return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 });
    }
}
