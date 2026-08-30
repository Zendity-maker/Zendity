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
        if (!session || !['DIRECTOR', 'ADMIN', 'HR'].includes(session.user.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        // remitente: quien FIRMA el aviso.
        //   'HOGAR' (por defecto) — dirección del hogar hablando a su personal.
        //   'ZENDITY'             — la plataforma hablando a los usuarios.
        // La distinción no es cosmética. Cuando Zéndity se cae, quien debe
        // responder al personal es Zéndity, no la dirección del hogar
        // disculpándose por algo que no causó.
        const { subject, html, remitente } = body;
        const deZendity = remitente === 'ZENDITY';
        const hqId = session.user.headquartersId || (session.user as any).hqId;

        // Validaciones básicas
        if (!subject || !html) {
            return NextResponse.json({ error: 'Faltan parámetros de envío (subject, html).' }, { status: 400 });
        }

        const hq = await prisma.headquarters.findUnique({
            where: { id: hqId },
            select: { name: true, logoUrl: true }
        });
        const hqName = hq?.name || 'Corporate Hub';

        // Solo staff ACTIVO y no dado de baja. Un broadcast a "todo el staff"
        // NO debe alcanzar empleados desactivados (isActive:false) ni soft-deleted
        // (isDeleted:true). Mismo patrón que hr/staff, audit-report y corporate/hr/comms.
        const allEmployees = await prisma.user.findMany({
            where: { headquartersId: hqId, isActive: true, isDeleted: false },
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
        /**
         * Dos arreglos de la plantilla, los dos con consecuencia real:
         *
         * 1. FUERA white-space: pre-wrap. Hacía visibles todos los saltos de
         *    línea y la indentación del HTML que le pasan, así que cualquier
         *    correo con formato llegaba con huecos enormes y márgenes rotos.
         *    Solo servía para texto plano — y el campo se llama html.
         *
         * 2. Indigo #4f46e5 → teal #0F6E56. La paleta de la casa es teal; un
         *    aviso oficial que llega con otros colores no parece del hogar.
         *
         * Y se quita la caja gris interior: encajonaba el contenido dentro de
         * otra caja, de modo que un correo bien maquetado quedaba metido en un
         * recuadro ajeno.
         */
        const cabecera = deZendity
            ? `<div style="background-color:#12211D;padding:26px 30px;">
                   <p style="margin:0;color:#ffffff;font-size:19px;font-weight:800;">Zéndity</p>
                   <p style="margin:4px 0 0;color:#6FDDB1;font-size:13px;font-weight:600;">Comunicado de la plataforma · ${hqName}</p>
               </div>`
            : `<div style="background-color:#0F6E56;padding:24px;text-align:center;">
                   ${emailLogoSrc(hqId, hq?.logoUrl) ? `<img src="${emailLogoSrc(hqId, hq?.logoUrl)}" alt="${hqName}" style="max-height:50px;margin-bottom:12px;border-radius:8px;" />` : `<h2 style="color:white;margin:0;font-size:24px;">${hqName}</h2>`}
                   <p style="color:#A8DCC6;margin:5px 0 0 0;font-size:14px;">Aviso oficial · A todo el personal</p>
               </div>`;

        const pie = deZendity
            ? `<p style="margin:0;">Enviado por Zéndity, la plataforma que usa ${hqName}.</p>
               <p style="margin:4px 0 0 0;">Si tienes dudas sobre este mensaje, habla con tu supervisora.</p>`
            : `<p style="margin:0;">Mensaje de la dirección de ${hqName}.</p>
               <p style="margin:4px 0 0 0;">Por favor no responda directamente a este correo.</p>
               <p style="margin:12px 0 0 0;font-size:10px;color:#94a3b8;">Tecnología impulsada por Zéndity</p>`;

        const corporateTemplate = `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:620px;margin:0 auto;border:1px solid #DDE4DF;border-radius:12px;overflow:hidden;">
            ${cabecera}
            <div style="background-color:#ffffff;color:#12211D;line-height:1.65;">
                ${html}
            </div>
            <div style="background-color:#F1F4F1;padding:16px 24px;text-align:center;font-size:12px;color:#66766F;line-height:1.6;">
                ${pie}
            </div>
        </div>
        `;

        const msg = {
            to: targetEmails,
            from: process.env.SENDGRID_FROM_EMAIL || 'notificaciones@zendity.com',
            subject: deZendity ? `Zéndity · ${subject}` : `${hqName} · ${subject}`,
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
