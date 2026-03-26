import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';



// Idealmente llamado por Vercel Cron cada 1 o 2 horas: 
// 0 */2 * * * (Ejemplo CRON)
export async function GET(req: Request) {
    // Seguridad Básica para Evitar Ejecuciones Públicas No Deseadas
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET || 'ZENDITY_CRON_LOCAL'}`) {
        return NextResponse.json({ error: 'Firma CRON Inválida' }, { status: 401 });
    }

    try {
        // Parametrización: Threshold de Compliance (2 Horas, convertidas a MS)
        const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
        const now = new Date();
        const limitTime = new Date(now.getTime() - TWO_HOURS_MS);

        // 1. Localizar residentes marcados como "Riesgo UPP / Encamados" 
        // y recuperar su último cambio postural.
        const atRiskPatients = await prisma.patient.findMany({
            where: {
                nortonRisk: true, // Switch habilitado desde Ficha Médica
            },
            include: {
                posturalChanges: {
                    orderBy: { performedAt: 'desc' },
                    take: 1
                }
            }
        });

        const violations = [];

        // 2. Auditar cada reloj.
        for (const patient of atRiskPatients) {
            const lastRotation = patient.posturalChanges[0];

            // Si no tiene registros O su último registro fue hace más de 2 horas.
            if (!lastRotation || lastRotation.performedAt < limitTime) {
                violations.push({
                    patientId: patient.id,
                    patientName: patient.name,
                    lastRotationTime: lastRotation ? lastRotation.performedAt : 'Ninguna',
                    hoursOverdue: lastRotation ? ((now.getTime() - lastRotation.performedAt.getTime()) / (1000 * 60 * 60)).toFixed(1) : 'Crítico (+24h)'
                });

                // Si detecta violación y el último LOG no estaba marcado como alerta, forzamos un LOG rojo
                if (!lastRotation || !lastRotation.isComplianceAlert) {
                    await prisma.posturalChangeLog.create({
                        data: {
                            patientId: patient.id,
                            nurseId: "system_cron", // Auditor Automático ID
                            position: "SISTEMA: VENCIMIENTO DE RELOJ POSTURAL",
                            isComplianceAlert: true,
                        }
                    });
                }
            }
        }

        return NextResponse.json({
            message: "Auditoría Automática de UPP Realizada.",
            scannedPatients: atRiskPatients.length,
            fatalViolationsDetected: violations.length,
            auditReport: violations
        });

    } catch (error) {
        console.error("CRON UPP Error:", error);
        return NextResponse.json({ error: 'Fallo interno al auditar residentes.' }, { status: 500 });
    } finally {
        await prisma.$disconnect();
    }
}
