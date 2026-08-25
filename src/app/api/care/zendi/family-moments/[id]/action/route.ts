import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from '@/lib/prisma';
import { avisoFamiliaSinPHI } from '@/lib/family-email';
import { notifyUser } from '@/lib/notifications';
import { applyScoreEvent } from '@/lib/score-event';
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
            await prisma.zendiFamilyMoment.update({ where: { id: momentId }, data: { status: 'DECLINED' } });
            const fmUser = await prisma.user.findUnique({ where: { id: authorId }, select: { headquartersId: true } });
            await applyScoreEvent(authorId, fmUser?.headquartersId ?? '', -3,
                'Misión Zendi declinada', 'MISSION');
            return NextResponse.json({ success: true, message: "Sugerencia declinada. (-3 Puntos)", action: 'DECLINED' });
        }

        if (action === 'ACCEPT') {
            if (!selectedText) {
                return NextResponse.json({ success: false, error: "Debe proveer el texto seleccionado." }, { status: 400 });
            }

            // 1. Mark Moment as Sent + WellnessDiary entry
            await prisma.$transaction(async (tx) => {
                await tx.zendiFamilyMoment.update({
                    where: { id: momentId },
                    data: { status: 'SENT', selectedOption: selectedText, photoUrl: photoUrl || null }
                });
                await tx.wellnessDiary.create({
                    data: {
                        patientId: moment.patientId,
                        authorId: authorId,
                        note: `[Zendi Update] ${selectedText}`,
                        mediaUrl: photoUrl || null
                    }
                });
            });
            // 2. +3 Score con historial (fuera de tx para poder registrar ScoreEvent)
            const fmAcceptUser = await prisma.user.findUnique({ where: { id: authorId }, select: { headquartersId: true } });
            await applyScoreEvent(authorId, fmAcceptUser?.headquartersId ?? '', 3,
                'Misión Zendi completada', 'MISSION');

            // Notificar al familiar fuera de la transacción (soft — no rompe el flujo)
            try {
                const [patient, familyMembers] = await Promise.all([
                    prisma.patient.findUnique({
                        where: { id: moment.patientId },
                        select: { name: true, status: true },
                    }),
                    prisma.familyMember.findMany({
                        where: { patientId: moment.patientId },
                        orderBy: { isPrimary: 'desc' },
                        take: 3,
                        select: { id: true, name: true, email: true, isRegistered: true },
                    }),
                ]);

                // No se notifica a la familia de un residente que ya no esta.
                // Habia 38 momentos en PENDING de residentes fallecidos o dados
                // de baja: aprobar uno le habria mandado a la familia un aviso
                // sobre su ser querido meses despues. El momento se guarda
                // igual — queda en el expediente — pero no sale hacia fuera.
                const residenteActivo = patient
                    && ['ACTIVE', 'TEMPORARY_LEAVE'].includes(patient.status);
                if (!residenteActivo) throw new Error('SIN_NOTIFICAR_RESIDENTE_INACTIVO');

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
                        // Sin PHI en el correo — ver src/lib/family-email.ts.
                        const aviso = avisoFamiliaSinPHI({
                            familyName: fm.name,
                            hqName: 'Zéndity',
                            titulo: 'Un momento nuevo en el portal',
                            detalle: 'El equipo de cuidado compartió una novedad con usted.',
                            ruta: '/family/messages',
                        });

                        await sgMail.send({
                            to: fm.email,
                            from: {
                                email: process.env.SENDGRID_FROM_EMAIL || 'notificaciones@zendity.com',
                                name: 'Zéndity — Equipo de Cuidado',
                            },
                            subject: aviso.subject,
                            html: aviso.html,
                            text: aviso.text,
                        });
                    }
                }
            } catch (notifErr) {
                // Omitir a la familia de un residente inactivo NO es un fallo:
                // es la decision correcta. Se distingue para que no ensucie el
                // log de errores ni parezca una notificacion que se perdio.
                if ((notifErr as Error)?.message === 'SIN_NOTIFICAR_RESIDENTE_INACTIVO') {
                    console.info('[FamilyMoment ACCEPT] Residente inactivo: no se notifica a la familia.');
                } else {
                    // Error real de notificación: no cancela el flujo principal
                    console.error('[FamilyMoment ACCEPT] Notification error (non-fatal):', notifErr);
                }
            }

            return NextResponse.json({ success: true, message: "¡Sugerencia enviada! (+3 Puntos)", action: 'ACCEPTED' });
        }

    } catch (error) {
        console.error("Error processing Zendi Family Moment Action:", error);
        return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
    }
}
