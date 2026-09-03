import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { marcaSede, correoDeSede } from '@/lib/marca-sede';
import { requireRole } from '@/lib/api-auth';
import { resolveEffectiveHqId } from '@/lib/hq-resolver';
import { prepararEnvio, satisfaccion, periodoActual, respuestas, pendientesDeResponder } from '@/lib/encuesta-familia';
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
        // ?vista=respuestas trae las respuestas una por una. Va aparte del
        // resumen porque el panel no debe llenarse de texto: se consulta cuando
        // se abre la pestaña.
        if (new URL(req.url).searchParams.get('vista') === 'respuestas') {
            return NextResponse.json({ success: true, respuestas: await respuestas(hqId) });
        }
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
        // El nombre del hogar en el remitente: la familia abre con mas
        // confianza un correo de su hogar que uno de un proveedor.
        const marca = await marcaSede(hqId);
        if (process.env.SENDGRID_API_KEY) sgMail.setApiKey(process.env.SENDGRID_API_KEY);
        let enviados = 0, fallidos = 0;

        for (const inv of r.invitaciones) {
            const enlace = `${base}/encuesta/${inv.token}`;
            try {
                if (!process.env.SENDGRID_API_KEY || !remitente) throw new Error('SendGrid no configurado');
                await sgMail.send({
                    to: inv.email,
                    from: { email: remitente!, name: marca.nombre },
                    subject: '¿Cómo lo estamos haciendo?',
                    // Sin PHI: ni diagnosticos ni datos clinicos. Solo la
                    // invitacion y el enlace.
                    // Mismo encabezado y pie que el resto: el hogar al frente.
                    html: correoDeSede(marca, `<p>Hola ${inv.nombre},</p>
<p>Nos gustaría saber cómo vemos las cosas desde su lado. Son tres preguntas y toma menos de un minuto.</p>
<p style="margin:24px 0;"><a href="${enlace}" style="background:${marca.primary};color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block;">Responder la encuesta</a></p>
<p style="color:#64748b;font-size:14px;">O copie este enlace: ${enlace}</p>
<p style="color:#64748b;font-size:14px;">Su respuesta llega identificada a la dirección del hogar, para poder darle seguimiento.</p>`),
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


/**
 * PUT /api/corporate/encuestas — recordatorio a quien NO ha respondido.
 *
 * Distinto del POST a proposito. El POST crea invitaciones nuevas y salta a
 * cualquiera que ya tenga fila del periodo, haya contestado o no: por eso
 * "Enviar a quien falte" en realidad significa "a quien falte por RECIBIRLA".
 * A los que la recibieron y no la contestaron no les llegaba nada nunca.
 *
 * Este reenvia el MISMO enlace —el token no cambia, asi que el correo viejo
 * sigue sirviendo— solo a quien tiene respondedAt en null.
 */
export async function PUT(req: Request) {
    try {
        const auth = await requireRole(ROLES);
        if (auth instanceof NextResponse) return auth;
        const session = await getServerSession(authOptions);
        const body = await req.json().catch(() => ({}));
        const hqId = await resolveEffectiveHqId(session!, body.hqId ?? null);
        const periodo = body.periodo || periodoActual();

        const pendientes = await pendientesDeResponder(hqId, periodo);
        const base = process.env.NEXTAUTH_URL || 'https://app.zendity.com';
        const remitente = process.env.SENDGRID_FROM_EMAIL;
        // El nombre del hogar en el remitente: la familia abre con mas
        // confianza un correo de su hogar que uno de un proveedor.
        const marca = await marcaSede(hqId);

        let enviados = 0, sinCorreo = 0, fallaron = 0;
        for (const p of pendientes) {
            const email = p.familyMember.email;
            if (!email || !email.includes('@')) { sinCorreo++; continue; }
            const enlace = `${base}/encuesta/${p.token}`;
            try {
                if (!process.env.SENDGRID_API_KEY || !remitente) throw new Error('SendGrid no configurado');
                await sgMail.send({
                    to: email,
                    from: { email: remitente!, name: marca.nombre },
                    subject: `¿Cómo lo estamos haciendo? — un minuto sobre ${p.familyMember.patient.name.trim()}`,
                    html: `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:0 auto;color:#12211D;">
<p style="font-size:16px;line-height:1.6;">Hola ${p.familyMember.name.trim()},</p>
<p style="font-size:16px;line-height:1.6;">Le enviamos hace unos días tres preguntas cortas sobre el cuidado de
<strong>${p.familyMember.patient.name.trim()}</strong>. Si no ha tenido oportunidad, aquí está el enlace de nuevo —
toma menos de un minuto y nos ayuda de verdad.</p>
<p style="margin:24px 0;"><a href="${enlace}" style="background:#0F6E56;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;">Responder la encuesta</a></p>
<p style="font-size:13px;color:#66766F;line-height:1.6;">Si ya la contestó, ignore este mensaje. Es el mismo enlace de antes.</p>
</div>`,
                });
                enviados++;
            } catch (e) {
                console.error('[encuestas PUT] fallo enviando a', email, e);
                fallaron++;
            }
        }

        return NextResponse.json({
            success: true,
            pendientes: pendientes.length,
            enviados, sinCorreo, fallaron,
        });
    } catch (e: any) {
        console.error('[encuestas PUT]', e);
        return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 });
    }
}
