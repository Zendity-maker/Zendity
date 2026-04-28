import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { resolveEffectiveHqId } from '@/lib/hq-resolver';
import { inferShiftTypeFromAST, computeShiftCoverage, type ShiftT } from '@/lib/shift-coverage';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ALLOWED_ROLES = ['CAREGIVER', 'NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN', 'SUPER_ADMIN'];
const TIMEOUT_MS = 8000;

/**
 * Carrera contra reloj para queries lentas.
 * Nota: no cancela la query subyacente (Prisma no soporta cancelación),
 * pero sí libera el hilo de la respuesta HTTP rápido.
 */
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
    return Promise.race([
        p,
        new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error(`[coverage] ${label} timeout after ${ms}ms`)), ms)
        ),
    ]);
}

/**
 * GET /api/care/shift/coverage
 *
 * Retorna el estado de cobertura del turno actual (o el indicado en ?shiftType=).
 * Compara colores programados vs sesiones activas y detecta huecos.
 *
 * Query params:
 *   - shiftType?: MORNING | EVENING | NIGHT  (default: inferido por hora AST)
 *   - hqId?:      ignorado para roles limitados; requerido para SUPER_ADMIN/ADMIN
 *
 * Auth: CAREGIVER, NURSE, SUPERVISOR, DIRECTOR, ADMIN, SUPER_ADMIN
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
            return NextResponse.json(
                { success: false, error: e.message || 'Sede inválida' },
                { status: 400 }
            );
        }

        const shiftType: ShiftT =
            shiftTypeParam && ['MORNING', 'EVENING', 'NIGHT'].includes(shiftTypeParam)
                ? shiftTypeParam
                : inferShiftTypeFromAST();

        const coverage = await withTimeout(
            computeShiftCoverage({ hqId, shiftType }),
            TIMEOUT_MS,
            'computeShiftCoverage'
        );

        return NextResponse.json({ success: true, ...coverage });

    } catch (error: any) {
        console.error('[shift/coverage] error:', error);
        // Degradación elegante: el tablet consume `data.success` antes de usar
        // los campos; si es false, simplemente no muestra el panel de cobertura.
        return NextResponse.json(
            { success: false, error: error.message || 'Error calculando cobertura' },
            { status: 500 }
        );
    }
}
