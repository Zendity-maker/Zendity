import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import sgMail from '@sendgrid/mail';

if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

const ALLOWED_ROLES = ['DIRECTOR', 'ADMIN'];

// GET — cuántas familias registradas recibirán el mensaje
export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !ALLOWED_ROLES.includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }

        const hqId = (session.user as any).headquartersId;

        const count = await prisma.familyMember.count({
            where: {
                isRegistered: true,
                patient: { headquartersId: hqId, status: 'ACTIVE' },
            },
        });

        return NextResponse.json({ success: true, count });
    } catch (e) {
        console.error('[family-broadcast GET]', e);
        return NextResponse.json({ success: false, error: 'Error' }, { status: 500 });
    }
}

// POST — enviar mensaje global a todas las familias registradas
export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !ALLOWED_ROLES.includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }

        const hqId    = (session.user as any).headquartersId;
        const staffId = (session.user as any).id;
        const { content, imageBase64 } = await req.json();

        if (!content?.trim()) {
            return NextResponse.json({ success: false, error: 'El mensaje no puede estar vacío' }, { status: 400 });
        }

        // Imagen: validar tamaño (<= 2 MB en base64 ≈ ~2.7 MB string)
        if (imageBase64 && imageBase64.length > 3_800_000) {
            return NextResponse.json({ success: false, error: 'La imagen supera el límite de 2 MB' }, { status: 400 });
        }

        const hq = await prisma.headquarters.findUnique({
            where: { id: hqId },
            select: { name: true, logoUrl: true },
        });
        const hqName = hq?.name || 'Zendity Care Center';

        // Familiares registrados con paciente activo en esta sede
        const familyMembers = await prisma.familyMember.findMany({
            where: {
                isRegistered: true,
                patient: { headquartersId: hqId, status: 'ACTIVE' },
            },
            select: { id: true, name: true, email: true, patientId: true },
        });

        if (familyMembers.length === 0) {
            return NextResponse.json({ success: false, error: 'No hay familiares registrados en esta sede' }, { status: 404 });
        }

        const text = content.trim();
        const preview = text.slice(0, 80) + (text.length > 80 ? '…' : '');

        // 1. Crear FamilyMessage por cada familiar
        await prisma.familyMessage.createMany({
            data: familyMembers.map(fm => ({
                patientId:     fm.patientId,
                senderType:    'STAFF',
                senderId:      staffId,
                content:       text,
                imageBase64:   imageBase64 || null,
                recipientType: 'ADMINISTRATION',
                isRead:        true, // broadcast no genera unread en el panel del staff
            })),
        });

        // 2. Notificación in-app por familiar (best-effort)
        for (const fm of familyMembers) {
            try {
                // Buscar usuario registrado del familiar
                const famUser = await prisma.user.findFirst({
                    where: { email: fm.email },
                    select: { id: true },
                });
                if (famUser) {
                    await prisma.notification.create({
                        data: {
                            userId:  famUser.id,
                            type:    'FAMILY_VISIT',
                            title:   `📢 Mensaje de ${hqName}`,
                            message: preview,
                            isRead:  false,
                        },
                    });
                }
            } catch { /* no-fatal */ }
        }

        // 3. Email via SendGrid (best-effort)
        const validEmails = familyMembers.map(f => f.email).filter(e => e?.includes('@'));
        if (validEmails.length > 0 && process.env.SENDGRID_API_KEY) {
            try {
                const imageHtml = imageBase64
                    ? `<div style="margin:24px 0;text-align:center;">
                        <img src="${imageBase64}" alt="Imagen adjunta" style="max-width:100%;max-height:300px;border-radius:12px;object-fit:cover;" />
                       </div>`
                    : '';

                const emailHtml = `
<div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,.1);">
  <div style="background:#ffffff;padding:32px 24px;text-align:center;border-bottom:3px solid #0d9488;">
    ${hq?.logoUrl
        ? `<img src="${hq.logoUrl}" alt="${hqName}" style="max-width:180px;max-height:80px;margin-bottom:8px;border-radius:10px;object-fit:contain;" />`
        : `<h2 style="color:#0f172a;margin:0;font-size:26px;font-weight:800;">${hqName}</h2>`}
    <p style="color:#64748b;margin:10px 0 0;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;">Mensaje de la Dirección</p>
  </div>
  <div style="padding:36px 32px;background:#ffffff;color:#334155;line-height:1.7;font-size:16px;">
    <p style="font-weight:700;color:#0f172a;margin-bottom:20px;">Estimadas familias de ${hqName},</p>
    ${imageHtml}
    <div style="white-space:pre-wrap;color:#475569;">${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
    <div style="margin-top:28px;padding-top:20px;border-top:1px solid #e2e8f0;">
      <a href="${process.env.NEXTAUTH_URL || 'https://app.zendity.com'}/family/messages"
         style="display:inline-block;background:#0d9488;color:#ffffff;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;">
        Ver en el portal →
      </a>
    </div>
  </div>
  <div style="background:#f8fafc;padding:20px;text-align:center;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;">
    <p style="margin:0;">Mensaje enviado a toda la comunidad de familias de ${hqName}.</p>
    <p style="margin:8px 0 0;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;">Zéndity OS</p>
  </div>
</div>`;

                await sgMail.sendMultiple({
                    to:      validEmails,
                    from:    process.env.SENDGRID_FROM_EMAIL as string,
                    subject: `📢 Mensaje de ${hqName}`,
                    html:    emailHtml,
                });
            } catch (emailErr) {
                console.error('[family-broadcast] SendGrid error:', emailErr);
            }
        }

        return NextResponse.json({
            success: true,
            sent: familyMembers.length,
            message: `Mensaje enviado a ${familyMembers.length} familiar${familyMembers.length !== 1 ? 'es' : ''}.`,
        });

    } catch (e) {
        console.error('[family-broadcast POST]', e);
        return NextResponse.json({ success: false, error: 'Error al enviar el mensaje' }, { status: 500 });
    }
}
