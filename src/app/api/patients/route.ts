import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { resolveEffectiveHqId } from '@/lib/hq-resolver';
import { withPhiAccessLog } from '@/lib/phi-audit';

// Roles permitidos: cualquier staff que necesite la lista de residentes
const ALLOWED_ROLES = ['CAREGIVER', 'NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN', 'SOCIAL_WORKER'];

// PHI audit (Pilar 1) — directorio de residentes: PatientList, sin patientId único.
export const GET = withPhiAccessLog(getPatientsDirectoryHandler, { resourceType: 'PatientList' });

async function getPatientsDirectoryHandler(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }
        const invokerRole = (session.user as any).role;
        if (!ALLOWED_ROLES.includes(invokerRole)) {
            return NextResponse.json({ error: 'Rol no autorizado' }, { status: 403 });
        }

        // Acepta tanto ?hqId= como ?headquartersId= para compatibilidad
        const { searchParams } = new URL(request.url);
        const requestedHqId = searchParams.get('hqId') || searchParams.get('headquartersId');
        const hqId = await resolveEffectiveHqId(session, requestedHqId);

        const patients = await prisma.patient.findMany({
            where: { headquartersId: hqId, status: 'ACTIVE' },
            select: { id: true, name: true, roomNumber: true },
            orderBy: { name: 'asc' },
        });

        return NextResponse.json(patients);
    } catch (error) {
        console.error('GET /api/patients Error:', error);
        return NextResponse.json({ error: 'Failed to fetch patients' }, { status: 500 });
    }
}
