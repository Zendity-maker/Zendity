import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { resolveEffectiveHqId } from '@/lib/hq-resolver';
import { computeShiftCoverage, inferShiftTypeFromAST, type ShiftT } from '@/lib/shift-coverage';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ALLOWED_ROLES = ['CAREGIVER', 'NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN', 'SUPER_ADMIN'];

/**
 * GET /api/care/shift/coverage?shiftType=MORNING|EVENING|NIGHT&hqId=...
 *
 * Thin wrapper sobre computeShiftCoverage (src/lib/shift-coverage.ts).
 * Reutilizado también por /api/care/shift/redistribute y el cron.
 */
export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }
        if (!ALLOWED_ROLES.includes(session.user.role)) {
            return NextResponse.json({ success: false, error: 'Rol no autorizado' }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        const requestedHqId = searchParams.get('hqId');
        const shiftTypeParam = searchParams.get('shiftType') as ShiftT | null;

        let hqId: string;
        try {
            hqId = await resolveEffectiveHqId(session, requestedHqId);
        } catch (e: any) {
            return NextResponse.json({ success: false, error: e.message || 'Sede inválida' }, { status: 400 });
        }

        const shiftType: ShiftT = shiftTypeParam && ['MORNING', 'EVENING', 'NIGHT'].includes(shiftTypeParam)
            ? shiftTypeParam
            : inferShiftTypeFromAST();

        const coverage = await computeShiftCoverage({ hqId, shiftType });

        return NextResponse.json({
            success: true,
            ...coverage,
            shiftStartUtc: coverage.shiftStartUtc.toISOString(),
            activeCaregiversCount: coverage.activeCaregivers.length,
        });
    } catch (error: any) {
        console.error('shift/coverage error:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Error calculando cobertura',
        }, { status: 500 });
    }
}
