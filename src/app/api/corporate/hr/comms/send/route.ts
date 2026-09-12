import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { emailLogoSrc } from '@/lib/email-logo';
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
        const logoSrc = emailLogoSrc(hqId, hq?.logoUrl);
        const logoHtml = logoSrc ? `<img src="${logoSrc}" alt="${hqName}" style="max-height: 80px; margin-bottom: 20px; object-fit: contain;" />` : '';

        /**
         * FUERA `white-space: pre-wrap`, Y ESTE ES EL FALLO QUE ANDRES VIO.
         *
         * El campo se llama `html` y la pantalla lo rotula "HTML/Markdown", pero
         * esta plantilla lo metia dentro de un div con `white-space: pre-wrap`.
         * Eso hace VISIBLES todos los saltos de linea y la indentacion del
         * codigo, asi que cualquier correo con formato llegaba con huecos
         * enormes entre todo. El 12-sep-2026 Andres mando el aviso de caidas
         * desde aqui tres veces y las tres llego roto.
         *
         * El mismo arreglo se hizo en api/hr/comms/send-broadcast el mes pasado
         * —esta comentado alli— y este endpoint se quedo sin el. Son dos
         * pantallas distintas que mandan correo al personal, y solo una estaba
         * arreglada.
         *
         * Y LA PALETA. #1F2D3A para el texto y #0F6B78 en los filos son los
         * colores viejos: azul oscuro casi negro sobre gris. La casa es teal
         * #0F6E56. Un memorando que llega en otra gama no parece del hogar, y
         * en pantalla se lee oscuro.
         *
         * Se quita ademas la caja gris exterior: encajonaba el contenido dentro
         * de otra caja, de modo que un correo bien maquetado quedaba metido en
         * un recuadro ajeno.
         */
        const memoTemplate = `
        <meta charset="utf-8">
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:620px;margin:0 auto;border:1px solid #DDE4DF;border-radius:12px;overflow:hidden;background-color:#ffffff;">
            <div style="background-color:#0F6E56;padding:24px;text-align:center;">
                ${logoSrc ? `<img src="${logoSrc}" alt="${hqName}" style="max-height:50px;margin-bottom:12px;border-radius:8px;" />` : `<h2 style="color:#ffffff;margin:0;font-size:24px;">${hqName}</h2>`}
                <p style="color:#A8DCC6;margin:5px 0 0 0;font-size:13px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">Memorándum oficial de personal</p>
            </div>

            <div style="background-color:#ffffff;color:#12211D;line-height:1.65;font-size:15px;">
                ${html}
            </div>

            <div style="background-color:#F1F4F1;padding:16px 24px;text-align:center;font-size:12px;color:#66766F;line-height:1.6;">
                <p style="margin:0;">Mensaje de la dirección de ${hqName}.</p>
                <p style="margin:4px 0 0 0;">Lo recibes porque eres personal acreditado del hogar.</p>
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
            subject: `${hqName} · ${subject}`,
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
