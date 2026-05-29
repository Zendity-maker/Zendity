import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { requireRole } from '@/lib/api-auth';
import { resolveEffectiveHqId } from '@/lib/hq-resolver';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['DIRECTOR', 'ADMIN', 'SUPERVISOR'];

/**
 * GET /api/corporate/census?hqId=X
 *
 * Censo completo de residentes (ACTIVE + TEMPORARY_LEAVE) para el botón
 * "Generar Censo" del dashboard del director. Devuelve los campos que el PDF
 * necesita: nombre, habitación, fecha de nacimiento, grupo de color, plan
 * médico (+ número de póliza), número de Medicare, dieta y estado.
 *
 * Los números de plan/Medicare son datos sensibles — solo accesibles por
 * DIRECTOR/ADMIN/SUPERVISOR de la sede (requireRole + hqId de sesión).
 */
export async function GET(req: Request) {
    try {
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;
        const session = await getServerSession(authOptions);

        const { searchParams } = new URL(req.url);
        let hqId: string;
        try {
            hqId = await resolveEffectiveHqId(session!, searchParams.get('hqId'));
        } catch (e: any) {
            return NextResponse.json({ success: false, error: e.message || 'Sede inválida' }, { status: 400 });
        }

        const hq = await prisma.headquarters.findUnique({ where: { id: hqId }, select: { name: true } });

        const patients = await prisma.patient.findMany({
            where: { headquartersId: hqId, status: { in: ['ACTIVE', 'TEMPORARY_LEAVE'] } },
            select: {
                name: true,
                roomNumber: true,
                dateOfBirth: true,
                colorGroup: true,
                insurancePlanName: true,
                insurancePolicyNumber: true,
                medicareNumber: true,
                diet: true,
                status: true,
                leaveType: true,
            },
            orderBy: { roomNumber: 'asc' },
        });

        const census = patients.map(p => ({
            name: (p.name || '').trim(),
            roomNumber: p.roomNumber || '—',
            dateOfBirth: p.dateOfBirth ? p.dateOfBirth.toISOString() : null,
            colorGroup: p.colorGroup || 'UNASSIGNED',
            // .trim() — los nombres de plan tienen espacios sobrantes ("MCS ", "Triple-S Vital ")
            insurancePlanName: (p.insurancePlanName || '').trim() || null,
            insurancePolicyNumber: (p.insurancePolicyNumber || '').trim() || null,
            medicareNumber: (p.medicareNumber || '').trim() || null,
            diet: (p.diet || '').trim() || null,
            status: p.status,
            leaveType: p.leaveType || null,
        }));

        const activeCount = census.filter(c => c.status === 'ACTIVE').length;
        const leaveCount = census.filter(c => c.status === 'TEMPORARY_LEAVE').length;

        return NextResponse.json({
            success: true,
            hqName: hq?.name || 'Sede',
            total: census.length,
            activeCount,
            leaveCount,
            census,
        });
    } catch (error: any) {
        console.error('[corporate/census] error:', error);
        return NextResponse.json({ success: false, error: 'Error generando censo' }, { status: 500 });
    }
}
