import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { resolveEffectiveHqId } from '@/lib/hq-resolver';
import { calculateFacilityHealthScore } from '@/lib/facility-health';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/corporate/facility-health?hqId=...
 *
 * Devuelve el Facility Health Score (FHS) de una sede:
 * métrica de outcomes clínicos y operativos independiente
 * del complianceScore individual del personal.
 *
 * Roles: DIRECTOR, ADMIN, SUPERVISOR, INVESTOR
 */
export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }

        const ALLOWED = ['DIRECTOR', 'ADMIN', 'SUPERVISOR', 'INVESTOR'];
        if (!ALLOWED.includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: 'Acceso no permitido' }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        let hqId: string;
        try {
            hqId = await resolveEffectiveHqId(session, searchParams.get('hqId'));
        } catch {
            return NextResponse.json({ success: false, error: 'Sede inválida' }, { status: 400 });
        }

        const result = await calculateFacilityHealthScore(hqId);

        return NextResponse.json({ success: true, ...result });
    } catch (error: any) {
        console.error('[facility-health]', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
