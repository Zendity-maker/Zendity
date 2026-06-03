import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { logError } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/care/supervisor/patients-lite
 *
 * Lista mínima de residentes ACTIVE/TEMPORARY_LEAVE del HQ del invocador.
 * Pensado para selectors (QuickActionsHub) — no incluye relaciones pesadas
 * como medications/vitalSigns/etc. para que cargue rápido.
 *
 * Auth: NURSE, SUPERVISOR, DIRECTOR, ADMIN.
 */
export async function GET() {
    try {
        const auth = await requireRole(['NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN']);
        if (auth instanceof NextResponse) return auth;
        const hqId = auth.headquartersId;

        const patients = await prisma.patient.findMany({
            where: {
                headquartersId: hqId,
                status: { in: ['ACTIVE', 'TEMPORARY_LEAVE'] as any },
            },
            select: { id: true, name: true, roomNumber: true, colorGroup: true, status: true },
            orderBy: { name: 'asc' },
        });

        return NextResponse.json({ success: true, patients });
    } catch (err: any) {
        logError('care.supervisor.patients-lite', err);
        return NextResponse.json({ success: false, error: 'Error cargando residentes' }, { status: 500 });
    }
}
