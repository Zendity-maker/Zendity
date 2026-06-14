import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { logError } from '@/lib/logger';
import { staffFloorFilter } from '@/lib/floor';

export const dynamic = 'force-dynamic';

/**
 * GET /api/care/supervisor/patients-lite[?floor=N]
 *
 * Lista mínima de residentes ACTIVE/TEMPORARY_LEAVE del HQ del invocador.
 * Pensado para selectors (QuickActionsHub) — no incluye relaciones pesadas
 * como medications/vitalSigns/etc. para que cargue rápido.
 *
 * Auth: NURSE, SUPERVISOR, DIRECTOR, ADMIN.
 *
 * ─── SPRINT MULTI-FLOOR (jun-2026) ─────────────────────────────────────
 *
 * Filtro `?floor=` OPCIONAL — diseñado intencionalmente como filtro
 * post-fetch del consumer, NO como gate obligatorio:
 *
 *   • Sin `?floor=`: retorna TODOS los residentes activos del HQ. Esta es
 *     la respuesta default y NO debe cambiar — flujos de asignación
 *     cross-piso (ej. supervisor asignando emergencia cross-floor con flag)
 *     necesitan ver residentes de otro piso para poder seleccionarlos.
 *   • Con `?floor=1`: solo residentes del piso 1. Para selectors enfocados
 *     que el supervisor abre desde la sección del piso 1 del wall y solo
 *     quiere ver residentes de ese piso.
 *   • Con `?floor=ALL` o `?floor=` (vacío): equivalente a no filtrar.
 *   • Con `?floor=foo` o `?floor=0` (inválido): el helper `staffFloorFilter`
 *     lo rechaza defensivamente → equivale a no filtrar (no 422). El
 *     consumer recibe TODOS los residentes en lugar de un set vacío
 *     sospechoso — más seguro para el flujo de asignación.
 *
 * `floor` se incluye en cada item del response para que la UI muestre el
 * badge "Piso N" en los selectors y los flujos de asignación cross-piso
 * sepan a qué piso pertenece cada candidato.
 *
 * Nulls: residentes ACTIVE con `floor=null` (data anomaly) NO aparecen
 * cuando se pasa `?floor=N` (Prisma `floor: N` excluye null). Sí aparecen
 * en la respuesta default (sin filtro) — la red de seguridad para que la
 * UI pueda exponerlos en su sección 'Sin asignar' si quiere.
 */
export async function GET(req: Request) {
    try {
        const auth = await requireRole(['NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN']);
        if (auth instanceof NextResponse) return auth;
        const hqId = auth.headquartersId;

        const floorParam = new URL(req.url).searchParams.get('floor');
        const floorFilter = staffFloorFilter(floorParam);

        const patients = await prisma.patient.findMany({
            where: {
                headquartersId: hqId,
                status: { in: ['ACTIVE', 'TEMPORARY_LEAVE'] as any },
                ...floorFilter,
            },
            select: {
                id: true, name: true, roomNumber: true, colorGroup: true, status: true,
                floor: true,
            },
            orderBy: { name: 'asc' },
        });

        return NextResponse.json({ success: true, patients });
    } catch (err: any) {
        logError('care.supervisor.patients-lite', err);
        return NextResponse.json({ success: false, error: 'Error cargando residentes' }, { status: 500 });
    }
}
