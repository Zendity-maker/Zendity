import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { withPhiAccessLog } from '@/lib/phi-audit';

// PHI audit (Pilar 1) — lista de residentes: PatientList, sin patientId único.
export const GET = withPhiAccessLog(getPatientsListHandler, { resourceType: 'PatientList' });

async function getPatientsListHandler(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }

        const hqId = (session.user as any).headquartersId;

        // Por defecto solo activos y en licencia temporal: el calendario y la
        // admisión usan este mismo endpoint para elegir residente, y ahí un
        // fallecido no debe aparecer.
        //
        // El Directorio Global sí los necesita — pide ?incluirInactivos=1.
        // Tenía un botón "Residentes dados de baja" que filtraba sobre una
        // lista de la que el servidor ya los había quitado, así que salía
        // vacío siempre. En Cupey eso dejaba 11 expedientes inalcanzables:
        // 6 fallecidos y 5 dados de baja.
        const incluirInactivos = new URL(req.url).searchParams.get('incluirInactivos') === '1';
        const estados: ('ACTIVE' | 'TEMPORARY_LEAVE' | 'DISCHARGED' | 'DECEASED')[] = incluirInactivos
            ? ['ACTIVE', 'TEMPORARY_LEAVE', 'DISCHARGED', 'DECEASED']
            : ['ACTIVE', 'TEMPORARY_LEAVE'];

        const patients = await prisma.patient.findMany({
            where: {
                headquartersId: hqId,
                status: { in: estados }
            },
            orderBy: [
                { status: 'asc' }, // ACTIVE first
                { name: 'asc' }
            ]
        });

        // Format to simplify usage in the frontend table
        const formattedPatients = patients.map(p => ({
            id: p.id,
            name: p.name,
            status: p.status || 'ACTIVE',
            roomNumber: p.roomNumber || 'N/A',
            colorGroup: 'UNASSIGNED',
            clinicalRisk: p.downtonRisk ? 'HIGH' : 'MODERATE',
            leaveType: p.leaveType || null,
            photoUrl: p.photoUrl || null,
            joinDate: p.createdAt,
            dischargeDate: p.dischargeDate || null,
            dischargeReason: p.dischargeReason || null
        }));

        return NextResponse.json({ success: true, patients: formattedPatients });

    } catch (error: any) {
        console.error('Error fetching Master Patient Directory:', error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
