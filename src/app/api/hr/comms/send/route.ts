import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { emailLogoSrc } from '@/lib/email-logo';
import sgMail from '@sendgrid/mail';
import { remitenteDe, asuntoDe } from '@/lib/remitente-correo';

// Setear el API Key (Asume que existe SENDGRID_API_KEY en .env)
if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

export async function POST(request: Request) {
    try {
        // "HR" NO es un valor del enum Role — el valor es HR_MANAGER — así que
        // esta lista funcionaba de hecho como [DIRECTOR, ADMIN] y la tercera
        // opción no alcanzó nunca a nadie: despachar correo al personal, que es
        // la definición del puesto de RRHH, daba 401.
        //
        // Y no basta con corregir el string: includes(session.user.role) ignora
        // los roles secundarios, devuelve 401 donde toca 403, y se salta el
        // corte por facturación suspendida, que vive dentro de requireRole.
        const auth = await requireRole(['DIRECTOR', 'ADMIN', 'HR_MANAGER']);
        if (auth instanceof NextResponse) return auth;

        const body = await request.json();
        const { employeeId, subject, html } = body;
        const hqId = auth.headquartersId;

        // Validaciones básicas
        if (!employeeId || !subject || !html) {
            return NextResponse.json({ error: 'Faltan parámetros de envío (employeeId, subject, html).' }, { status: 400 });
        }

        const hq = await prisma.headquarters.findUnique({
            where: { id: hqId },
            select: { name: true, logoUrl: true }
        });
        const hqName = hq?.name || 'Corporate Hub';

        // findFirst (no findUnique) para poder filtrar por hqId + estado:
        //  - headquartersId: hqId → evita fuga multi-tenant (no enviar a staff de otra sede por ID).
        //  - isActive:true, isDeleted:false → no enviar a empleados desactivados/baja.
        const employee = await prisma.user.findFirst({
            where: { id: employeeId, headquartersId: hqId, isActive: true, isDeleted: false }
        });

        if (!employee || !employee.email) {
            return NextResponse.json({ error: 'Empleado no encontrado, inactivo o sin correo asignado.' }, { status: 404 });
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
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #C9D4D8; border-radius: 12px; overflow: hidden;">
            <div style="background-color: #1F2D3A; padding: 24px; text-align: center; border-bottom: 4px solid #0F6B78;">
                ${emailLogoSrc(hqId, hq?.logoUrl) ? `<img src="${emailLogoSrc(hqId, hq?.logoUrl)}" alt="${hqName}" style="max-height: 50px; margin-bottom: 12px; border-radius: 8px;" />` : `<h2 style="color: white; margin: 0; font-size: 24px;">${hqName}</h2>`}
                <p style="color: #3CC6C4; margin: 5px 0 0 0; font-size: 14px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">Aviso Oficial de Recursos Humanos</p>
            </div>
            <div style="padding: 32px; background-color: #ffffff; color: #1F2D3A; line-height: 1.6;">
                <p style="margin-bottom: 24px;">Estimado(a) <strong>${employee.name}</strong>,</p>
                <div style="background-color: #EAF4F5; padding: 20px; border-radius: 8px; border-left: 4px solid #0F6B78; white-space: pre-wrap;">
                    ${html}
                </div>
            </div>
            <div style="background-color: #f1f5f9; padding: 16px; text-align: center; font-size: 12px; color: #1F2D3A;">
                <p style="margin: 0;">Este es un mensaje autogenerado por la gerencia administrativa de ${hqName}.</p>
                <p style="margin: 4px 0 0 0;">Por favor no responda directamente a este correo.</p>
                <p style="margin: 12px 0 0 0; font-size: 10px; font-weight: bold; color: #0F6B78; text-transform: uppercase;">Tecnología Impulsada por Zendity OS</p>
            </div>
        </div>
        `;

        // Lo firma RRHH, no "el hogar": quien lo recibe tiene que saber sin
        // abrirlo que es algo de su expediente y no una circular.
        const remitente = remitenteDe('RRHH', hqName);
        if (!remitente) {
            return NextResponse.json({ success: false, error: 'Correo saliente no configurado' }, { status: 503 });
        }

        const msg = {
            to: employee.email,
            from: remitente,
            subject: asuntoDe('RRHH', subject),
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
