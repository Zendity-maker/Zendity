import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import sgMail from '@sendgrid/mail';
import crypto from 'crypto';

if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !['DIRECTOR', 'ADMIN'].includes(session.user.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { familyMemberId } = await req.json();
        if (!familyMemberId) {
            return NextResponse.json({ error: 'familyMemberId requerido' }, { status: 400 });
        }

        const hqId = session.user.headquartersId;

        const familyMember = await prisma.familyMember.findFirst({
            where: { id: familyMemberId, headquartersId: hqId },
            include: { patient: { select: { name: true } } }
        });

        if (!familyMember) {
            return NextResponse.json({ error: 'Familiar no encontrado' }, { status: 404 });
        }

        if (!familyMember.email) {
            return NextResponse.json({ error: 'El familiar no tiene email registrado' }, { status: 400 });
        }

        const hq = await prisma.headquarters.findUnique({
            where: { id: hqId },
            select: { name: true, logoUrl: true }
        });

        const token = crypto.randomBytes(32).toString('hex');
        const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 días

        await prisma.familyMember.update({
            where: { id: familyMemberId },
            data: { inviteToken: token, inviteExpiry: expiry }
        });

        const portalUrl = `${process.env.NEXTAUTH_URL}/family-invite.html?token=${token}`;
        const hqName = hq?.name || 'Zéndity';

        const html = `
        <!DOCTYPE html>
        <html>
        <body style="margin:0;padding:0;background:#F8FAFC;font-family:Arial,sans-serif;">
            <div style="max-width:560px;margin:32px auto;background:#FFFFFF;border-radius:12px;overflow:hidden;border:1px solid #E2E8F0;">
                <div style="background:#1E293B;padding:24px 32px;">
                    <div style="color:#1D9E75;font-size:22px;font-weight:900;letter-spacing:2px;">ZÉNDITY</div>
                    <div style="color:#94A3B8;font-size:12px;margin-top:4px;">Healthcare Management Platform</div>
                </div>
                <div style="padding:32px;">
                    <h2 style="margin:0 0 8px;color:#1E293B;font-size:18px;">Acceso al Portal Familiar</h2>
                    <p style="color:#64748B;font-size:14px;margin:0 0 24px;">
                        Hola <strong>${familyMember.name}</strong>,<br><br>
                        <strong>${hqName}</strong> le ha habilitado acceso al portal familiar de Zéndity,
                        donde podrá mantenerse al tanto del cuidado de <strong>${familyMember.patient?.name || 'su ser querido'}</strong>.
                    </p>
                    <div style="background:#E1F5EE;border-radius:8px;padding:16px;margin-bottom:24px;border-left:4px solid #1D9E75;">
                        <p style="margin:0;color:#0F6E56;font-size:13px;">
                            Desde el portal podrá ver el estado diario de su familiar,
                            enviar mensajes al equipo de cuidado, y mantenerse conectado con el hogar.
                        </p>
                    </div>
                    <div style="text-align:center;margin:24px 0;">
                        <a href="${portalUrl}"
                           style="background:#1D9E75;color:#FFFFFF;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">
                            Activar mi acceso
                        </a>
                    </div>
                    <p style="color:#94A3B8;font-size:12px;text-align:center;margin:0;">
                        Este enlace es válido por 7 días. Si no solicitó este acceso, puede ignorar este mensaje.
                    </p>
                </div>
                <div style="background:#F8FAFC;padding:16px 32px;text-align:center;border-top:1px solid #E2E8F0;">
                    <p style="margin:0;color:#94A3B8;font-size:12px;">${hqName} — Zéndity Healthcare Management Platform</p>
                </div>
            </div>
        </body>
        </html>`;

        if (process.env.SENDGRID_API_KEY) {
            await sgMail.send({
                to: familyMember.email,
                from: { email: process.env.SENDGRID_FROM_EMAIL || 'notificaciones@zendity.com', name: `${hqName} via Zéndity` },
                subject: `Su acceso al portal familiar está listo — ${hqName}`,
                html
            });
        }

        return NextResponse.json({ success: true, message: 'Invitación enviada', expiresAt: expiry });

    } catch (error) {
        console.error('Invite error:', error);
        return NextResponse.json({ error: 'Error enviando invitación' }, { status: 500 });
    }
}
