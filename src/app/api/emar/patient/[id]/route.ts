import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { startOfWeek, endOfWeek } from 'date-fns';

export async function GET(req: Request, { params }: { params: { id: string } }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const patientId = params.id;

        // 1. Obtener los medicamentos activos del paciente
        const patientMeds = await prisma.patientMedication.findMany({
            where: {
                patientId: patientId,
                isActive: true
            },
            include: {
                medication: true,
                administrations: {
                    orderBy: { administeredAt: 'desc' },
                    take: 20 // Traer historial reciente
                }
            }
        });

        // 2. Calcular la Adherencia Semanal (Solo para dosis de esta semana)
        const start = startOfWeek(new Date(), { weekStartsOn: 1 });
        const end = endOfWeek(new Date(), { weekStartsOn: 1 });

        const weeklyLogs = await prisma.medicationAdministration.findMany({
            where: {
                patientMedication: { patientId: patientId },
                administeredAt: { gte: start, lte: end }
            }
        });

        const totalExpected = weeklyLogs.length;
        const totalAdministered = weeklyLogs.filter((log: any) => log.status === 'ADMINISTERED').length;

        let adherenceRate = 0;
        if (totalExpected > 0) {
            adherenceRate = Math.round((totalAdministered / totalExpected) * 100);
        } else {
            adherenceRate = 100; // Si no hay datos, asumimos 100% o N/A
        }

        return NextResponse.json({
            success: true,
            medications: patientMeds,
            adherenceRate: adherenceRate,
            weeklyLogsCount: totalExpected
        });

    } catch (error) {
        console.error('Error fetching patient eMAR data:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
