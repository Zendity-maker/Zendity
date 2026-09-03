import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { marcaSede, correoDeSede } from '@/lib/marca-sede';
import { senderFrom } from '@/lib/family/appointment-effects';
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
        const { subject, html } = body;
        const hqId = session.user.headquartersId || (session.user as any).hqId;

        // Validaciones básicas
        if (!subject || !html) {
            return NextResponse.json({ error: 'Faltan parámetros de envío (subject, html).' }, { status: 400 });
        }

        const hq = await prisma.headquarters.findUnique({
            where: { id: hqId },
            select: { name: true, logoUrl: true }
        });
        const hqName = hq?.name || 'Zendity Care Center';
        // Color de la sede, no el teal de Zendity: el correo es del hogar.
        const marca = await marcaSede(hqId);

        // Solo familiares de residentes que siguen en el hogar.
        //
        // Sin el filtro de status, un comunicado general llegaba tambien a las
        // familias de residentes fallecidos o dados de baja. En Cupey eran 4
        // cuentas, una de un residente fallecido en mayo. El portal familiar
        // si les cierra el acceso (politica de duelo en src/lib/auth.ts), pero
        // el correo seguia saliendo — que es la parte que la familia recibe
        // sin haber ido a buscarla.
        const allFamilyMembers = await prisma.familyMember.findMany({
            where: {
                patient: {
                    headquartersId: hqId,
                    status: { in: ['ACTIVE', 'TEMPORARY_LEAVE'] },
                },
            },
            select: { email: true, name: true }
        });

        // Dedup and filter invalid emails
        const rawEmails = allFamilyMembers.map(e => e.email).filter(e => e && e.includes('@'));
        const targetEmails = [...new Set(rawEmails)]; // Unique emails

        if (targetEmails.length === 0) {
            return NextResponse.json({ error: 'No se encontraron destinatarios con email válido en la red de familiares.' }, { status: 404 });
        }

        // Mock Send
        if (!process.env.SENDGRID_API_KEY) {
            console.log("-----------------------------------------");
            console.log(`[MOCK BROADCAST FAMILY EMAIL] A ${targetEmails.length} familiares:`, targetEmails);
            console.log(`SUBJECT: [B2C Zendity] ${subject}`);
            console.log(`BODY: ${html}`);
            console.log("-----------------------------------------");
            return NextResponse.json({ success: true, mocked: true, message: `Simulated broadcast to ${targetEmails.length} family members.` }, { status: 200 });
        }

        // Mismo encabezado y pie que el resto de correos a familia:
        // el hogar al frente, Zendity al pie. Ver src/lib/marca-sede.ts.
        const corporateTemplate = correoDeSede(marca, `
            <p style="font-weight:700;color:#0f172a;margin:0 0 20px;">Estimadas Familias de ${hqName},</p>
            <div style="white-space:pre-wrap;color:#475569;">${html}</div>
            <div style="margin-top:28px;padding-top:20px;border-top:1px solid #e7e5e4;">
                <p style="margin:0;color:#0f172a;font-weight:700;">Atentamente,</p>
                <p style="margin:4px 0 0;color:#64748b;">La Dirección de ${hqName}</p>
            </div>
            <p style="margin:24px 0 0;font-size:12px;color:#a8a29e;line-height:1.6;">
                Este mensaje se envió a toda la comunidad de familiares de la sede.
                Por favor no responda directamente a este correo.
            </p>
        `);

        const msg = {
            to: targetEmails,
            // Con el nombre del hogar: es lo unico que la familia ve en su
            // bandeja antes de abrir. Antes iba la direccion cruda.
            from: senderFrom(hqName),
            subject: `[Comunicado Institucional] ${subject}`,
            html: corporateTemplate,
            isMultiple: true, // BCC
        };

        await sgMail.send(msg);

        return NextResponse.json({ success: true, message: `Comunicado general enviado a ${targetEmails.length} familiares.` }, { status: 200 });

    } catch (error: any) {
        console.error('API Comms Broadcast Error:', error);
        return NextResponse.json({ error: 'Error del servidor al despachar correo masivo.' }, { status: 500 });
    }
}
