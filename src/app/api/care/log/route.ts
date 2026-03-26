import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';



export async function POST(req: Request) {
    try {
        const { patientId, authorId, bathCompleted, foodIntake, notes, photoUrl } = await req.json();

        // Determinar alerta clínica si no comió nada (0%) o notas preocupantes
        const isClinicalAlert = Number(foodIntake) === 0 || (notes && notes.toLowerCase().includes('dolor'));

        const log = await prisma.dailyLog.create({
            data: {
                patientId,
                authorId,
                bathCompleted: Boolean(bathCompleted),
                foodIntake: Number(foodIntake),
                notes,
                isClinicalAlert: Boolean(isClinicalAlert),
                photoUrl: photoUrl || null // FASE 37
            }
        });

        // FASE 28: Zendity Triggered Reactive Learning
        if (isClinicalAlert) {
            try {
                const caregiver = await prisma.user.findUnique({ where: { id: authorId }, select: { headquartersId: true } });
                if (caregiver && caregiver.headquartersId) {
                    const reactiveCourse = await prisma.course.findFirst({
                        where: { headquartersId: caregiver.headquartersId, isActive: true },
                        orderBy: { createdAt: 'desc' }
                    });

                    if (reactiveCourse) {
                        await prisma.userCourse.upsert({
                            where: { employeeId_courseId: { employeeId: authorId, courseId: reactiveCourse.id } },
                            create: { employeeId: authorId, courseId: reactiveCourse.id, headquartersId: caregiver.headquartersId, status: 'ASSIGNED' },
                            update: { status: 'ASSIGNED' }
                        });
                        console.log(`[Zendi Academy] Curso Reactivo Asignado a ${authorId}`);
                    }
                }
            } catch (e) {
                console.error("Reactive Learning DailyLog Error:", e);
            }
        }

        return NextResponse.json({ success: true, log, alert: isClinicalAlert ? "Notificación de Riesgo Operativo y Asignación de Curso Activa." : null });

    } catch (error) {
        console.error("Log POST Error:", error);
        return NextResponse.json({ success: false, error: "Error registrando bitácora" }, { status: 500 });
    }
}
