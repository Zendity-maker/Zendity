import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { todayStartAST } from '@/lib/dates';

export const dynamic = 'force-dynamic';

/**
 * GET /api/care/shift/my-coverage
 *
 * Devuelve los residentes de cobertura asignados a este cuidador hoy
 * via ShiftPatientOverride (ausencias, redistribuciones).
 * Lo usa el briefing modal al inicio de sesión.
 */
export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }

        const userId = (session.user as any).id;
        const todayStart = todayStartAST();

        const overrides = await prisma.shiftPatientOverride.findMany({
            where: {
                caregiverId: userId,
                isActive: true,
                shiftDate: { gte: todayStart },
            },
            select: {
                originalColor: true,
                reason: true,
                patient: { select: { id: true, name: true, roomNumber: true, colorGroup: true } },
            },
            orderBy: { patient: { name: 'asc' } },
        });

        if (overrides.length === 0) {
            return NextResponse.json({ success: true, hasCoverage: false, patients: [], groups: [] });
        }

        // Agrupar por color original
        const byGroup: Record<string, { name: string; room: string }[]> = {};
        overrides.forEach(o => {
            const color = o.originalColor;
            if (!byGroup[color]) byGroup[color] = [];
            byGroup[color].push({
                name: o.patient.name,
                room: o.patient.roomNumber || '—',
            });
        });

        const groups = Object.entries(byGroup).map(([color, patients]) => ({ color, patients }));

        return NextResponse.json({
            success: true,
            hasCoverage: true,
            totalPatients: overrides.length,
            groups,
        });

    } catch (err) {
        console.error('[my-coverage]', err);
        return NextResponse.json({ success: false, error: 'Error' }, { status: 500 });
    }
}
