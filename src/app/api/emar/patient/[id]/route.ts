import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { withPhiAccessLog } from '@/lib/phi-audit';
import { startOfWeek, endOfWeek } from 'date-fns';

// SOCIAL_WORKER lee el eMAR del residente (read-only). No tiene write —
// el archivo solo expone GET. La administración de meds vive en
// /api/care/meds/bulk y /api/emar/route.ts (escritura), donde SW NO está.
const ALLOWED_ROLES = ['CAREGIVER', 'NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN', 'SOCIAL_WORKER'];

// PHI audit (Pilar 1) — lectura del eMAR del residente.
export const GET = withPhiAccessLog(getEmarPatientHandler, {
    resourceType: 'eMAR',
    getPatientId: async ({ params }) => (await params).id,
});

async function getEmarPatientHandler(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;

        const { id } = await params;

        // Tenant check HIPAA — el eMAR del residente solo si es de tu sede
        // (antes: solo if(!session) → cualquiera leía el eMAR por patientId).
        const patient = await prisma.patient.findUnique({ where: { id }, select: { headquartersId: true } });
        if (!patient || patient.headquartersId !== auth.headquartersId) {
            return NextResponse.json({ error: 'Residente fuera de tu sede' }, { status: 403 });
        }

        // 1. Obtener los medicamentos activos del residente
        const patientMeds = await prisma.patientMedication.findMany({
            where: {
                patientId: id,
                OR: [
                    { isActive: true },
                    { status: "DRAFT" }
                ]
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
                patientMedication: { patientId: id },
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
