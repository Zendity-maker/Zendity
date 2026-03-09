import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import sgMail from '@sendgrid/mail';

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
        const { subject, html } = body;
        const hqId = session.user.headquartersId;

        // Validaciones básicas
        if (!subject || !html) {
            return NextResponse.json({ error: 'Faltan parámetros de envío (subject, html).' }, { status: 400 });
        }

        const allEmployees = await prisma.user.findMany({
            where: { headquartersId: hqId },
            select: { email: true, name: true }
        });

        // Filtrar aquellos que no tengan correo asignado
        const targetEmails = allEmployees
            .map(e => e.email)
            .filter((email) => email && email.includes('@'));

        if (targetEmails.length === 0) {
            return NextResponse.json({ error: 'No se encontraron destinatarios con email válido en esta sede.' }, { status: 404 });
        }

        // Si no tenemos SENDGRID_API_KEY configurado, simular envío (Mock)
        if (!process.env.SENDGRID_API_KEY) {
            console.log("-----------------------------------------");
            console.log(`[MOCK BROADCAST EMAIL SEND] A ${targetEmails.length} empleados:`, targetEmails);
            console.log(`SUBJECT: [Zendity Broadcast] ${subject}`);
            console.log(`BODY: ${html}`);
            console.log("-----------------------------------------");
            return NextResponse.json({ success: true, mocked: true, message: `Simulated broadcast to ${targetEmails.length} users` }, { status: 200 });
        }

        // Diseño básico de correo corporativo inyectando el cuerpo HTML
        const corporateTemplate = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
            <div style="background-color: #4f46e5; padding: 24px; text-align: center;">
                <h2 style="color: white; margin: 0; font-size: 24px;">Zendity Corporate Hub</h2>
                <p style="color: #c7d2fe; margin: 5px 0 0 0; font-size: 14px;">Aviso Oficial (A todo el Staff)</p>
            </div>
            <div style="padding: 32px; background-color: #ffffff; color: #334155; line-height: 1.6;">
                <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; border-left: 4px solid #4f46e5; white-space: pre-wrap;">
                    ${html}
                </div>
            </div>
            <div style="background-color: #f1f5f9; padding: 16px; text-align: center; font-size: 12px; color: #64748b;">
                <p style="margin: 0;">Este es un mensaje general para la sede, autogenerado por Zendity Hub.</p>
                <p style="margin: 4px 0 0 0;">Por favor no responda directamente a este correo.</p>
            </div>
        </div>
        `;

        const msg = {
            to: targetEmails,
            from: process.env.SENDGRID_FROM_EMAIL || 'notificaciones@zendity.com',
            subject: `[Aviso Sede] ${subject}`,
            html: corporateTemplate,
            isMultiple: true, // Crucial para que no se vean las direcciones de los demás (BCC implícito)
        };

        await sgMail.send(msg);

        return NextResponse.json({ success: true, message: `Email enviado masivamente a ${targetEmails.length} empleados` }, { status: 200 });

    } catch (error: any) {
        console.error('API Comms Broadcast Error:', error);
        if (error.response) {
            console.error(error.response.body)
        }
        return NextResponse.json({ error: 'Error del servidor al despachar el correo masivo' }, { status: 500 });
    }
}
