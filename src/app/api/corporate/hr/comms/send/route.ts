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
        if (!session || !['DIRECTOR', 'ADMIN'].includes(session.user.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { subject, html, targetRoles } = body;
        const hqId = session.user.headquartersId;

        if (!subject || !html || !targetRoles || targetRoles.length === 0) {
            return NextResponse.json({ error: 'Missing parameters (subject, html, targetRoles).' }, { status: 400 });
        }

        // 1. Obtener la Sede para inyectar Logos
        const hq = await prisma.headquarters.findUnique({
            where: { id: hqId },
            select: { name: true, logoUrl: true }
        });
        const hqName = hq?.name || 'Zendity Care Center';

        // 2. Extraer empleados. Filtrar por roles si no incluye "ALL".
        const whereClause: any = { headquartersId: hqId, isActive: true, isDeleted: false };
        if (!targetRoles.includes('ALL')) {
            whereClause.role = { in: targetRoles };
        }

        const employees = await prisma.user.findMany({
            where: whereClause,
            select: { email: true, name: true, role: true }
        });

        // Filtrar correos inválidos
        const validEmails = employees.filter(e => e.email && e.email.includes("@")).map(e => e.email);

        if (validEmails.length === 0) {
            return NextResponse.json({ error: 'No se encontraron empleados con correos válidos para los roles seleccionados.' }, { status: 404 });
        }

        const senderEmail = process.env.SENDGRID_FROM_EMAIL || 'notificaciones@zendity.com';

        // Fake SendGrid test Si no hay API Key
        if (!process.env.SENDGRID_API_KEY) {
            console.log("-----------------------------------------");
            console.log(`[HR MOCK BROADCAST] BCC: ${validEmails.join(", ")}`);
            console.log(`SUBJECT: [${hqName}] ${subject}`);
            console.log(`BODY: ${html}`);
            console.log("-----------------------------------------");
            return NextResponse.json({ success: true, count: validEmails.length, mocked: true }, { status: 200 });
        }

        // 3. Diseño estético del correo corporativo RRHH
        const logoHtml = hq?.logoUrl ? `<img src="${hq.logoUrl}" alt="${hqName}" style="max-height: 80px; margin-bottom: 20px; object-fit: contain;" />` : '';

        const memoTemplate = `
        <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #f8fafc; padding: 30px;">
            <div style="text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 20px; margin-bottom: 30px;">
                ${logoHtml}
                <div style="font-size: 13px; font-weight: bold; color: #64748b; text-transform: uppercase; letter-spacing: 2px;">Memorándum Oficial de Personal</div>
            </div>
            
            <div style="background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); color: #334155; line-height: 1.6; font-size: 15px;">
                <h3 style="color: #0f172a; margin-top: 0; font-size: 20px; border-bottom: 1px solid #f1f5f9; padding-bottom: 10px;">Comunicado Corporativo</h3>
                
                <div style="white-space: pre-wrap; margin-top: 20px;">
                    ${html}
                </div>
                
                <div style="margin-top: 40px; border-top: 1px dashed #cbd5e1; padding-top: 20px;">
                    <p style="margin: 0; font-weight: bold; color: #0f172a;">Atentamente,</p>
                    <p style="margin: 5px 0 0 0; color: #64748b;">La Dirección de RRHH y Operaciones</p>
                    <p style="margin: 0; color: #64748b; font-weight: bold;">${hqName}</p>
                </div>
            </div>
            
            <div style="text-align: center; margin-top: 30px; font-size: 11px; color: #94a3b8;">
                <p style="margin: 0;">Has recibido este correo electrónico porque eres personal acreditado de ${hqName}.</p>
                <p style="margin: 5px 0 0 0; font-weight: bold; letter-spacing: 1px; text-transform: uppercase;">A Zendity Powered Facility</p>
            </div>
        </div>
        `;

        // 4. Despachar a través de SendGrid
        // Utilizando personalizations para ocultar la lista global (BCC natural)
        const msg = {
            from: {
                email: senderEmail,
                name: hqName
            },
            subject: `[RRHH] ${subject}`,
            html: memoTemplate,
            personalizations: [
                {
                    to: [{ email: senderEmail }], // Enviar al sender para pivot
                    bcc: validEmails.map(email => ({ email })) // BCC to everyone
                }
            ]
        };

        await sgMail.send(msg);

        return NextResponse.json({ success: true, count: validEmails.length }, { status: 200 });

    } catch (error: any) {
        console.error('HR Mass Comms Error:', error.response?.body || error);
        return NextResponse.json({ error: 'Error comunicando con servidor de correos.' }, { status: 500 });
    }
}
