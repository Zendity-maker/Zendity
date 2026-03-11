import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(req: Request, { params }: { params: { id: string } }) {
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

            return NextResponse.json({ success: true, message: "¡Sugerencia enviada! (+3 Puntos)", action: 'ACCEPTED' });
        }

    } catch (error) {
        console.error("Error processing Zendi Family Moment Action:", error);
        return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
    }
}
