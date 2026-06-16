import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { requireRole } from '@/lib/api-auth';
import { resolveEffectiveHqId } from '@/lib/hq-resolver';
import { inferShiftTypeFromAST, computeShiftCoverage, type ShiftT } from '@/lib/shift-coverage';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ALLOWED_ROLES = ['CAREGIVER', 'NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN', 'SUPER_ADMIN'];
const TIMEOUT_MS = 12000;

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
        // FASE 51 — alineación con shift/start: requireRole acepta primary OR
        // secondaryRoles. El check legacy (`ALLOWED_ROLES.includes(session.user.role)`)
        // rechazaba con 403 'Rol no autorizado' a cuidadoras dual-rol (ej.
        // SUPERVISOR + CAREGIVER) cuyo primary no estaba en la lista; el toast
        // aparecía como side-effect en el poll de cobertura del tablet.
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;

        // resolveEffectiveHqId todavía pide Session (no SessionUser); getServerSession
        // está cacheado por request en NextAuth, así que esta llamada extra es barata.
        const session = await getServerSession(authOptions);

        const { searchParams } = new URL(req.url);
        const requestedHqId = searchParams.get('hqId');
        const shiftTypeParam = searchParams.get('shiftType') as ShiftT | null;

        let hqId: string;
        try {
            hqId = await resolveEffectiveHqId(session!, requestedHqId);
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

        // Sprint floor-map — pasamos el colorFloorMap del HQ junto con la
        // cobertura para que el CoveragePickerModal pueda agrupar opciones
        // por piso derivado del color. SELECT mínimo (1 row, indexed PK).
        // Multi-tenant strict: SOLO el map de ESTE hqId.
        const [coverage, hqRow] = await Promise.all([
            withTimeout(
                computeShiftCoverage({ hqId, shiftType }),
                TIMEOUT_MS,
                'computeShiftCoverage'
            ),
            prisma.headquarters.findUnique({
                where: { id: hqId },
                select: { colorFloorMap: true },
            }),
        ]);

        return NextResponse.json({
            success: true,
            ...coverage,
            colorFloorMap: hqRow?.colorFloorMap ?? null,
        });

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
