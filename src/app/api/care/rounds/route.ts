import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { patientId, caregiverId, status, note } = body;

        if (!patientId || !caregiverId || !status) {
            return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
        }

        // FASE 110: 2-Hour SLA Verification at Database Level
        // Prevent aggressive submissions even if frontend is bypassed
        const twoHoursAgo = new Date(Date.now() - 120 * 60000);

        const lastRound = await prisma.dailyLog.findFirst({
            where: {
                patientId,
                notes: { startsWith: '[RONDA NOCTURNA]' },
                createdAt: { gte: twoHoursAgo }
            },
            orderBy: { createdAt: 'desc' }
        });

        if (lastRound) {
            return NextResponse.json({
                success: false,
                error: "SLA Activo: Ya existe una ronda registrada en las últimas 2 horas para este paciente."
            }, { status: 429 });
        }

        // Determinar Prefix Visual
        let prefix = "😴 [RONDA NOCTURNA] Durmiendo";
        let isClinicalAlert = false;

        if (status === 'AWAKE') {
            prefix = "👁️ [RONDA NOCTURNA] Despierto";
        } else if (status === 'ANOMALY') {
            prefix = "⚠️ [RONDA NOCTURNA] ANOMALÍA";
            isClinicalAlert = true;
        }

        // Save into DailyLog
        const finalNote = note ? `${prefix} - ${note}` : prefix;

        await prisma.dailyLog.create({
            data: {
                patientId,
                authorId: caregiverId,
                foodIntake: 100,
                bathCompleted: false,
                notes: finalNote,
                isClinicalAlert
            }
        });

        // Add 2 points for compliance
        await prisma.user.update({
            where: { id: caregiverId },
            data: { complianceScore: { increment: 2 } }
        });

        // FASE 28: Zendity Triggered Reactive Learning
        if (isClinicalAlert) {
            try {
                const caregiver = await prisma.user.findUnique({ where: { id: caregiverId }, select: { headquartersId: true } });
                if (caregiver && caregiver.headquartersId) {
                    const reactiveCourse = await prisma.course.findFirst({
                        where: { headquartersId: caregiver.headquartersId, isActive: true },
                        orderBy: { createdAt: 'desc' }
                    });

                    if (reactiveCourse) {
                        await prisma.userCourse.upsert({
                            where: { employeeId_courseId: { employeeId: caregiverId, courseId: reactiveCourse.id } },
                            create: { employeeId: caregiverId, courseId: reactiveCourse.id, headquartersId: caregiver.headquartersId, status: 'ASSIGNED' },
                            update: { status: 'ASSIGNED' }
                        });
                        console.log(`[Zendi Academy] Curso Reactivo Nocturno Asignado a ${caregiverId}`);
                    }
                }
            } catch (e) {
                console.error("Reactive Learning NightRound Error:", e);
            }
        }

        return NextResponse.json({ success: true });
    } catch (e: any) {
        console.error("Error creating night round:", e);
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
