/**
 * family-invite-link.ts — emisión del enlace de invitación familiar.
 *
 * Helper compartido por los dos endpoints que onboardean familiares:
 *   - /api/corporate/family/invite           (admin de la ficha del residente)
 *   - /api/corporate/patients/[id]/family    (wizard de admisión)
 *
 * Política de seguridad:
 *   - El token es crypto.randomBytes(32).hex (256 bits).
 *   - TTL 7 días, uso único (activate lo anula al consumir).
 *   - Cero PIN en el email. La credencial se construye en /family/register.
 *
 * INVARIANTE: este helper NO toca passcode ni isRegistered del familyMember.
 * El reset es zero-downtime — el PIN viejo sigue funcionando hasta que el
 * familiar complete activate. El caller decide cómo crear/encontrar el FM.
 */
import { prisma } from '@/lib/prisma';
import sgMail from '@sendgrid/mail';
import crypto from 'crypto';

if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

export const INVITE_TTL_DAYS = 7;
// Strip trailing slash para evitar "//family/register" si alguien setea
// NEXTAUTH_URL con "/" al final. Fallback como defensa.
export const PORTAL_BASE = (process.env.NEXTAUTH_URL || 'https://app.zendity.com').replace(/\/+$/, '');

export type InviteVariant = 'nuevo' | 'reset';

export interface IssueLinkResult {
    success: boolean;
    inviteUrl?: string;
    expiry?: Date;
    emailSent?: boolean;
    emailError?: string;
    variant?: InviteVariant;
    error?: string;
}

/**
 * Emite un token de invitación para un familyMember EXISTENTE y envía el email.
 *
 *   - Espera que el caller ya haya creado/encontrado el familyMember.
 *   - Resuelve hqName + patientName desde la BD.
 *   - UPDATE de inviteToken + inviteExpiry — NUNCA toca passcode ni isRegistered.
 *   - Si SendGrid falla, devuelve emailSent=false + emailError; el UPDATE de
 *     token persiste igual (el director puede reintentar sin regenerar el FM).
 */
export async function issueFamilyInviteLink(
    familyMemberId: string,
    variant: InviteVariant
): Promise<IssueLinkResult> {
    const fm = await prisma.familyMember.findUnique({
        where: { id: familyMemberId },
        include: { patient: { select: { name: true } } },
    });
    if (!fm) return { success: false, error: 'familyMember no encontrado' };
    if (!fm.email) return { success: false, error: 'familyMember sin email' };

    const hq = await prisma.headquarters.findUnique({
        where: { id: fm.headquartersId },
        select: { name: true },
    });
    const hqName = hq?.name || 'Zéndity';

    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

    // INVARIANTE crítica: NO se toca passcode ni isRegistered.
    await prisma.familyMember.update({
        where: { id: fm.id },
        data: { inviteToken: token, inviteExpiry: expiry },
    });

    const inviteUrl = `${PORTAL_BASE}/family/register?token=${token}`;

    const { subject, html } = buildInviteLinkEmail({
        variant,
        familyMemberName: fm.name,
        patientName: fm.patient?.name?.trim() || 'su ser querido',
        hqName,
        inviteUrl,
        expiryDate: expiry,
    });

    let emailSent = false;
    let emailError: string | undefined;

    if (process.env.SENDGRID_API_KEY) {
        try {
            await sgMail.send({
                to: fm.email,
                from: { email: process.env.SENDGRID_FROM_EMAIL || 'notificaciones@zendity.com', name: `${hqName} via Zéndity` },
                subject,
                html,
            });
            emailSent = true;
        } catch (e: any) {
            emailError = e.response?.body ? JSON.stringify(e.response.body).slice(0, 300) : (e.message || 'sgMail error');
        }
    } else {
        emailError = 'SENDGRID_API_KEY no configurado';
    }

    return { success: true, inviteUrl, expiry, emailSent, emailError, variant };
}

export interface InviteEmailParams {
    variant: InviteVariant;
    familyMemberName: string;
    patientName: string;
    hqName: string;
    inviteUrl: string;
    expiryDate: Date;
}

/**
 * Email único con dos variantes:
 *  - 'nuevo' : primera invitación al portal. Tono de bienvenida.
 *  - 'reset' : restablecer PIN. ⚠️ Aclara explícitamente que el PIN VIEJO
 *              SIGUE FUNCIONANDO hasta que el familiar cree uno nuevo.
 *
 * Sin PIN en el body. La credencial se construye via /family/register?token=...
 */
export function buildInviteLinkEmail(params: InviteEmailParams): { subject: string; html: string } {
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
