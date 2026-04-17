import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['CAREGIVER', 'NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN'];

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }
        const invokerId = (session.user as any).id;
        const invokerRole = (session.user as any).role;
        const invokerHqId = (session.user as any).headquartersId;

        if (!ALLOWED_ROLES.includes(invokerRole)) {
            return NextResponse.json({ success: false, error: 'Rol no autorizado para rotaciones posturales' }, { status: 403 });
        }

        const { patientId, caregiverId, position } = await req.json();

        if (!patientId || !caregiverId || !position) {
            return NextResponse.json({ success: false, error: "Faltan parámetros obligatorios para el cambio postural." }, { status: 400 });
        }

        // Tenant check: el paciente debe pertenecer a la sede del invocador
        const patient = await prisma.patient.findFirst({
            where: { id: patientId, headquartersId: invokerHqId },
            select: { id: true, headquartersId: true },
        });
        if (!patient) {
            return NextResponse.json({ success: false, error: 'Residente no encontrado en tu sede' }, { status: 404 });
        }

        // Integridad adicional: el caregiverId del body debe ser el invocador o alguien de la misma sede
        if (caregiverId !== invokerId) {
            const cg = await prisma.user.findUnique({ where: { id: caregiverId }, select: { headquartersId: true } });
            if (!cg || cg.headquartersId !== invokerHqId) {
                return NextResponse.json({ success: false, error: 'Cuidador inválido' }, { status: 403 });
            }
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

            // Si es un castigo, inyectamos incidente real con el headquartersId correcto del paciente
            if (pointsDelta < 0) {
                await prisma.incident.create({
                    data: {
                        patientId,
                        headquartersId: patient.headquartersId,
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
