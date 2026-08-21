import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { avisoFamiliaSinPHI } from '@/lib/family-email';
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
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;

        const authorId = auth.id;
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
                        // El contenido clínico NO sale por correo — ver src/lib/family-email.ts.
                        // El correo avisa; el detalle vive en el portal.
                        const aviso = avisoFamiliaSinPHI({
                            familyName: fm.name,
                            hqName: 'Zéndity',
                            titulo: 'Nueva actualización del equipo de cuidado',
                            detalle: 'El equipo de enfermería le dejó una actualización en el portal familiar.',
                            ruta: '/family/messages',
                        });

                        await sgMail.send({
                            to: fm.email,
                            from: {
                                email: process.env.SENDGRID_FROM_EMAIL || 'notificaciones@zendity.com',
                                name: 'Zéndity — Enfermería'
                            },
                            subject: aviso.subject,
                            html: aviso.html,
                            text: aviso.text,
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
