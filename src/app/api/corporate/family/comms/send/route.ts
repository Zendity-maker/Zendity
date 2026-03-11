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
        const { familyMemberId, subject, html } = body;
        const hqId = session.user.headquartersId || (session.user as any).hqId;

        // Validaciones básicas
        if (!familyMemberId || !subject || !html) {
            return NextResponse.json({ error: 'Faltan parámetros de envío (familyMemberId, subject, html).' }, { status: 400 });
        }

        const hq = await prisma.headquarters.findUnique({
            where: { id: hqId },
            select: { name: true, logoUrl: true }
        });
        const hqName = hq?.name || 'Zendity Care Center';

        const familyMember = await prisma.familyMember.findUnique({
            where: { id: familyMemberId },
            include: { patient: { select: { name: true, headquartersId: true } } }
        });

        if (!familyMember || !familyMember.email) {
            return NextResponse.json({ error: 'Familiar no encontrado o sin correo válido.' }, { status: 404 });
        }

        if (familyMember.patient.headquartersId !== hqId) {
            return NextResponse.json({ error: 'Unauthorized cross-tenant request.' }, { status: 403 });
        }

        const targetEmail = familyMember.email;

        // Mock Send si no hay API Key
        if (!process.env.SENDGRID_API_KEY) {
            console.log("-----------------------------------------");
            console.log(`[MOCK INDIVIDUAL FAMILY EMAIL] A: ${targetEmail}`);
            console.log(`SUBJECT: [B2C Zendity] ${subject}`);
            console.log(`BODY: ${html}`);
            console.log("-----------------------------------------");
            return NextResponse.json({ success: true, mocked: true, message: `Simulated individual email to ${targetEmail}` }, { status: 200 });
        }

        // Diseño estético del correo corporativo para B2C
        const corporateTemplate = `
        <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
            <div style="background-color: #ffffff; padding: 32px 24px; text-align: center; border-bottom: 3px solid #0d9488;">
                ${hq?.logoUrl ? `<img src="${hq.logoUrl}" alt="${hqName}" style="max-width: 200px; max-height: 90px; margin-bottom: 8px; border-radius: 12px; object-fit: contain;" />` : `<h2 style="color: #0f172a; margin: 0; font-size: 28px; font-weight: 800;">${hqName}</h2>`}
                <p style="color: #64748b; margin: 12px 0 0 0; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Comunicación Oficial a Familiares</p>
            </div>
            <div style="padding: 40px 32px; background-color: #ffffff; color: #334155; line-height: 1.7; font-size: 16px;">
                <p style="font-weight: 600; color: #0f172a; margin-bottom: 24px;">Estimado/a ${familyMember.name},</p>
                <div style="white-space: pre-wrap; color: #475569;">
                    ${html}
                </div>
                <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e2e8f0;">
                    <p style="margin: 0; color: #0f172a; font-weight: 600;">Atentamente,</p>
                    <p style="margin: 4px 0 0 0; color: #64748b;">La Dirección de ${hqName}</p>
                </div>
            </div>
            <div style="background-color: #f8fafc; padding: 24px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0;">
                <p style="margin: 0;">Este mensaje está relacionado al cuidado de <span style="font-weight: bold; color: #0f172a;">${familyMember.patient.name}</span>.</p>
                <p style="margin: 8px 0 0 0;">Por favor no responda directamente a este correo automático.</p>
                <p style="margin: 16px 0 0 0; font-size: 10px; color: #94a3b8; text-transform: uppercase; font-weight: 700; letter-spacing: 0.1em;">Tecnología Zendity OS</p>
            </div>
        </div>
        `;

        const msg = {
            to: targetEmail,
            from: process.env.SENDGRID_FROM_EMAIL || 'notificaciones@zendity.com',
            subject: `[${hqName}] ${subject}`,
            html: corporateTemplate,
        };

        await sgMail.send(msg);

        return NextResponse.json({ success: true, message: `Email individual enviado a ${targetEmail}` }, { status: 200 });

    } catch (error: any) {
        console.error('API Comms Individual Error:', error);
        return NextResponse.json({ error: 'Error del servidor al despachar el correo.' }, { status: 500 });
    }
}
