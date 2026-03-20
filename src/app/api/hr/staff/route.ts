import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import sgMail from '@sendgrid/mail';

// Inicializar SendGrid
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
if (SENDGRID_API_KEY) {
    sgMail.setApiKey(SENDGRID_API_KEY);
}

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !['DIRECTOR', 'ADMIN'].includes(session.user.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const hqId = session.user.headquartersId;

        const staff = await prisma.user.findMany({
            where: { headquartersId: hqId },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                secondaryRoles: true,
                pinCode: true,
                complianceScore: true,
                isShiftBlocked: true,
                isDeleted: true,
                createdAt: true
            },
            orderBy: { name: 'asc' }
        });

        return NextResponse.json(staff);
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Failed to fetch staff' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !['DIRECTOR', 'ADMIN'].includes(session.user.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { name, email, role, secondaryRoles, pinCode } = body;
        const hqId = session.user.headquartersId;

        if (!name || !email || !role) {
            return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
        }

        const cleanEmail = email.toLowerCase().trim();

        const existing = await prisma.user.findUnique({
            where: { email: cleanEmail }
        });

        if (existing) {
            return NextResponse.json({ error: 'Email is already in use' }, { status: 400 });
        }

        const newUser = await prisma.user.create({
            data: {
                name,
                email: cleanEmail,
                role: role,
                secondaryRoles: secondaryRoles || [],
                pinCode: pinCode || null,
                headquartersId: hqId
            }
        });

        // ==========================================
        // FASE 66: Welcome Email automatizado al Staff
        // ==========================================
        try {
            if (SENDGRID_API_KEY && cleanEmail) {
                const senderEmail = process.env.SENDGRID_FROM_EMAIL || 'notificaciones@zendity.com';
                
                // Fetch de detalles de la sede para inyectar al correo
                const hqData = await prisma.headquarters.findUnique({
                    where: { id: hqId },
                    select: { name: true, logoUrl: true }
                });

                const facilityName = hqData?.name || 'Zendity Care Center';
                const logoHtml = hqData?.logoUrl ? `<div style="text-align: center; margin-bottom: 20px;"><img src="${hqData.logoUrl}" alt="${facilityName}" style="max-height: 80px; object-fit: contain;" /></div>` : '';

                const roleNames: Record<string, string> = {
                    "NURSE": "Enfermera(o) a Cargo",
                    "CAREGIVER": "Cuidador(a) Principal",
                    "SOCIAL_WORKER": "Trabajador(a) Social",
                    "KITCHEN": "Cocina y Dietas",
                    "MAINTENANCE": "Mantenimiento",
                    "DIRECTOR": "Director(a) de Sede",
                    "SUPERVISOR": "Supervisor(a) de Planta"
                };
                const friendlyRole = roleNames[role] || role;

                const msg = {
                    to: cleanEmail,
                    from: {
                        email: senderEmail,
                        name: facilityName
                    },
                    subject: 'Tus credenciales de acceso institucional',
                    html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #f8fafc;">
                        ${logoHtml}
                        <h2 style="color: #0f172a; text-align: center; font-weight: 800; font-size: 24px;">¡Bienvenido/a a la red de ${facilityName}!</h2>
                        
                        <div style="background-color: white; padding: 25px; border-radius: 12px; margin-top: 20px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
                            <p style="color: #334155; font-size: 16px; margin-top: 0;">Hola <strong>${name}</strong>,</p>
                            <p style="color: #475569; font-size: 15px;">La División de Recursos Humanos te ha registrado oficialmente en el sistema operativo institucional con el puesto de <strong>${friendlyRole}</strong>.</p>
                            
                            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 25px 0;" />
                            
                            <h3 style="color: #0f172a; margin-bottom: 15px; font-size: 18px;">Tus Credenciales Seguras de Acceso:</h3>
                            <ul style="list-style: none; padding: 0; margin: 0;">
                                <li style="margin-bottom: 10px; font-size: 15px; color: #475569;">👤 <strong>Usuario (Correo):</strong> <span style="font-family: monospace; font-size: 16px;">${cleanEmail}</span></li>
                                <li style="margin-bottom: 20px; font-size: 15px; color: #475569;">🔑 <strong>PIN Codificado:</strong> <span style="background-color: #f1f5f9; padding: 6px 12px; border-radius: 6px; font-family: monospace; font-size: 18px; font-weight: bold; color: #0f172a; border: 1px solid #cbd5e1; letter-spacing: 2px;">${pinCode || 'No asignado'}</span></li>
                            </ul>
                        </div>
                        
                        <div style="text-align: center; margin-top: 25px; color: #1F2D3A; font-size: 13px; padding-top: 15px; border-top: 1px dashed #C9D4D8;">
                            <p style="margin: 0; font-weight: 800; color: #0F6B78; text-transform: uppercase; letter-spacing: 1px;">Powered by Zendity OS</p>
                            <p style="margin: 5px 0 0 0; color: #64748b;">Healthcare Operations Platform</p>
                        </div>
                    </div>
                    `,
                };

                await sgMail.send(msg);
                console.log("[HR_COMMS] Welcome Email Sent To:", cleanEmail);
            }
        } catch (emailError: any) {
            console.error("[HR_COMMS_ERROR] Error enviando correo de bienvenida a empleado:", emailError.response?.body || emailError);
            // We intentionally swallow the error and return 201 so the employee is still successfully created.
        }

        return NextResponse.json({ success: true, user: newUser }, { status: 201 });

    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Failed to create employee' }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !['DIRECTOR', 'ADMIN'].includes(session.user.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { id, role, secondaryRoles, pinCode, isShiftBlocked, isDeleted, name, email } = body;

        if (!id) {
            return NextResponse.json({ error: 'Missing ID' }, { status: 400 });
        }

        // Bloqueo de seguridad corporativa B2B
        if (id === session.user.id && isShiftBlocked === true) {
            return NextResponse.json({ error: 'No te puedes bloquear a ti mismo.' }, { status: 403 });
        }

        const updateData: any = {};
        if (name !== undefined) updateData.name = name;
        
        if (email !== undefined) {
            const cleanEmail = email.toLowerCase().trim();
            const existing = await prisma.user.findFirst({
                where: { email: cleanEmail, id: { not: id } }
            });
            if (existing) {
                return NextResponse.json({ error: 'El correo ya está en uso por otro empleado.' }, { status: 400 });
            }
            updateData.email = cleanEmail;
        }

        if (role !== undefined) updateData.role = role;
        if (secondaryRoles !== undefined) updateData.secondaryRoles = secondaryRoles;
        if (pinCode !== undefined) updateData.pinCode = pinCode;
        if (isDeleted !== undefined) updateData.isDeleted = isDeleted;
        if (isShiftBlocked !== undefined) {
            updateData.isShiftBlocked = isShiftBlocked;
            if (isShiftBlocked) updateData.blockReason = "Management suspension";
            else updateData.blockReason = null;
        }

        const updatedUser = await prisma.user.update({
            where: { id },
            data: updateData
        });

        return NextResponse.json({ success: true, user: updatedUser }, { status: 200 });

    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Failed to update employee' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !['DIRECTOR', 'ADMIN'].includes(session.user.role)) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Falta el ID del empleado' }, { status: 400 });
        }

        // Bloqueo de seguridad: No puede eliminarse a sí mismo
        if (id === session.user.id) {
            return NextResponse.json({ error: 'No te puedes eliminar a ti mismo.' }, { status: 403 });
        }

        const userToDelete = await prisma.user.findUnique({ where: { id } });
        if (!userToDelete || userToDelete.headquartersId !== session.user.headquartersId) {
            return NextResponse.json({ error: 'Empleado no encontrado o de otra sede.' }, { status: 404 });
        }

        await prisma.user.update({
            where: { id },
            data: { isDeleted: true }
        });

        return NextResponse.json({ success: true }, { status: 200 });

    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Falló la eliminación del empleado' }, { status: 500 });
    }
}
