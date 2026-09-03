import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { marcaSede, correoDeSede } from '@/lib/marca-sede';
import { senderFrom } from '@/lib/family/appointment-effects';
import { requireRole } from '@/lib/api-auth';
import { emailLogoSrc } from '@/lib/email-logo';
import sgMail from '@sendgrid/mail';

if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

// Hub compartido — Sprint Coordinador (jun-2026): COORDINATOR + NURSE añadidos.
const ALLOWED_ROLES = ['DIRECTOR', 'ADMIN', 'NURSE', 'COORDINATOR'];

export async function POST(request: Request) {
    try {
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;
        const hqId = auth.headquartersId;

        const body = await request.json();
        const { familyMemberId, subject, html } = body;

        // Validaciones básicas
        if (!familyMemberId || !subject || !html) {
            return NextResponse.json({ error: 'Faltan parámetros de envío (familyMemberId, subject, html).' }, { status: 400 });
        }

        const hq = await prisma.headquarters.findUnique({
            where: { id: hqId },
            select: { name: true, logoUrl: true }
        });
        const hqName = hq?.name || 'Zendity Care Center';
        // Color de la sede, no el teal de Zendity: el correo es del hogar.
        const marca = await marcaSede(hqId);

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

        // Encabezado y pie compartidos: el nombre del hogar grande en sus
        // colores, y Zendity al pie. Antes cada correo a familia traia su propio
        // diseño y una familia recibia cinco que no parecian del mismo sitio.
        // Ver src/lib/marca-sede.ts.
        const corporateTemplate = correoDeSede(marca, `
            <p style="font-weight:700;color:#0f172a;margin:0 0 20px;">Estimado/a ${familyMember.name},</p>
            <div style="white-space:pre-wrap;color:#475569;">${html}</div>
            <div style="margin-top:28px;padding-top:20px;border-top:1px solid #e7e5e4;">
                <p style="margin:0;color:#0f172a;font-weight:700;">Atentamente,</p>
                <p style="margin:4px 0 0;color:#64748b;">La Dirección de ${hqName}</p>
            </div>
            <p style="margin:24px 0 0;font-size:12px;color:#a8a29e;line-height:1.6;">
                Este mensaje está relacionado al cuidado de su familiar.
                Por favor no responda directamente a este correo.
            </p>
        `);

        const msg = {
            to: targetEmail,
            // Con el nombre del hogar: es lo unico que la familia ve en su
            // bandeja antes de abrir. Antes iba la direccion cruda.
            from: senderFrom(hqName),
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
