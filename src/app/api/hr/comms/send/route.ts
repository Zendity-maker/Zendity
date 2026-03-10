import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import sgMail from '@sendgrid/mail';

// Setear el API Key (Asume que existe SENDGRID_API_KEY en .env)
if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !['DIRECTOR', 'ADMIN', 'HR'].includes(session.user.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { employeeId, subject, html } = body;
        const hqId = session.user.headquartersId || (session.user as any).hqId;

        // Validaciones básicas
        if (!employeeId || !subject || !html) {
            return NextResponse.json({ error: 'Faltan parámetros de envío (employeeId, subject, html).' }, { status: 400 });
        }

        const hq = await prisma.headquarters.findUnique({
            where: { id: hqId },
            select: { name: true, logoUrl: true }
        });
        const hqName = hq?.name || 'Corporate Hub';

        const employee = await prisma.user.findUnique({
            where: { id: employeeId }
        });

        if (!employee || !employee.email) {
            return NextResponse.json({ error: 'Empleado no encontrado o sin correo asignado.' }, { status: 404 });
        }

        // Si no tenemos SENDGRID_API_KEY configurado, simular envío (Mock)
        if (!process.env.SENDGRID_API_KEY) {
            console.log("-----------------------------------------");
            console.log(`[MOCK EMAIL SEND] A: ${employee.email}`);
            console.log(`SUBJECT: ${subject}`);
            console.log(`BODY: ${html}`);
            console.log("-----------------------------------------");
            return NextResponse.json({ success: true, mocked: true, message: 'Simulated email dispatch' }, { status: 200 });
        }

        // Diseño básico de correo corporativo inyectando el cuerpo HTML
        const corporateTemplate = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
            <div style="background-color: #4f46e5; padding: 24px; text-align: center;">
                ${hq?.logoUrl ? `<img src="${hq.logoUrl}" alt="${hqName}" style="max-height: 50px; margin-bottom: 12px; border-radius: 8px;" />` : `<h2 style="color: white; margin: 0; font-size: 24px;">${hqName}</h2>`}
                <p style="color: #c7d2fe; margin: 5px 0 0 0; font-size: 14px;">Aviso Oficial de Recursos Humanos</p>
            </div>
            <div style="padding: 32px; background-color: #ffffff; color: #334155; line-height: 1.6;">
                <p style="margin-bottom: 24px;">Estimado(a) <strong>${employee.name}</strong>,</p>
                <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; border-left: 4px solid #4f46e5; white-space: pre-wrap;">
                    ${html}
                </div>
            </div>
            <div style="background-color: #f1f5f9; padding: 16px; text-align: center; font-size: 12px; color: #64748b;">
                <p style="margin: 0;">Este es un mensaje autogenerado por la gerencia administrativa de ${hqName}.</p>
                <p style="margin: 4px 0 0 0;">Por favor no responda directamente a este correo.</p>
                <p style="margin: 12px 0 0 0; font-size: 10px; color: #94a3b8;">Tecnología Impulsada por Zendity OS</p>
            </div>
        </div>
        `;

        const msg = {
            to: employee.email,
            from: process.env.SENDGRID_FROM_EMAIL || 'notificaciones@zendity.com', // Requiere sender verificado en SendGrid
            subject: `[${hqName} HR] ${subject}`,
            html: corporateTemplate,
        };

        await sgMail.send(msg);

        // Opcional: Podríamos loggear esto en Prisma en una tabla InternalCommunicationLog

        return NextResponse.json({ success: true, message: 'Email enviado exitosamente' }, { status: 200 });

    } catch (error: any) {
        console.error('API Comms Error:', error);
        if (error.response) {
            console.error(error.response.body)
        }
        return NextResponse.json({ error: 'Error del servidor al despachar el correo electrónico' }, { status: 500 });
    }
}
