import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';



export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { employeeId, courseId, hqId, forceReset } = body;

        if (!employeeId || !courseId || !hqId) {
            return NextResponse.json({ success: false, error: "Datos incompletos" }, { status: 400 });
        }

        // FASE 46: Obtener o crear intento actual
        let enrollment = await prisma.userCourse.findUnique({
            where: { employeeId_courseId: { employeeId, courseId } }
        });

        if (!enrollment) {
            enrollment = await prisma.userCourse.create({
                data: {
                    employeeId,
                    courseId,
                    headquartersId: hqId,
                    status: 'IN_PROGRESS',
                }
            });
        }

        if (forceReset) {
            // Admin override to reset strikes
            await prisma.userCourse.update({
                where: { id: enrollment.id },
                data: { attemptsCount: 0, lockedUntil: null }
            });
            return NextResponse.json({ success: true, message: "Intentos reseteados" });
        }

        // Si ya está bloqueado, no hacer nada y devolver estado
        if (enrollment.lockedUntil && new Date(enrollment.lockedUntil) > new Date()) {
            return NextResponse.json({
                success: false,
                locked: true,
                lockedUntil: enrollment.lockedUntil,
                message: "Has superado el límite de intentos. Módulo bloqueado por 24 horas."
            });
        }

        // Incrementar Strike
        const newAttemptCount = enrollment.attemptsCount + 1;
        let updateData: any = {
            attemptsCount: newAttemptCount,
            lastAttemptAt: new Date()
        };

        if (newAttemptCount >= 3) {
            // Bloqueo de 24 horas
            updateData.lockedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
            updateData.status = 'FAILED';
            // Aquí en un futuro se enviaría un Trigger a Zendity HR
        }

        const updatedEnrollment = await prisma.userCourse.update({
            where: { id: enrollment.id },
            data: updateData
        });

        return NextResponse.json({
            success: true,
            newAttemptCount,
            locked: newAttemptCount >= 3,
            lockedUntil: updateData.lockedUntil || null
        });

    } catch (error) {
        console.error("Academy Attempt Error:", error);
        return NextResponse.json({ success: false, error: "Fallo registrando intento en Zendity Academy" }, { status: 500 });
    }
}
