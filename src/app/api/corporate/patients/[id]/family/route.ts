import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from '@/lib/prisma';
import sgMail from '@sendgrid/mail';

function generatePin(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
}



if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

// GET: Obtain the list of family members for a patient
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: patientId } = await params;
        const session = await getServerSession(authOptions);
        if (!session || !['ADMIN', 'DIRECTOR', 'NURSE'].includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: "No autorizado." }, { status: 401 });
        }

        const hqId = (session.user as any).headquartersId;

        const familyMembers = await prisma.familyMember.findMany({
            where: {
                patientId: patientId,
                headquartersId: hqId
            },
            orderBy: {
                name: 'asc'
            }
        });

        return NextResponse.json({ success: true, familyMembers });
    } catch (error) {
        console.error("Error fetching family members:", error);
        return NextResponse.json({ success: false, error: "Error al cargar familiares." }, { status: 500 });
    }
}

// POST: Register a new family member
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: patientId } = await params;
        const session = await getServerSession(authOptions);
        if (!session || !['ADMIN', 'DIRECTOR'].includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: "Privilegios insuficientes para asignar accesos." }, { status: 403 });
        }

        const hqId = (session.user as any).headquartersId;
        const {
            name, email, phone, accessLevel, relationship,
            // Sprint P — Admisión Unificada
            address, idCardUrl, isPrimary,
        } = await req.json();

        if (!name || !email) {
            return NextResponse.json({ success: false, error: "Debe proveer al menos Nombre y Email." }, { status: 400 });
        }

        // Check if email already exists globally (emails must be unique across the system for family members)
        const existingEmail = await prisma.familyMember.findUnique({
            where: { email: email }
        });

        // Si ya existe, actualizar (upsert-like) — útil desde el wizard de admisión
        if (existingEmail) {
            if (existingEmail.patientId !== patientId || existingEmail.headquartersId !== hqId) {
                return NextResponse.json({ success: false, error: "El email ingresado ya está asociado a otra cuenta." }, { status: 400 });
            }
            const updated = await prisma.familyMember.update({
                where: { id: existingEmail.id },
                data: {
                    name,
                    ...(phone !== undefined ? { phone: phone || null } : {}),
                    ...(accessLevel !== undefined ? { accessLevel: accessLevel || "Full" } : {}),
                    ...(relationship !== undefined ? { relationship: relationship || null } : {}),
                    ...(address !== undefined ? { address: address || null } : {}),
                    ...(idCardUrl !== undefined ? { idCardUrl: idCardUrl || null } : {}),
                    ...(isPrimary !== undefined ? { isPrimary: !!isPrimary } : {}),
                }
            });
            // Si se marca como primario, limpiar otros primarios del mismo paciente
            if (isPrimary === true) {
                await prisma.familyMember.updateMany({
                    where: { patientId, id: { not: updated.id }, isPrimary: true },
                    data: { isPrimary: false },
                });
                await prisma.patient.update({
                    where: { id: patientId },
                    data: { primaryFamilyMemberId: updated.id },
                });
            }
            return NextResponse.json({ success: true, familyMember: updated, updated: true });
        }

        // Generar PIN automático de 6 dígitos para acceso inmediato
        const pin = generatePin();

        const newFamilyMember = await prisma.familyMember.create({
            data: {
                patientId: patientId,
                headquartersId: hqId,
                name,
                email,
                phone: phone || null,
                passcode: pin,
                isRegistered: true,
                accessLevel: accessLevel || "Full",
                relationship: relationship || null,
                address: address || null,
                idCardUrl: idCardUrl || null,
                isPrimary: !!isPrimary,
            }
        });

        // Si es el primario, desmarcar otros + setear en Patient
        if (isPrimary === true) {
            await prisma.familyMember.updateMany({
                where: { patientId, id: { not: newFamilyMember.id }, isPrimary: true },
                data: { isPrimary: false },
            });
            await prisma.patient.update({
                where: { id: patientId },
                data: { primaryFamilyMemberId: newFamilyMember.id },
            });
        }

        // Email de bienvenida con credenciales — siempre se envía al crear familiar nuevo
        try {
            const [hq, patient] = await Promise.all([
                prisma.headquarters.findUnique({ where: { id: hqId }, select: { name: true, logoUrl: true } }),
                prisma.patient.findUnique({ where: { id: patientId }, select: { name: true } }),
            ]);
            const hqName = hq?.name || 'Zéndity';
            const patientName = patient?.name || 'su familiar';

            const html = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:Arial,sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:#FFFFFF;border-radius:12px;overflow:hidden;border:1px solid #E2E8F0;">
    <div style="background:#1E293B;padding:24px 32px;">
      <div style="color:#1D9E75;font-size:22px;font-weight:900;letter-spacing:2px;">ZÉNDITY</div>
      <div style="color:#94A3B8;font-size:12px;margin-top:4px;">${hqName} — Portal Familiar</div>
    </div>
    <div style="padding:32px;">
      <h2 style="margin:0 0 8px;color:#1E293B;font-size:18px;">Bienvenido/a al Portal Familiar</h2>
      <p style="color:#64748B;font-size:14px;margin:0 0 24px;line-height:1.6;">
        Hola <strong>${name}</strong>,<br><br>
        <strong>${hqName}</strong> le ha habilitado acceso al portal familiar de Zéndity,
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
    </div>
    <div style="background:#F8FAFC;padding:16px 32px;text-align:center;border-top:1px solid #E2E8F0;">
      <p style="margin:0;color:#94A3B8;font-size:12px;">${hqName} — Zéndity Healthcare Management Platform</p>
    </div>
  </div>
</body>
</html>`;

            if (process.env.SENDGRID_API_KEY) {
                await sgMail.send({
                    to: email,
                    from: process.env.SENDGRID_FROM_EMAIL || 'notificaciones@zendity.com',
                    subject: `Bienvenido/a a ${hqName} — Acceso al Portal Familiar`,
                    html,
                });
                console.log(`[ONBOARDING] Credenciales enviadas a: ${email}`);
            } else {
                console.warn(`[ONBOARDING] SENDGRID_API_KEY no configurado. Email no enviado a ${email}`);
                return NextResponse.json({ success: true, familyMember: newFamilyMember, emailFailed: true, emailError: "SENDGRID_API_KEY no configurado." });
            }
        } catch (emailError: any) {
            console.error("[ONBOARDING] Error enviando email de bienvenida:", emailError);
            const attemptedSender = process.env.SENDGRID_FROM_EMAIL || 'notificaciones@zendity.com';
            return NextResponse.json({
                success: true,
                familyMember: newFamilyMember,
                emailFailed: true,
                emailError: `[Remitente: "${attemptedSender}"] ` + (emailError.response ? JSON.stringify(emailError.response.body) : emailError.message)
            });
        }

        return NextResponse.json({ success: true, familyMember: newFamilyMember });
    } catch (error) {
        console.error("Error creating family member:", error);
        return NextResponse.json({ success: false, error: "Error al crear el perfil del familiar." }, { status: 500 });
    }
}

// DELETE: Revoke a family member's access
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: patientId } = await params;
        const session = await getServerSession(authOptions);
        if (!session || !['ADMIN', 'DIRECTOR'].includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: "Privilegios insuficientes para revocar accesos." }, { status: 403 });
        }

        const hqId = (session.user as any).headquartersId;
        const { searchParams } = new URL(req.url);
        const familyMemberId = searchParams.get('familyMemberId');

        if (!familyMemberId) {
            return NextResponse.json({ success: false, error: "ID del familiar requerido." }, { status: 400 });
        }

        // Ensure the family member belongs to this patient and HQ
        const existingMember = await prisma.familyMember.findUnique({
            where: { id: familyMemberId }
        });

        if (!existingMember || existingMember.patientId !== patientId || existingMember.headquartersId !== hqId) {
            return NextResponse.json({ success: false, error: "Acceso no autorizado o familiar no encontrado." }, { status: 403 });
        }

        await prisma.familyMember.delete({
            where: { id: familyMemberId }
        });

        return NextResponse.json({ success: true, message: "Acceso revocado exitosamente." });
    } catch (error) {
        console.error("Error deleting family member:", error);
        return NextResponse.json({ success: false, error: "Error al revocar el acceso." }, { status: 500 });
    }
}
