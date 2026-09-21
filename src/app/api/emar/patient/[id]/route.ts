import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { withPhiAccessLog } from '@/lib/phi-audit';
import { startOfWeek, endOfWeek } from 'date-fns';

// SOCIAL_WORKER lee el eMAR del residente (read-only). No tiene write —
// el archivo solo expone GET. La administración de meds vive en
// /api/care/meds/bulk y /api/emar/route.ts (escritura), donde SW NO está.
const ALLOWED_ROLES = ['CAREGIVER', 'NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN', 'SOCIAL_WORKER'];

// PHI audit (Pilar 1) — lectura del eMAR del residente.
export const GET = withPhiAccessLog(getEmarPatientHandler, {
    resourceType: 'eMAR',
    getPatientId: async ({ params }) => (await params).id,
});

async function getEmarPatientHandler(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;

        const { id } = await params;

        // Tenant check HIPAA — el eMAR del residente solo si es de tu sede
        // (antes: solo if(!session) → cualquiera leía el eMAR por patientId).
        const patient = await prisma.patient.findUnique({ where: { id }, select: { headquartersId: true } });
        if (!patient || patient.headquartersId !== auth.headquartersId) {
            return NextResponse.json({ error: 'Residente fuera de tu sede' }, { status: 403 });
        }

        // 1. Obtener los medicamentos activos del residente
        const patientMeds = await prisma.patientMedication.findMany({
            where: {
                patientId: id,
                OR: [
                    { isActive: true },
                    { status: "DRAFT" }
                ]
            },
            include: {
                medication: true,
                /**
                 * EL "HISTORIAL RECIENTE" ORDENABA POR UN CAMPO NULO.
                 *
                 * `administeredAt` es null en todo lo que no se administró, y en
                 * Postgres un `DESC` pone los nulos PRIMERO. Desde el 15-sep-2026,
                 * que es cuando el cron empezó a escribir filas PENDING de verdad,
                 * eso puso las dosis que todavía no tocan a la cabeza de la lista.
                 *
                 * La pantalla enseña las 5 primeras y pinta la hora con
                 * `format(new Date(log.administeredAt))` (PatientEMARTab.tsx:461):
                 * con null eso es la época, así que cada receta abría su historial
                 * con un **"Omitido · 31 dic, 20:00"** de una dosis que no se ha
                 * omitido. Medido contra producción el 21-sep-2026: 231 de las 241
                 * recetas activas de Cupey tenían la primera fila así, y 403 de las
                 * 1.160 filas visibles.
                 *
                 * Dos cambios: ordenar por `createdAt`, que siempre tiene valor, y
                 * dejar fuera las PENDING — esto es el historial de lo que PASÓ, y
                 * lo que falta por dar se trabaja en /care, no aquí. Con eso las
                 * filas rotas bajan de 403 a 112 y ninguna receta se queda sin
                 * historial (comprobado: 0 de 241).
                 *
                 * Las 112 que quedan son MISSED/OMITTED/REFUSED, que tampoco tienen
                 * `administeredAt` — esas ya solo las arregla la pantalla, dándoles
                 * la hora de `createdAt` o ninguna.
                 */
                administrations: {
                    where: { status: { in: ['ADMINISTERED', 'MISSED', 'OMITTED', 'REFUSED', 'HELD'] } },
                    orderBy: { createdAt: 'desc' },
                    take: 20 // Traer historial reciente
                }
            }
        });

        // 2. Adherencia semanal — sobre las dosis YA RESUELTAS de la semana.
        //
        // Acotaba por `administeredAt`, y ese campo está NULL en todo lo que no
        // se administró: meds/bulk lo escribe así a propósito (care/meds/bulk
        // /route.ts:274). El filtro dejaba fuera MISSED, OMITTED, REFUSED y
        // PENDING, o sea que numerador y denominador eran la MISMA fila y salía
        // 100% POR CONSTRUCCIÓN — no podía bajar nunca.
        //
        // Medido contra producción (Cupey, solo lectura, 21-sep-2026): las ocho
        // semanas desde el 27-jul daban 100%. Con este arreglo la del 14-sep da
        // 89% de verdad — 1.795 administradas de 2.027 resueltas, con 232 MISSED
        // que esta pantalla no enseñó nunca. Las otras siete siguen en 100%, pero
        // ya no por la fórmula: en producción no hay ni una fila MISSED anterior
        // al 15-sep-2026 y solo 3 OMITTED en toda la historia de la sede.
        //
        // Un aviso para quien compare esa semana con el panel de dirección: 77 de
        // aquellas 232 MISSED son de residentes que ya no estaban —fallecidos en
        // mayo y junio—, porque hasta el 17-sep el cron les seguía programando
        // dosis. Ya está corregido en emar-schedule.ts:181 y desde el 18-sep no
        // se creó ni una. Solo entre ACTIVE y TEMPORARY_LEAVE, la semana da 92%.
        //
        // `createdAt` es el ancla correcta: siempre tiene valor, y aquí nunca se
        // aleja del evento — sobre 13.866 filas desde el 27-jul, el registro
        // retroactivo más atrasado va 2,0 h por detrás y ninguno cruza un día.
        //
        // PERO no basta con cambiar el campo: por `createdAt` a secas entran las
        // PENDING al denominador y esta semana daría 3% (9 de 271) — el error
        // contrario. Una dosis PENDING no está fallada, es que todavía no toca.
        // El denominador es el de corporate/director-briefing:121 y
        // corporate/trends:200, más HELD, que aquí cuenta como dosis no dada
        // igual que en care/route.ts:223 y shift-closure-report.ts:340.
        //
        // Lo que NO se arregló: el corte de semana es el de date-fns sobre el
        // reloj del servidor, que en Vercel es UTC, así que la semana empieza el
        // domingo a las 8 PM AST. El 3,9% de las filas se crea en esa franja, y
        // por eso la misma semana del 14-sep medida en reloj AST da 88%
        // (1.742/1.974) en vez de 89%. Moverlo cambiaría a la vez esta pantalla
        // y el prefill de TS, y no hay helper semanal en src/lib/dates.ts.
        const DOSIS_RESUELTAS = ['ADMINISTERED', 'MISSED', 'OMITTED', 'REFUSED', 'HELD'] as const;

        const start = startOfWeek(new Date(), { weekStartsOn: 1 });
        const end = endOfWeek(new Date(), { weekStartsOn: 1 });

        // groupBy y no findMany: solo hacen falta los conteos, y así la consulta
        // devuelve cinco filas como mucho en vez de una por dosis, crezca lo que
        // crezca el volumen. Misma forma que corporate/exec-report:137.
        const porEstado = await prisma.medicationAdministration.groupBy({
            by: ['status'],
            where: {
                patientMedication: { patientId: id },
                createdAt: { gte: start, lte: end },
                status: { in: [...DOSIS_RESUELTAS] },
            },
            _count: { _all: true },
        });

        const totalResueltas = porEstado.reduce((n, r) => n + r._count._all, 0);
        const totalAdministered = porEstado.find((r) => r.status === 'ADMINISTERED')?._count._all ?? 0;

        // `null`, no 100%. Una semana sin dosis resueltas —residente recién
        // ingresado, o todo PENDING todavía— no es adherencia perfecta; el viejo
        // `= 100` era la misma mentira por otra vía.
        //
        // OJO, consumidor: `adherenceRate` puede venir null y eso NO es cero.
        // PatientEMARTab.tsx todavía no lo distingue (lo pinta en rojo, "Crítica").
        const adherenceRate = totalResueltas > 0
            ? Math.round((totalAdministered / totalResueltas) * 100)
            : null;

        return NextResponse.json({
            success: true,
            medications: patientMeds,
            adherenceRate: adherenceRate,
            weeklyLogsCount: totalResueltas
        });

    } catch (error) {
        console.error('Error fetching patient eMAR data:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
