import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from '@/lib/prisma';
import { notifyUser } from '@/lib/notifications';
import { applyScoreEvent } from '@/lib/score-event';
import sgMail from '@sendgrid/mail';

if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

const ALLOWED_ROLES = ['NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN'];



export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ success: false, error: "No autorizado." }, { status: 401 });

        const role = (session.user as any).role;
        if (!ALLOWED_ROLES.includes(role)) {
            return NextResponse.json({ success: false, error: "No autorizado." }, { status: 401 });
        }

        const authorId = (session.user as any).id;
        const { action, selectedOption } = await req.json();

        if (!['ACCEPT', 'DECLINE'].includes(action)) {
            return NextResponse.json({ success: false, error: "Acción inválida." }, { status: 400 });
        }

        const update = await prisma.zendiNursingUpdate.findUnique({ where: { id } });

        if (!update || update.authorId !== authorId || update.status !== 'PENDING') {
            return NextResponse.json({ success: false, error: "Update no encontrado o ya procesado." }, { status: 404 });
        }

        // ── DECLINE ──────────────────────────────────────────────────────────
        if (action === 'DECLINE') {
            await prisma.zendiNursingUpdate.update({ where: { id }, data: { status: 'DECLINED' } });
            const nuUser = await prisma.user.findUnique({ where: { id: authorId }, select: { headquartersId: true } });
            await applyScoreEvent(authorId, nuUser?.headquartersId ?? '', -1,
                'Update de enfermería declinado', 'MISSION');
            return NextResponse.json({ success: true, message: "Update declinado. (-1 Punto)", action: 'DECLINED' });
        }

        // ── ACCEPT ───────────────────────────────────────────────────────────
        if (action === 'ACCEPT') {
            if (!selectedOption?.trim()) {
                return NextResponse.json({ success: false, error: "Debe seleccionar una opción." }, { status: 400 });
            }

            await prisma.$transaction(async (tx) => {
                // 1. Marcar como SENT
                await tx.zendiNursingUpdate.update({
                    where: { id },
                    data: { status: 'SENT', selectedOption }
                });

                // 2. FamilyMessage visible en portal familiar

                // 3. Crear FamilyMessage visible en el portal familiar
                await tx.familyMessage.create({
                    data: {
                        patientId: update.patientId,
                        senderType: 'STAFF',
                        senderId: authorId,
                        content: selectedOption,
                        recipientType: 'NURSING',
                        isRead: true
                    }
                });
            });

            // +3 Score con historial (fuera de tx para poder registrar ScoreEvent)
            const nuAcceptUser = await prisma.user.findUnique({ where: { id: authorId }, select: { headquartersId: true } });
            await applyScoreEvent(authorId, nuAcceptUser?.headquartersId ?? '', 3,
                'Update de enfermería enviado', 'MISSION');

            // ── Notificaciones al familiar (best-effort) ────────────────────
            try {
                const [patient, familyMembers] = await Promise.all([
                    prisma.patient.findUnique({
                        where: { id: update.patientId },
                        select: { name: true }
                    }),
                    prisma.familyMember.findMany({
                        where: { patientId: update.patientId, isRegistered: true },
                        orderBy: { isPrimary: 'desc' },
                        take: 3,
                        select: { id: true, name: true, email: true }
                    })
                ]);

                const patientName = patient?.name || 'su ser querido';

                for (const fm of familyMembers) {
                    // In-app notification
                    const famUser = await prisma.user.findFirst({
                        where: { email: fm.email },
                        select: { id: true }
                    });

                    if (famUser) {
                        await notifyUser(famUser.id, {
                            type: 'FAMILY_VISIT',
                            title: `💊 Actualización de enfermería — ${patientName}`,
                            message: selectedOption.slice(0, 100),
                            link: '/family/messages'
                        });
                    }

                    // Email via SendGrid
                    if (fm.email && process.env.SENDGRID_API_KEY) {
                        const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
    <div style="background:#0F6B78;padding:24px 32px;">
      <div style="color:#fff;font-size:11px;font-weight:800;letter-spacing:2.5px;text-transform:uppercase;opacity:0.85;">Zéndity Healthcare</div>
      <div style="color:#fff;font-size:20px;font-weight:900;margin-top:4px;">💊 Actualización de Enfermería</div>
    </div>
    <div style="padding:32px;">
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#0F172A;">
        Estimado/a <strong>${fm.name}</strong>,
      </p>
      <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#334155;">
        El equipo de enfermería de <strong>${patientName}</strong> le envía la siguiente actualización clínica:
      </p>
      <div style="background:#F0FDFA;border-left:4px solid #0D9488;border-radius:8px;padding:20px 24px;margin-bottom:24px;">
        <p style="margin:0;font-size:15px;line-height:1.7;color:#134E4A;">${selectedOption}</p>
      </div>
      <div style="text-align:center;margin:24px 0;">
        <a href="https://app.zendity.com/family/messages"
           style="background:#0F6B78;color:#fff;padding:13px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;display:inline-block;">
          Ver portal familiar
        </a>
      </div>
      <p style="margin:0;font-size:12px;color:#94A3B8;text-align:center;">
        Recibirá actualizaciones del equipo de cuidado periódicamente.
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
                                name: 'Zéndity — Enfermería'
                            },
                            subject: `💊 Actualización de enfermería — ${patientName} | Zéndity`,
                            html
                        });
                    }
                }
            } catch (notifErr) {
                // Non-fatal — las notificaciones no rompen el flujo principal
                console.error('[nursing-updates ACCEPT] Notification error (non-fatal):', notifErr);
            }

            return NextResponse.json({ success: true, message: "¡Update enviado a la familia! (+3 Puntos)", action: 'ACCEPTED' });
        }

    } catch (error: any) {
        console.error('[nursing-updates action] Error:', error);
        return NextResponse.json({ success: false, error: "Error interno" }, { status: 500 });
    }
}
