import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import sgMail from '@sendgrid/mail';

if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

function generatePin(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function buildCredentialsEmail(params: {
    familyMemberName: string;
    patientName: string;
    email: string;
    pin: string;
    hqName: string;
}): string {
    const { familyMemberName, patientName, email, pin, hqName } = params;
    return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:Arial,sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:#FFFFFF;border-radius:12px;overflow:hidden;border:1px solid #E2E8F0;">
    <div style="background:#1E293B;padding:24px 32px;">
      <div style="color:#1D9E75;font-size:22px;font-weight:900;letter-spacing:2px;">ZÉNDITY</div>
      <div style="color:#94A3B8;font-size:12px;margin-top:4px;">${hqName} — Portal Familiar</div>
    </div>
    <div style="padding:32px;">
      <h2 style="margin:0 0 8px;color:#1E293B;font-size:18px;">Acceso al Portal Familiar</h2>
      <p style="color:#64748B;font-size:14px;margin:0 0 24px;line-height:1.6;">
        Hola <strong>${familyMemberName}</strong>,<br><br>
        <strong>${hqName}</strong> le ha habilitado acceso inmediato al portal familiar de Zéndity,
        donde podrá mantenerse al tanto del cuidado de <strong>${patientName}</strong>.
      </p>
      <div style="background:#F1F5F9;border-left:4px solid #1D9E75;border-radius:0 8px 8px 0;padding:20px 24px;margin-bottom:24px;">
        <h3 style="margin:0 0 12px;color:#0F172A;font-size:15px;">Sus credenciales de acceso:</h3>
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="color:#64748B;font-size:13px;padding:6px 0;width:100px;"><strong>Portal:</strong></td>
            <td style="font-size:13px;padding:6px 0;">
              <a href="https://app.zendity.com/family" style="color:#0284C7;text-decoration:none;font-weight:700;">app.zendity.com/family</a>
            </td>
          </tr>
          <tr>
            <td style="color:#64748B;font-size:13px;padding:6px 0;"><strong>Email:</strong></td>
            <td style="font-size:13px;padding:6px 0;color:#0F172A;">${email}</td>
          </tr>
          <tr>
            <td style="color:#64748B;font-size:13px;padding:6px 0;"><strong>PIN:</strong></td>
            <td style="padding:6px 0;">
              <span style="background:#1E293B;color:#1D9E75;padding:4px 14px;border-radius:6px;font-family:monospace;font-size:20px;font-weight:900;letter-spacing:4px;">${pin}</span>
            </td>
          </tr>
        </table>
      </div>
      <div style="background:#FFF7ED;border:1px solid #FED7AA;border-radius:8px;padding:14px 18px;margin-bottom:24px;">
        <p style="margin:0;color:#92400E;font-size:13px;">
          ⚠️ <strong>Recomendamos cambiar tu PIN después del primer acceso</strong> desde la configuración del portal.
        </p>
      </div>
      <div style="text-align:center;margin:24px 0;">
        <a href="https://app.zendity.com/family"
           style="background:#1D9E75;color:#FFFFFF;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">
          Entrar al portal familiar
        </a>
      </div>
      <p style="color:#94A3B8;font-size:12px;text-align:center;margin:0;">
        Si tiene problemas para acceder, comuníquese con ${hqName} directamente.
      </p>
    </div>
    <div style="background:#F8FAFC;padding:16px 32px;text-align:center;border-top:1px solid #E2E8F0;">
      <p style="margin:0;color:#94A3B8;font-size:12px;">${hqName} — Zéndity Healthcare Management Platform</p>
    </div>
  </div>
</body>
</html>`;
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

        // Modo A — Resend: { familyMemberId }
        if (body.familyMemberId) {
            familyMember = await prisma.familyMember.findFirst({
                where: { id: body.familyMemberId, headquartersId: hqId },
                include: { patient: { select: { name: true } } },
            });
            if (!familyMember) {
                return NextResponse.json({ error: 'Familiar no encontrado' }, { status: 404 });
            }
        }
        // Modo B — Crear + invitar: { patientId, name, email, accessLevel }
        else if (body.patientId && body.name && body.email) {
            const { patientId, name, email, accessLevel } = body;

            const patient = await prisma.patient.findFirst({
                where: { id: patientId, headquartersId: hqId },
                select: { id: true, name: true },
            });
            if (!patient) return NextResponse.json({ error: 'Residente no encontrado' }, { status: 404 });

            const existing = await prisma.familyMember.findUnique({ where: { email } });
            if (existing) {
                return NextResponse.json({ error: 'Ya existe un familiar con ese email' }, { status: 409 });
            }

            const level = accessLevel === 'Read-Only' ? 'Read-Only' : 'Full';

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
        } else {
            return NextResponse.json({ error: 'familyMemberId o (patientId, name, email) requerido' }, { status: 400 });
        }

        if (!familyMember.email) {
            return NextResponse.json({ error: 'El familiar no tiene email registrado' }, { status: 400 });
        }

        const hq = await prisma.headquarters.findUnique({
            where: { id: hqId },
            select: { name: true, logoUrl: true }
        });
        const hqName = hq?.name || 'Zéndity';

        // Generar PIN automático de 6 dígitos y activar la cuenta
        const pin = generatePin();
        await prisma.familyMember.update({
            where: { id: familyMember.id },
            data: {
                passcode: pin,
                isRegistered: true,
                inviteToken: null,
                inviteExpiry: null,
            }
        });

        const html = buildCredentialsEmail({
            familyMemberName: familyMember.name,
            patientName: familyMember.patient?.name || 'su ser querido',
            email: familyMember.email,
            pin,
            hqName,
        });

        if (process.env.SENDGRID_API_KEY) {
            await sgMail.send({
                to: familyMember.email,
                from: { email: process.env.SENDGRID_FROM_EMAIL || 'notificaciones@zendity.com', name: `${hqName} via Zéndity` },
                subject: `Sus credenciales del portal familiar — ${hqName}`,
                html
            });
        }

        return NextResponse.json({ success: true, message: 'Credenciales enviadas al familiar' });

    } catch (error) {
        console.error('Invite error:', error);
        return NextResponse.json({ error: 'Error enviando invitación' }, { status: 500 });
    }
}
