import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import sgMail from '@sendgrid/mail';

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
if (SENDGRID_API_KEY) {
    sgMail.setApiKey(SENDGRID_API_KEY);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const session = await getServerSession(authOptions);
        if (!session || !['DIRECTOR', 'ADMIN'].includes(session.user.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const employee = await prisma.user.findUnique({
            where: { id },
            include: { headquarters: true }
        });

        if (!employee || employee.headquartersId !== session.user.headquartersId) {
            return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
        }

        if (!SENDGRID_API_KEY || !employee.email) {
            return NextResponse.json({ error: 'SendGrid no está configurado o empleado no tiene email.' }, { status: 400 });
        }

        const senderEmail = process.env.SENDGRID_FROM_EMAIL || 'notificaciones@zendity.com';
        const facilityName = employee.headquarters?.name || 'Zendity Care Center';
        const logoHtml = employee.headquarters?.logoUrl ? `<div style="text-align: center; margin-bottom: 20px;"><img src="${employee.headquarters.logoUrl}" alt="${facilityName}" style="max-height: 80px; object-fit: contain;" /></div>` : '';

        const roleNames: Record<string, string> = {
            "NURSE": "Enfermera(o) a Cargo",
            "CAREGIVER": "Cuidador(a) Principal",
            "SOCIAL_WORKER": "Trabajador(a) Social",
            "KITCHEN": "Cocina y Dietas",
            "MAINTENANCE": "Mantenimiento",
            "DIRECTOR": "Director(a) de Sede",
            "SUPERVISOR": "Supervisor(a) de Planta"
        };
        const friendlyRole = roleNames[employee.role] || employee.role;

        const msg = {
            to: employee.email,
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
                    <p style="color: #334155; font-size: 16px; margin-top: 0;">Hola <strong>${employee.name}</strong>,</p>
                    <p style="color: #475569; font-size: 15px;">La División de Recursos Humanos ha emitido o actualizado tu acceso oficial con el puesto de <strong>${friendlyRole}</strong>.</p>
                    
                    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 25px 0;" />
                    
                    <h3 style="color: #0f172a; margin-bottom: 15px; font-size: 18px;">Tus Credenciales Seguras de Acceso:</h3>
                    <ul style="list-style: none; padding: 0; margin: 0;">
                        <li style="margin-bottom: 10px; font-size: 15px; color: #475569;"> <strong>Usuario (Correo):</strong> <span style="font-family: monospace; font-size: 16px;">${employee.email}</span></li>
                        <li style="margin-bottom: 20px; font-size: 15px; color: #475569;"> <strong>PIN Codificado:</strong> <span style="background-color: #f1f5f9; padding: 6px 12px; border-radius: 6px; font-family: monospace; font-size: 18px; font-weight: bold; color: #0f172a; border: 1px solid #cbd5e1; letter-spacing: 2px;">${employee.pinCode || 'No asignado'}</span></li>
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
        return NextResponse.json({ success: true, message: 'Correo reenviado exitosamente.' });
    } catch (e: any) {
        console.error('API Error sending welcome email:', e);
        return NextResponse.json({ error: 'Fallo al enviar correo.' }, { status: 500 });
    }
}
