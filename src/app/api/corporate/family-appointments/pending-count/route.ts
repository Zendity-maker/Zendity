import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/corporate/family-appointments/pending-count
 *
 * Citas familiares en PENDING para la sede del usuario. Alimenta el badge de
 * "Citas Familiares" en AppLayout.
 *
 * Por qué existe (17-ago-2026): las solicitudes de cita solo vivían como
 * notificación-evento en la campana, donde (a) se ahogaban entre cientos de
 * notificaciones operativas y (b) el cron health-monitor las marcaba leídas a
 * las 48h "para mantener el sistema limpio". Dos citas de una familiar pasaron
 * su fecha sin que nadie las autorizara. Un badge derivado de ESTADO
 * (status=PENDING) no se puede enterrar ni limpiar: existe mientras haya algo
 * pendiente de verdad.
 */
export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }

        const allowedRoles = ['DIRECTOR', 'ADMIN', 'SUPERVISOR', 'NURSE', 'COORDINATOR'];
        if (!allowedRoles.includes((session.user as any).role)) {
            return NextResponse.json({ count: 0 });
        }

        const hqId = (session.user as any).headquartersId;
        if (!hqId) return NextResponse.json({ count: 0 });

        const count = await prisma.familyAppointment.count({
            where: { headquartersId: hqId, status: 'PENDING' },
        });

        return NextResponse.json({ success: true, count });
    } catch (error) {
        console.error('[family-appointments/pending-count] Error:', error);
        return NextResponse.json({ success: false, count: 0 }, { status: 500 });
    }
}
