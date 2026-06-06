import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import sgMail from '@sendgrid/mail';
import crypto from 'crypto';

if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

const INVITE_TTL_DAYS = 7;
const PORTAL_BASE = process.env.NEXTAUTH_URL || 'https://app.zendity.com';

/**
 * Token criptográficamente seguro (64 chars hex). Mismo diseño que bf7d58a
 * (7-abr-2026), antes del giro a PIN-plaintext de 102f09f.
 */
function generateInviteToken(): string {
    return crypto.randomBytes(32).toString('hex');
}

interface InviteEmailParams {
    variant: 'nuevo' | 'reset';
    familyMemberName: string;
    patientName: string;
    hqName: string;
    inviteUrl: string;
    expiryDate: Date;
}

/**
 * Email único con dos variantes:
 *  - 'nuevo' : primera invitación al portal.
 *  - 'reset' : restablecer PIN. ⚠️ Aclara explícitamente que el PIN VIEJO
 *              SIGUE FUNCIONANDO hasta que el familiar cree uno nuevo —
 *              el login no usa `isRegistered` ni borramos `passcode` al
 *              emitir el reset, así que es zero-downtime real.
 *
 * Sin PIN en el body. La credencial se construye via /family/register?token=...
 */
function buildInviteLinkEmail(params: InviteEmailParams): { subject: string; html: string } {
    const { variant, familyMemberName, patientName, hqName, inviteUrl, expiryDate } = params;
    const isReset = variant === 'reset';
    const expiryStr = expiryDate.toLocaleDateString('es-PR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Puerto_Rico' });

    const subject = isReset
        ? `Restablece tu PIN — ${hqName}`
        : `Bienvenido al portal familiar — ${hqName}`;

    const intro = isReset
        ? `<p style="color:#64748B;font-size:14px;margin:0 0 16px;line-height:1.6;">Hola <strong>${familyMemberName}</strong>,<br><br>Recibimos una solicitud para restablecer tu PIN del portal familiar de <strong>${patientName}</strong> en <strong>${hqName}</strong>.</p>
           <div style="background:#ECFDF5;border:1px solid #6EE7B7;border-radius:8px;padding:14px 18px;margin-bottom:24px;">
               <p style="margin:0;color:#065F46;font-size:13px;line-height:1.5;">
                   ✓ <strong>Tu PIN actual sigue funcionando</strong> hasta que crees uno nuevo. Si recibiste este correo por error, ignóralo y todo seguirá igual.
               </p>
           </div>`
        : `<p style="color:#64748B;font-size:14px;margin:0 0 24px;line-height:1.6;">Hola <strong>${familyMemberName}</strong>,<br><br><strong>${hqName}</strong> te invita al portal familiar de Zéndity, donde podrás mantenerte al tanto del cuidado de <strong>${patientName}</strong>.</p>`;

    const ctaLabel = isReset ? 'Crear PIN nuevo' : 'Crear mi PIN';

    const html = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:Arial,sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:#FFFFFF;border-radius:12px;overflow:hidden;border:1px solid #E2E8F0;">
    <div style="background:#1E293B;padding:24px 32px;">
      <div style="color:#1D9E75;font-size:22px;font-weight:900;letter-spacing:2px;">ZÉNDITY</div>
      <div style="color:#94A3B8;font-size:12px;margin-top:4px;">${hqName} — Portal Familiar</div>
    </div>
    <div style="padding:32px;">
      <h2 style="margin:0 0 8px;color:#1E293B;font-size:18px;">${isReset ? 'Restablecer tu PIN' : 'Acceso al Portal Familiar'}</h2>
      ${intro}
      <div style="text-align:center;margin:24px 0;">
        <a href="${inviteUrl}"
           style="background:#1D9E75;color:#FFFFFF;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">
          ${ctaLabel}
        </a>
      </div>
      <p style="color:#64748B;font-size:13px;margin:8px 0 0;line-height:1.6;">
        Este enlace es personal y expira el <strong>${expiryStr}</strong>. Solo es válido un uso — al crear tu PIN, el enlace se desactiva.
      </p>
      <p style="color:#94A3B8;font-size:12px;margin:18px 0 0;line-height:1.5;">
        ¿El botón no funciona? Copia este enlace en tu navegador:<br>
        <span style="word-break:break-all;color:#64748B;">${inviteUrl}</span>
      </p>
      <p style="color:#94A3B8;font-size:12px;text-align:center;margin:24px 0 0;">
        Si tienes problemas para acceder, comunícate con ${hqName} directamente.
      </p>
    </div>
    <div style="background:#F8FAFC;padding:16px 32px;text-align:center;border-top:1px solid #E2E8F0;">
      <p style="margin:0;color:#94A3B8;font-size:12px;">${hqName} — Zéndity Healthcare Management Platform</p>
    </div>
  </div>
