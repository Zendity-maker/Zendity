import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma, PhiAccessAction } from '@prisma/client';
import { requireRole } from '@/lib/api-auth';
import { withPhiAccessLog, logPhiAccess } from '@/lib/phi-audit';

// Sprint Coordinador Paso 4 (jun-2026): Cumplimiento de Contacto Familiar.
// Phase 1: motor + visual. Phase 2 (Zendy) usa estas mismas señales + citas
// próximas + quejas abiertas, pero NO se construye aquí.
const ALLOWED_ROLES = ['COORDINATOR', 'ADMIN', 'DIRECTOR', 'NURSE'];

// Threshold de "vencida" — hardcoded para v1. Si pasa más de N días desde la
// última conversación lograda (outcome=SPOKE), la familia se marca vencida.
// Decisión: 21 días = 3 semanas. Configurabilidad por sede = v3.
export const VENCIDA_THRESHOLD_DAYS = 21;

// PHI audit: el board lista PHI (nombres de residentes + última fecha de
// contacto). Wrap exterior + fila granular por cada residente listado.
export const GET = withPhiAccessLog(getComplianceBoardHandler, {
    resourceType: 'ComplianceBoard',
});

// Forma cruda que retorna $queryRaw — solo lo que el SQL produce.
interface RawRow {
    patientId:          string;
    lastSpokeAt:        Date | null;
    attemptsThisMonth:  bigint;        // Postgres COUNT regresa BIGINT
    lastAttemptOutcome: string | null;
}

