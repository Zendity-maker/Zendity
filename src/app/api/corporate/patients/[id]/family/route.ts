import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { PrismaClient } from "@prisma/client";
import sgMail from '@sendgrid/mail';

const prisma = new PrismaClient();

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
        const { name, email, passcode, accessLevel } = await req.json();

        if (!name || !email || !passcode) {
            return NextResponse.json({ success: false, error: "Debe proveer Nombre, Email y PIN." }, { status: 400 });
        }

        // Check if email already exists globally (emails must be unique across the system for family members)
        const existingEmail = await prisma.familyMember.findUnique({
            where: { email: email }
        });

        if (existingEmail) {
            return NextResponse.json({ success: false, error: "El email ingresado ya está asociado a otra cuenta." }, { status: 400 });
        }

        const newFamilyMember = await prisma.familyMember.create({
            data: {
                patientId: patientId,
                headquartersId: hqId,
                name,
                email,
                passcode,
                accessLevel: accessLevel || "Full"
            }
        });

        // -------------------------------------------------------------
        // FASE 66: B2C ONBOARDING WELCOME EMAIL
        // -------------------------------------------------------------
        try {
            const hq = await prisma.headquarters.findUnique({
                where: { id: hqId },
                select: { name: true, logoUrl: true }
            });
            const hqName = hq?.name || 'Zendity Care Center';

            const patient = await prisma.patient.findUnique({
                where: { id: patientId },
                select: { name: true }
            });
            const patientName = patient?.name || 'su familiar';

            const emailSubject = `Bienvenido(a) a ${hqName} - Accesos al Portal de Familiares`;
            
            const htmlContent = `
                <p>Nos complace darle la más cordial bienvenida al portal oficial de monitoreo de <strong style="color: #0d9488;">${hqName}</strong>, impulsado por tecnología Zendity OS.</p>
                <p>Ha sido registrado como familiar autorizado para recibir partes clínicos, mensajes de enfermería, y acceso a facturas relacionadas con el cuidado de <strong>${patientName}</strong>.</p>
                
                <div style="background-color: #f1f5f9; border-left: 4px solid #0d9488; padding: 16px; margin: 24px 0; border-radius: 0 8px 8px 0;">
                    <h3 style="margin-top: 0; color: #0f172a; font-size: 16px;">Sus Credenciales de Ingreso:</h3>
                    <ul style="list-style: none; padding-left: 0; color: #334155; margin-bottom: 0;">
                        <li style="margin-bottom: 8px;">🌐 <strong>Portal:</strong> <a href="https://app.zendity.com" style="color: #0284c7; text-decoration: none;">app.zendity.com</a> (Seleccione <em>Login Familiares</em>)</li>
                        <li style="margin-bottom: 8px;">📧 <strong>Usuario:</strong> ${email}</li>
                        <li>🔑 <strong>PIN de Seguridad:</strong> <span style="background-color: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 16px; font-weight: bold; letter-spacing: 2px;">${passcode}</span></li>
                    </ul>
                </div>
                
                <p>Por motivos de seguridad (HIPAA), le recomendamos no compartir este PIN de acceso universal con terceros. Si requiere que otra persona tenga acceso a la plataforma de monitoreo, comuníquese con nuestra Oficina Central para emitirle credenciales propias.</p>
            `;

            const corporateTemplate = `
            <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
                <div style="background-color: #ffffff; padding: 32px 24px; text-align: center; border-bottom: 3px solid #0d9488;">
                    ${hq?.logoUrl ? `<img src="${hq.logoUrl}" alt="${hqName}" style="max-width: 200px; max-height: 90px; margin-bottom: 8px; border-radius: 12px; object-fit: contain;" />` : `<h2 style="color: #0f172a; margin: 0; font-size: 28px; font-weight: 800;">${hqName}</h2>`}
                    <p style="color: #64748b; margin: 12px 0 0 0; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Comunicación Oficial a Familiares</p>
                </div>
                <div style="padding: 40px 32px; background-color: #ffffff; color: #334155; line-height: 1.7; font-size: 16px;">
                    <p style="font-weight: 600; color: #0f172a; margin-bottom: 24px;">Estimado/a ${name},</p>
                    <div style="white-space: pre-wrap; color: #475569;">
                        ${htmlContent}
                    </div>
                    <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e2e8f0;">
                        <p style="margin: 0; color: #0f172a; font-weight: 600;">Atentamente,</p>
                        <p style="margin: 4px 0 0 0; color: #64748b;">La Dirección de ${hqName}</p>
                    </div>
                </div>
                <div style="background-color: #f8fafc; padding: 24px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0;">
                    <p style="margin: 0;">Este mensaje está relacionado al cuidado de <span style="font-weight: bold; color: #0f172a;">${patientName}</span>.</p>
                    <p style="margin: 8px 0 0 0;">Por favor no responda directamente a este correo automático.</p>
                    <p style="margin: 16px 0 0 0; font-size: 10px; color: #94a3b8; text-transform: uppercase; font-weight: 700; letter-spacing: 0.1em;">Tecnología Zendity OS</p>
                </div>
            </div>
            `;

            if (process.env.SENDGRID_API_KEY) {
                const msg = {
                    to: email,
                    from: process.env.SENDGRID_FROM_EMAIL || 'vividseniorliving@gmail.com',
                    subject: emailSubject,
                    html: corporateTemplate,
                };
                await sgMail.send(msg);
                console.log(`[ONBOARDING] Welcome Email dispatched to FamilyMember: ${email}`);
            } else {
                console.log(`[ONBOARDING - MOCK] Missing SENDGRID_API_KEY. Ignored Welcome Email to ${email}`);
                return NextResponse.json({ 
                    success: true, 
                    familyMember: newFamilyMember, 
                    emailFailed: true, 
                    emailError: "Falta configurar la variable global 'SENDGRID_API_KEY' en Vercel. Modo de simulación activo." 
                });
            }
        } catch (emailError: any) {
            console.error("[ONBOARDING] Error sending Welcome Email to family member:", emailError);
            // Non-blocking error. Continue registering the user, but inform the UI.
            return NextResponse.json({ 
                success: true, 
                familyMember: newFamilyMember, 
                emailFailed: true, 
                emailError: emailError.response ? JSON.stringify(emailError.response.body) : emailError.message 
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