</body>
</html>`;

    return { subject, html };
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !['DIRECTOR', 'ADMIN', 'SUPERVISOR'].includes((session.user as any).role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const hqId = (session.user as any).headquartersId;

        let familyMember: any = null;
        let variant: 'nuevo' | 'reset' = 'nuevo';

        // Modo A — Resend / Reset: { familyMemberId }
        // Usamos isRegistered del familyMember como discriminador del copy del email.
        if (body.familyMemberId) {
            familyMember = await prisma.familyMember.findFirst({
                where: { id: body.familyMemberId, headquartersId: hqId },
                include: { patient: { select: { name: true } } },
            });
            if (!familyMember) {
                return NextResponse.json({ error: 'Familiar no encontrado' }, { status: 404 });
            }
            variant = familyMember.isRegistered ? 'reset' : 'nuevo';
        }
        // Modo B — Crear + invitar: { patientId, name, email, accessLevel }
        else if (body.patientId && body.name && body.email) {
            const { patientId, name, email, accessLevel } = body;

            const patient = await prisma.patient.findFirst({
                where: { id: patientId, headquartersId: hqId },
                select: { id: true, name: true },
            });
            if (!patient) return NextResponse.json({ error: 'Residente no encontrado' }, { status: 404 });

            const existing = await prisma.familyMember.findUnique({
                where: { email },
                include: { patient: { select: { name: true, headquartersId: true } } },
            });
            if (existing) {
                if (existing.patientId !== patientId) {
                    const sameHq = existing.patient?.headquartersId === hqId;
                    return NextResponse.json({
                        error: sameHq
                            ? `Este email ya está asociado al familiar "${existing.name}" del residente ${existing.patient?.name || 'otro'}. Usa otro email o gestiona desde la ficha de ese residente.`
                            : `Este email ya está usado por otro hogar. Usa un email distinto.`,
                        existingFamilyMemberId: sameHq ? existing.id : undefined,
                        existingPatientId: sameHq ? existing.patientId : undefined,
                        existingPatientName: sameHq ? (existing.patient?.name ?? null) : undefined,
                        existingFamilyMemberName: sameHq ? existing.name : undefined,
                    }, { status: 409 });
                }
                return NextResponse.json({
                    error: existing.isRegistered
                        ? `Ya hay un familiar registrado con ese email ("${existing.name}"). Si olvidó su PIN, usa "Reenviar invitación" para enviar un enlace de reset.`
                        : `Hay una invitación pendiente para ese email ("${existing.name}"). Usa "Reenviar invitación" para mandar un enlace nuevo.`,
                    existingFamilyMemberId: existing.id,
                    existingFamilyMemberName: existing.name,
                    canResend: true,
                }, { status: 409 });
            }

            const level = accessLevel === 'Read-Only' ? 'Read-Only' : 'Full';

            // Modo B: INSERT con isRegistered=false + passcode null.
            // El token+expiry se setean en el UPDATE de abajo (común a ambos modos).
            familyMember = await prisma.familyMember.create({
                data: {
                    headquartersId: hqId,
                    patientId,
                    name,
                    email,
                    accessLevel: level,
                    isRegistered: false,
                },
                include: { patient: { select: { name: true } } },
            });
            variant = 'nuevo';
        } else {
            return NextResponse.json({ error: 'familyMemberId o (patientId, name, email) requerido' }, { status: 400 });
        }

        if (!familyMember.email) {
            return NextResponse.json({ error: 'El familiar no tiene email registrado' }, { status: 400 });
        }

        const hq = await prisma.headquarters.findUnique({
            where: { id: hqId },
            select: { name: true },
        });
        const hqName = hq?.name || 'Zéndity';

        // INVARIANTE crítica: NO se toca passcode ni isRegistered.
        // Si era reset (familyMember.isRegistered=true), el familiar sigue entrando
        // con su PIN viejo en otra ventana hasta que abra el link y complete el
        // activate. Zero-downtime real.
        const token = generateInviteToken();
        const expiry = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
        await prisma.familyMember.update({
            where: { id: familyMember.id },
            data: { inviteToken: token, inviteExpiry: expiry },
        });

        const inviteUrl = `${PORTAL_BASE}/family/register?token=${token}`;

        const { subject, html } = buildInviteLinkEmail({
            variant,
            familyMemberName: familyMember.name,
            patientName: familyMember.patient?.name?.trim() || 'su ser querido',
            hqName,
            inviteUrl,
            expiryDate: expiry,
        });

        if (process.env.SENDGRID_API_KEY) {
            await sgMail.send({
                to: familyMember.email,
                from: { email: process.env.SENDGRID_FROM_EMAIL || 'notificaciones@zendity.com', name: `${hqName} via Zéndity` },
                subject,
                html,
            });
        }

        return NextResponse.json({
            success: true,
            message: variant === 'reset'
                ? 'Enlace de reset enviado al email del familiar'
                : 'Enlace de invitación enviado al email del familiar',
            variant,
        });
    } catch (error) {
        console.error('Family invite error:', error);
        return NextResponse.json({ error: 'Error enviando invitación' }, { status: 500 });
    }
}