async function getComplianceBoardHandler(_req: Request) {
    try {
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;
        const hqId = auth.headquartersId;

        // (1) Universo: residentes activos + en licencia temporal de la sede.
        //     DISCHARGED/DECEASED no entran al board.
        const patients = await prisma.patient.findMany({
            where: { headquartersId: hqId, status: { in: ['ACTIVE', 'TEMPORARY_LEAVE'] } },
            select: { id: true, name: true, roomNumber: true },
            orderBy: { name: 'asc' },
        });

        const total = patients.length;

        // Mes en curso (hora del servidor; AST/UTC mismo día calendario
        // para el rango operacional del piloto — single-tenant Cupey).
        const now         = new Date();
        const monthStart  = new Date(now.getFullYear(), now.getMonth(), 1);
        const daysElapsed = now.getDate();
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

        // (2) Single-shot $queryRaw con Prisma.sql template tag.
        //     Multi-tenant scoping via IN de patientIds (extraídos del
        //     findMany ya filtrado por hqId — defensa en profundidad: el
        //     IN no puede traer residentes de otras sedes).
        //
        //     - lastSpokeAt = MAX(contactedAt) FILTER (outcome=SPOKE) all-time.
        //       NO se filtra por mes en el WHERE exterior (rompe el days-since
        //       cuando el último SPOKE cae el mes anterior pero dentro de
        //       21 días). Tabla pequeña (~100s de filas a escala piloto)
        //       → cost de all-time es trivial.
        //     - attemptsThisMonth = COUNT FILTER con el filtro de mes
        //       DENTRO del FILTER (no en el WHERE) por la misma razón.
        //     - lastAttemptOutcome = outcome del intento más reciente del mes
        //       (puede ser NULL si no hubo intentos este mes).
        let aggregates: RawRow[] = [];
        if (patients.length > 0) {
            const ids = patients.map(p => p.id);
            aggregates = await prisma.$queryRaw<RawRow[]>(Prisma.sql`
                SELECT
                    p.id AS "patientId",
                    MAX(l."contactedAt") FILTER (WHERE l.outcome = 'SPOKE')                                 AS "lastSpokeAt",
                    COUNT(*) FILTER (
                        WHERE l.outcome IN ('VOICEMAIL', 'NO_ANSWER', 'WRONG_NUMBER')
                          AND l."contactedAt" >= ${monthStart}
                    ) AS "attemptsThisMonth",
                    (
                        SELECT l2.outcome
                        FROM "FamilyContactLog" l2
                        WHERE l2."patientId" = p.id
                          AND l2.outcome IN ('VOICEMAIL', 'NO_ANSWER', 'WRONG_NUMBER')
                          AND l2."contactedAt" >= ${monthStart}
                        ORDER BY l2."contactedAt" DESC
                        LIMIT 1
                    ) AS "lastAttemptOutcome"
                FROM "Patient" p
                LEFT JOIN "FamilyContactLog" l
                    ON l."patientId" = p.id
                   AND l."headquartersId" = ${hqId}
                WHERE p.id IN (${Prisma.join(ids)})
                GROUP BY p.id
            `);
        }

        // (3) Map agregados por patientId para join in-memory.
        const aggByPatient = new Map<string, RawRow>();
        aggregates.forEach(r => aggByPatient.set(r.patientId, r));

        // (4) Compute estado + daysSinceSpoke, ordenar vencida → pendiente → contactada.
        type Status = 'vencida' | 'pendiente' | 'contactada';
        const STATUS_ORDER: Record<Status, number> = { vencida: 0, pendiente: 1, contactada: 2 };

        const enriched = patients.map(p => {
            const a = aggByPatient.get(p.id);
            const lastSpokeAt = a?.lastSpokeAt ?? null;
            const daysSinceSpoke = lastSpokeAt
                ? Math.floor((now.getTime() - lastSpokeAt.getTime()) / (1000 * 60 * 60 * 24))
                : null;

            // Lógica de estado (lockeada, mismo criterio que la cinta KPI):
            //   never SPOKE         → vencida
            //   SPOKE este mes      → contactada
            //   SPOKE mes anterior + dentro de 21 días → pendiente
            //   SPOKE mes anterior + > 21 días         → vencida
            let status: Status;
            if (!lastSpokeAt) {
                status = 'vencida';
            } else if (lastSpokeAt >= monthStart) {
                status = 'contactada';
            } else if (daysSinceSpoke !== null && daysSinceSpoke > VENCIDA_THRESHOLD_DAYS) {
                status = 'vencida';
            } else {
                status = 'pendiente';
            }

            return {
                patientId:          p.id,
                name:               p.name,
                roomNumber:         p.roomNumber ?? null,
                status,
                lastSpokeAt:        lastSpokeAt ? lastSpokeAt.toISOString() : null,
                daysSinceSpoke,
                attemptsThisMonth:  Number(a?.attemptsThisMonth ?? 0),
                lastAttemptOutcome: a?.lastAttemptOutcome ?? null,
            };
        });

        // Order: vencidas → pendientes → contactadas. Dentro de cada grupo,
        // los más urgentes primero (más días sin contacto / NULL al inicio).
        enriched.sort((x, y) => {
            const so = STATUS_ORDER[x.status] - STATUS_ORDER[y.status];
            if (so !== 0) return so;
            // Mismo status → priorizar más días sin contacto (NULL = mayor urgencia).
            const xd = x.daysSinceSpoke ?? Infinity;
            const yd = y.daysSinceSpoke ?? Infinity;
            return yd - xd;
        });

        // KPI counters (uso enriched, single source of truth).
        const contactadas = enriched.filter(p => p.status === 'contactada').length;
        const pendientes  = enriched.filter(p => p.status === 'pendiente').length;
        const vencidas    = enriched.filter(p => p.status === 'vencida').length;

        // (5) PHI: UNA sola fila por carga del board.
        // El board es la home del coordinador → alta frecuencia (5×/día por
        // usuario × varios usuarios). Emitir N filas (una por residente)
        // inflaría PhiAccessLog ~30× por carga sin agregar valor forense —
        // la lista completa de patientIds del board cabe en `context` como
        // array auditable. Si el regulador pregunta "qué residentes vio
        // el actor a las T", una sola fila lo dice.
        // Trade-off explícito: el query "qué actor vio al residente X" ya
        // no es un equi-match en `patientId`; requiere un `context @> '...'`
        // sobre el JSONB. Aceptable para v1; los endpoints de detalle del
        // residente (perfil, llamadas, citas) sí emiten row-per-patient
        // y dan ese índice cuando importa.
        logPhiAccess({
            action:       PhiAccessAction.READ,
            resourceType: 'ComplianceBoard',
            resourceId:   null,
            patientId:    null,
            userId:       auth.id,
            userRole:     auth.role,
            hqId,
            success:      true,
            routePath:    '/api/coordinator/compliance-board',
            context: {
                patientIds: enriched.map(p => p.patientId),
                count:      enriched.length,
                kpi:        { contactadas, pendientes, vencidas },
            },
        });

        return NextResponse.json({
            success: true,
            kpi: {
                total,
                contactadas,
                pendientes,
                vencidas,
                daysElapsed,
                daysInMonth,
                vencidaThresholdDays: VENCIDA_THRESHOLD_DAYS,
            },
            patients: enriched,
        });
    } catch (e) {
        console.error('[coordinator/compliance-board GET]', (e as Error)?.message ?? 'unknown');
        return NextResponse.json({ success: false, error: 'Error al cargar el board' }, { status: 500 });
    }
}
