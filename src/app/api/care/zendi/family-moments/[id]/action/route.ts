import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from '@/lib/prisma';
import { notifyUser } from '@/lib/notifications';
import sgMail from '@sendgrid/mail';

if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}



export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: momentId } = await params;
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ success: false, error: "No autorizado." }, { status: 401 });
        }

        const authorId = (session.user as any).id;
        const { action, selectedText, photoUrl } = await req.json(); // action: 'ACCEPT' or 'DECLINE'

        if (!['ACCEPT', 'DECLINE'].includes(action)) {
            return NextResponse.json({ success: false, error: "Acción inválida." }, { status: 400 });
        }

        const moment = await prisma.zendiFamilyMoment.findUnique({
            where: { id: momentId }
        });

        if (!moment || moment.authorId !== authorId || moment.status !== 'PENDING') {
            return NextResponse.json({ success: false, error: "Momento Zendi no encontrado o ya procesado." }, { status: 404 });
        }

        if (action === 'DECLINE') {
            await prisma.$transaction([
                prisma.zendiFamilyMoment.update({
                    where: { id: momentId },
                    data: { status: 'DECLINED' }
                }),
                prisma.user.update({
                    where: { id: authorId },
                    data: {
                        complianceScore: { decrement: 3 } // Penalize -3 points
                    }
                })
            ]);
            return NextResponse.json({ success: true, message: "Sugerencia declinada. (-3 Puntos)", action: 'DECLINED' });
        }

        if (action === 'ACCEPT') {
            if (!selectedText) {
                return NextResponse.json({ success: false, error: "Debe proveer el texto seleccionado." }, { status: 400 });
            }

            // 1. Mark Moment as Sent
            // 2. Increase HR Compliance Score (+3 points)
            // 3. Post to the WellnessDiary so family members can see it in their portal
            await prisma.$transaction(async (tx) => {
                await tx.zendiFamilyMoment.update({
                    where: { id: momentId },
                    data: {
                        status: 'SENT',
                        selectedOption: selectedText,
                        photoUrl: photoUrl || null
                    }
                });

                await tx.user.update({
                    where: { id: authorId },
                    data: { complianceScore: { increment: 3 } }
                });

                // Map to the patient's wellnes diary so it is publicly available in family portal
                await tx.wellnessDiary.create({
                    data: {
                        patientId: moment.patientId,
                        authorId: authorId,
                        note: `[Zendi Update] ${selectedText}`, // Prepending tag to easily identify in UI
                        mediaUrl: photoUrl || null
                    }
                });
            });

            // Notificar al familiar fuera de la transacción (soft — no rompe el flujo)
            try {
                const [patient, familyMembers] = await Promise.all([
                    prisma.patient.findUnique({
                        where: { id: moment.patientId },
                        select: { name: true },
                    }),
                    prisma.familyMember.findMany({
                        where: { patientId: moment.patientId },
                        orderBy: { isPrimary: 'desc' },
                        take: 3,
                        select: { id: true, name: true, email: true, isRegistered: true },
                    }),
                ]);

                const patientName = patient?.name || 'su ser querido';

                for (const fm of familyMembers) {
                    // In-app notification si el familiar completó el registro (tiene User)
                    if (fm.isRegistered) {
                        const famUser = await prisma.user.findFirst({
                            where: { email: fm.email },
                            select: { id: true },
                        });
                        if (famUser) {
                            await notifyUser(famUser.id, {
                                type: 'FAMILY_VISIT',
                                title: `💚 Actualización de ${patientName}`,
                                message: selectedText,
                                link: '/family',
                            });
                        }
                    }

                    // Email via SendGrid — aunque no esté registrado, si tiene email
                    if (fm.email && process.env.SENDGRID_API_KEY) {
                        const cleanText = selectedText.replace(/^\[Zendi Update\]\s*/i, '');
                        const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
    <div style="background:#0F6B78;padding:24px 32px;">
      <div style="color:#fff;font-size:11px;font-weight:800;letter-spacing:2.5px;text-transform:uppercase;opacity:0.85;">Zéndity Healthcare</div>
      <div style="color:#fff;font-size:20px;font-weight:900;margin-top:4px;">💚 Actualización del Equipo</div>
    </div>
    <div style="padding:32px;">
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#0F172A;">
        Estimado/a <strong>${fm.name}</strong>,
      </p>
      <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#334155;">
        El equipo de cuidado de <strong>${patientName}</strong> le envía la siguiente actualización:
      </p>
      <div style="background:#ECFDF5;border-left:4px solid #10B981;border-radius:8px;padding:20px 24px;margin-bottom:24px;">
        <p style="margin:0;font-size:15px;line-height:1.7;color:#065F46;">${cleanText}</p>
      </div>
      <div style="text-align:center;margin:24px 0;">
        <a href="https://app.zendity.com/family"
           style="background:#0F6B78;color:#fff;padding:13px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;display:inline-block;">
          Ver portal familiar
        </a>
      </div>
      <p style="margin:0;font-size:12px;color:#94A3B8;text-align:center;">
        Recibirá estas actualizaciones cada vez que el equipo de cuidado las comparta con usted.
      </p>
    </div>
    <div style="background:#F8FAFC;padding:14px 32px;border-top:1px solid #E2E8F0;text-align:center;">
      <p style="margin:0;color:#94A3B8;font-size:11px;">Zéndity Healthcare Management Platform</p>
    </div>
  </div>
</body></html>`;

                        await sgMail.send({
                            to: fm.email,
                            from: {
                                email: process.env.SENDGRID_FROM_EMAIL || 'notificaciones@zendity.com',
                                name: 'Zéndity — Equipo de Cuidado',
                            },
                            subject: `💚 Actualización de ${patientName} — Zéndity`,
                            html,
                        });
                    }
                }
            } catch (notifErr) {
                // Error en notificación no cancela el flujo principal
                console.error('[FamilyMoment ACCEPT] Notification error (non-fatal):', notifErr);
            }

            return NextResponse.json({ success: true, message: "¡Sugerencia enviada! (+3 Puntos)", action: 'ACCEPTED' });
        }

    } catch (error) {
        console.error("Error processing Zendi Family Moment Action:", error);
        return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
    }
}
