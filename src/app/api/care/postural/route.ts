import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(req: Request) {
    try {
        const { patientId, caregiverId, position } = await req.json();

        if (!patientId || !caregiverId || !position) {
            return NextResponse.json({ success: false, error: "Faltan parámetros obligatorios para el cambio postural." }, { status: 400 });
        }

        const lastRotation = await prisma.posturalChangeLog.findFirst({
            where: { patientId },
            orderBy: { performedAt: 'desc' }
        });

        let pointsDelta = 0;
        let isLate = false;

        if (lastRotation) {
            const diffMs = Date.now() - new Date(lastRotation.performedAt).getTime();
            const diffMins = diffMs / (1000 * 60);

            // Objetivo 120 min. Tolerancia legal 15 mins (135 min max).
            if (diffMins > 135) {
                isLate = true;
                pointsDelta = -5; // Castigo por negligencia (strike)
            } else if (diffMins >= 60 && diffMins <= 135) {
                pointsDelta = 2;  // Recompensa operativa impecable
            }
        } else {
            // Primera rotación registrada de este paciente (Bonus inicial)
            pointsDelta = 2;
        }

        // Gamificación HR (Deducción o Ganancia)
        if (pointsDelta !== 0) {
            await prisma.user.update({
                where: { id: caregiverId },
                data: { complianceScore: { increment: pointsDelta } }
            });
            
            // Si es un castigo, inyectamos notificación para el empleado
            if (pointsDelta < 0) {
                await prisma.incident.create({
                    data: {
                        patientId,
                        headquartersId: "hr-system",
                        type: "ULCER",
                        severity: "MEDIUM",
                        description: `PENALIDAD HR: Cambio postural de residente retrasado por más de 135 minutos. Infracción al protocolo UPP.`,
                        biometricSignature: "zendity-ai-auditor"
                    }
                });
            }
        }

        const newRotation = await prisma.posturalChangeLog.create({
            data: {
                patientId,
                nurseId: caregiverId,
                position,
                performedAt: new Date(),
                isComplianceAlert: isLate
            }
        });

        return NextResponse.json({ success: true, rotation: newRotation, pointsDelta });

    } catch (error) {
        console.error("Postural Change Route Error:", error);
        return NextResponse.json({ success: false, error: "Error interno procesando el cambio postural (UPP)." }, { status: 500 });
    }
}
