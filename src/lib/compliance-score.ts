/**
 * LA FÓRMULA DEL Z-SCORE — un solo sitio, un solo dueño.
 *
 * Vivía dentro de un route handler (`/api/care/compliance-score`) y la
 * importaban un cron, dos endpoints de RRHH y el panel de la cuidadora. Un cron
 * importando un route handler es la señal de que estaba en el sitio equivocado.
 *
 * Este archivo ya tenía el nombre correcto y solo guardaba el clamp.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * QUIÉN ESCRIBE: SOLO EL CRON `sync-compliance`, y con un SET absoluto.
 *
 * Antes escribían nueve sitios con lógicas distintas y ganaba el último que
 * corriera. Peor: el propio cron leía el score, calculaba el delta y luego
 * hacía un increment sobre el valor VIVO — un read-modify-write con base
 * rancia, que no es idempotente y no converge. Eso explica que la fórmula diera
 * 46 para Yedaira y en la base hubiera un 0.
 *
 * Los demás dejan de escribir y pasan a REGISTRAR: un ScoreEvent es la huella
 * de que algo pasó, y la fórmula lo consume. El hecho lo escribe quien lo ve;
 * el número lo calcula uno solo.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * CUATRO ARREGLOS QUE VINIERON CON LA MUDANZA. Los cuatro salieron de la
 * auditoría del 10-sep-2026 y los cuatro castigaban a alguien sin razón:
 *
 * 1. EL DÍA EN CURSO SE CALCULABA EN UTC. `new Date().setHours(0,0,0,0)` en
 *    Vercel es 00:00 UTC = 20:00 AST del día anterior, no el corte de 6 AM que
 *    usa todo el resto del repo. A quien trabaja de 6pm a 6am le cobraba −10
 *    por "sesión sin cerrar" MIENTRAS estaba trabajando, casi todas las noches.
 *    Gobernaba tres consultas, no una. Ahora usa `clinicalDay()`.
 *
 * 2. SE PENALIZABA POR OBSERVACIONES EN `EXPLANATION_RECEIVED`, o sea antes de
 *    que el supervisor las aplicara. El empleado pagaba por haber contestado.
 *    Solo cuentan las APLICADAS.
 *
 * 3. `evaluationDelta` ERA EL ÚNICO TÉRMINO SIN TOPE, y el más pesado: rango
 *    real [−90, +30] sobre una base de 75. Cuatro evaluaciones bajas dejaban a
 *    alguien en 0, y el comentario de TOPE_NEGATIVOS prometía justo lo
 *    contrario — que siempre hay camino de vuelta. Topado como los demás.
 *
 * 4. El clamp vive aquí al lado y se aplica al final, no en un updateMany
 *    aparte que corría después y sin ser atómico.
 */
import { prisma } from '@/lib/prisma';
import { clinicalDay } from '@/lib/dates';

/** Tope del castigo por evaluaciones, como el resto de los negativos. */
export const TOPE_EVALUACIONES = 20;


/**
 * Restringe User.complianceScore al rango [0, 100].
 *
 * Llamar INMEDIATAMENTE después de cualquier `{ increment }` / `{ decrement }`
 * sobre `User.complianceScore`. Prisma no soporta clamp nativo, y dos increments
 * simultáneos pueden hacer que el score pase de 100 o caiga bajo 0.
 *
 * Idempotente y barata: dos updateMany con filtros `lt: 0` y `gt: 100`. Si el
 * valor ya está en rango, no hace nada.
 */
export async function clampComplianceScore(userId: string): Promise<void> {
    await prisma.user.updateMany({
        where: { id: userId, complianceScore: { lt: 0 } },
        data: { complianceScore: 0 },
    });
    await prisma.user.updateMany({
        where: { id: userId, complianceScore: { gt: 100 } },
        data: { complianceScore: 100 },
    });
}


/**
 * Función pura exportada — usada por el cron sync-compliance y el route de evaluación.
 */
export async function calculateDynamicScore(userId: string) {
    const sevenDaysAgo    = new Date(Date.now() - 7  * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo   = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    // ── Cobertura de Ronda (aplica solo a CAREGIVER) ──────────────────────
    // +10 si cobertura ≥ 90%, +5 si ≥ 70%, -10 si < 50% (y tiene grupo asignado)
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, headquartersId: true } });
    let roundBonus = 0;

    if (user?.role === 'CAREGIVER' && user.headquartersId) {
        const lastColorAssignment = await prisma.shiftColorAssignment.findFirst({
            where: { userId },
            orderBy: { assignedAt: 'desc' },
            select: { color: true }
        });
        const myColor = lastColorAssignment?.color;
        if (myColor) {
            const groupPatients = await prisma.patient.findMany({
                where: { headquartersId: user.headquartersId, status: 'ACTIVE', colorGroup: myColor as any },
                select: { id: true }
            });
            const groupIds = groupPatients.map(p => p.id);
            if (groupIds.length > 0) {
                const [bP, mP, rP, lP] = await Promise.all([
                    prisma.bathLog.findMany({ where: { caregiverId: userId, patientId: { in: groupIds }, timeLogged: { gte: sevenDaysAgo } }, select: { patientId: true }, distinct: ['patientId'] }),
                    prisma.mealLog.findMany({ where: { caregiverId: userId, patientId: { in: groupIds }, timeLogged: { gte: sevenDaysAgo } }, select: { patientId: true }, distinct: ['patientId'] }),
                    prisma.posturalChangeLog.findMany({ where: { nurseId: userId, patientId: { in: groupIds }, performedAt: { gte: sevenDaysAgo } }, select: { patientId: true }, distinct: ['patientId'] }),
                    prisma.dailyLog.findMany({ where: { authorId: userId, patientId: { in: groupIds }, createdAt: { gte: sevenDaysAgo } }, select: { patientId: true }, distinct: ['patientId'] }),
                ]);
                const attended = new Set([...bP, ...mP, ...rP, ...lP].map(r => r.patientId)).size;
                const coverage = (attended / groupIds.length) * 100;
                if (coverage >= 90)      roundBonus = +10;
                else if (coverage >= 70) roundBonus = +5;
                else if (coverage >= 50) roundBonus = 0;
                else                     roundBonus = -10; // ronda incompleta severa
            }
        }
    }

    // ── Positivos clínicos (últimos 7 días) ──
    const [rotationsOnTime, medsAdministered, preventiveAlerts] = await Promise.all([
        prisma.posturalChangeLog.count({
            where: { nurseId: userId, isComplianceAlert: false, performedAt: { gte: sevenDaysAgo } }
        }),
        prisma.medicationAdministration.count({
            where: { administeredById: userId, status: 'ADMINISTERED', administeredAt: { gte: sevenDaysAgo } }
        }),
        prisma.dailyLog.count({
            where: { authorId: userId, isClinicalAlert: true, notes: { contains: '[ACCIÓN PREVENTIVA' }, createdAt: { gte: sevenDaysAgo } }
        }),
    ]);

    /**
     * OMITIR BIEN DEJA DE COSTAR PUNTOS.
     *
     * Esta penalidad —8 puntos por omisión— nunca llegó a dispararse: filtraba
     * por `administeredAt >= hace 7 días` y una omisión guarda `administeredAt:
     * null`, así que la comparación jamás daba cierto. Estuvo contando cero
     * desde siempre.
     *
     * Y ARREGLAR EL FILTRO HABRÍA SIDO PEOR QUE DEJARLO ROTO. En 24 537
     * administraciones de Cupey hay TRES omisiones. Eso no es un hogar donde
     * nunca se omite: es un eMAR donde registrar la verdad salía caro. Encender
     * la penalidad habría puesto precio justo al acto de documentar.
     *
     * Peor todavía, estaba al revés: una dosis DOCUMENTADA como omitida costaba
     * 8 puntos, y una dosis que nadie registró nunca —`MISSED`— no cuesta nada,
     * ni aquí ni en ningún otro sitio. El incentivo apuntaba a callarse.
     *
     * Desde sep-2026 el motivo decide el estado (ver src/lib/omision-medicamento.ts),
     * así que además muchas de estas ya no son fallos de quien administra:
     * "el residente lo rechazó" es REFUSED y "indicación médica" es HELD.
     *
     * El número se sigue calculando —con el filtro correcto, para que sea
     * cierto— y se sigue enseñando en `details`. Lo que se quita es el castigo.
     * Hacer el dato veraz, no crear una métrica que castigue la conducta.
     */
    // ── Negativos clínicos (últimos 7 días) ──
    const [medsOmitted, rotationsLate, fastActionsFailed] = await Promise.all([
        prisma.medicationAdministration.count({
            where: { administeredById: userId, status: 'OMITTED', createdAt: { gte: sevenDaysAgo } }
        }),
        prisma.posturalChangeLog.count({
            where: { nurseId: userId, isComplianceAlert: true, performedAt: { gte: sevenDaysAgo } }
        }),
        prisma.fastActionAssignment.count({
            // Excluir NOTAS ([NOTA]) — son instrucciones sin penalización, no
            // tareas SLA. Doble defensa con el cron que ya no las marca FAILED.
            where: {
                caregiverId: userId,
                status: 'FAILED',
                createdAt: { gte: sevenDaysAgo },
                NOT: { description: { startsWith: '[NOTA]' } },
            }
        }),
    ]);

    // El corte del "día en curso": 6 AM AST, como todo el resto del repo.
    // Con setHours(0,0,0,0) en Vercel (TZ=UTC) esto era 20:00 AST del día
    // anterior, y a quien trabaja de noche le cobraba -10 por estar en turno.
    // Gobierna las TRES consultas de abajo, no solo la primera.
    const todayStart = clinicalDay().boundary6amUtc;

    // ── Sesiones no cerradas (últimos 14 días, excluye el día en curso) ──
    const unclosedSessions = await prisma.shiftSession.count({
        where: {
            caregiverId: userId,
            startTime: { gte: fourteenDaysAgo, lt: todayStart },
            actualEndTime: null,
        }
    });

    // ── Handovers no completados (sesiones ya cerradas pero sin handover, últimos 14 días) ──
    const incompleteHandovers = await prisma.shiftSession.count({
        where: {
            caregiverId: userId,
            startTime: { gte: fourteenDaysAgo, lt: todayStart },
            handoverCompleted: false,
            actualEndTime: { not: null },
        }
    });

    // ── Turnos en blanco: sesiones cerradas con CERO registros clínicos (últimos 14 días) ──
    // Se evalúan solo sesiones cerradas (actualEndTime != null) con duración ≥ 1h
    // para evitar penalizar aperturas accidentales.
    const closedSessionsForBlank = await prisma.shiftSession.findMany({
        where: {
            caregiverId: userId,
            startTime: { gte: fourteenDaysAgo, lt: todayStart },
            actualEndTime: { not: null },
        },
        select: { startTime: true, actualEndTime: true },
    });

    let blankShifts = 0;
    for (const session of closedSessionsForBlank) {
        const start = session.startTime;
        const end   = session.actualEndTime!;
        // Ignorar sesiones de menos de 1 hora (apertura accidental)
        const durationH = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        if (durationH < 1) continue;

        const [baths, meals, meds, rotations, logs] = await Promise.all([
            prisma.bathLog.count({ where: { caregiverId: userId, timeLogged:   { gte: start, lte: end } } }),
            prisma.mealLog.count({ where: { caregiverId: userId, timeLogged:   { gte: start, lte: end } } }),
            prisma.medicationAdministration.count({ where: { administeredById: userId, administeredAt: { gte: start, lte: end } } }),
            prisma.posturalChangeLog.count({ where: { nurseId: userId,         performedAt: { gte: start, lte: end } } }),
            prisma.dailyLog.count({ where: { authorId: userId,                 createdAt:   { gte: start, lte: end } } }),
        ]);

        if (baths + meals + meds + rotations + logs === 0) blankShifts++;
    }

    // ── Observaciones/Incidentes aplicados (últimos 90 días) ──
    // Sin filtro de pointsDeducted > 0 para no perder registros con null
    const appliedObservations = await prisma.incidentReport.findMany({
        where: {
            employeeId: userId,
            // Solo APLICADAS. EXPLANATION_RECEIVED es una observación a la que
            // el empleado YA contestó y que el supervisor todavía no ha
            // resuelto: penalizarla es cobrarle por haber contestado.
            status: 'APPLIED',
            OR: [
                { appliedAt: { gte: ninetyDaysAgo } },
                // Si appliedAt es null, usar createdAt como fallback
                { appliedAt: null, createdAt: { gte: ninetyDaysAgo } }
            ]
        },
        select: { pointsDeducted: true },
    });

    const rawObservationPenalty = appliedObservations.reduce(
        (sum, obs) => sum + (obs.pointsDeducted ?? 5), // default -5 si no tiene valor
        0
    );
    // Tope 20: las observaciones son señal de supervision, no una cuenta que
    // se acumula sin fondo. Sin tope, 18 observaciones valian -33 y por si
    // solas empujaban a una persona por debajo de 0, donde ninguna mejora
    // posterior se ve. Ver TOPE_NEGATIVOS abajo.
    const observationPenalty = Math.min(rawObservationPenalty, 20);

    // ── Evaluaciones del supervisor (últimos 90 días) ──
    const evaluations = await prisma.employeeEvaluation.findMany({
        where: {
            employeeId: userId,
            createdAt: { gte: ninetyDaysAgo }
        },
        select: { score: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 5 // máximo las últimas 5 evaluaciones
    });

    // La más reciente pesa doble, las demás pesan 1x
    let evaluationDelta = 0;
    evaluations.forEach((ev, idx) => {
        const weight = idx === 0 ? 2 : 1; // doble peso a la más reciente
        let delta = 0;
        if (ev.score >= 90)      delta = 5;
        else if (ev.score >= 80) delta = 2;
        else if (ev.score >= 70) delta = -3;
        else if (ev.score >= 60) delta = -8;
        else                     delta = -15;
        evaluationDelta += delta * weight;
    });
    // Topado en las dos direcciones, como el resto. Sin esto el rango real era
    // [-90, +30] sobre una base de 75: cuatro evaluaciones bajas dejaban a
    // alguien en 0, donde ninguna mejora posterior se ve. Era el único término
    // sin tope de toda la fórmula, y el más pesado.
    evaluationDelta = Math.max(-TOPE_EVALUACIONES, Math.min(TOPE_EVALUACIONES, evaluationDelta));

    // ── ScoreEvents extra (Academy, Photo, Mission, Vitals — excluye EVALUATION y SHIFT) ──
    //
    // FIX 2026-05-31: SHIFT excluido del array. Los ScoreEvents categoría SHIFT
    // los CREA este mismo cron (sync-compliance) como artefacto del recálculo
    // diario — son el EFECTO del cómputo, no una CAUSA independiente. Incluirlos
    // creaba un loop de doble penalización: el cron calcula raw=62 vs prev=75,
    // crea ScoreEvent SHIFT delta=-13; al día siguiente ese -13 entra otra vez
    // en extraScoreEvents y se vuelve a restar → score se hunde hasta 0. Kishany
    // Burgos cayó de 75 → 0 en ~8 días por esta razón sin que se justifique
    // operacionalmente. Excluirlos rompe el loop y deja la gráfica intacta
    // (los SHIFT events siguen existiendo, solo no contaminan el cálculo).
    //
    // Cap +15: educación + extras operacionales premian compromiso pero
    // no deben compensar penalizaciones clínicas (handovers, observaciones).
    const extraScoreEvents = await prisma.scoreEvent.findMany({
        where: {
            userId,
            createdAt: { gte: ninetyDaysAgo },
            category: { in: ['ACADEMY', 'PHOTO', 'MISSION', 'VITALS'] },
        },
        select: { delta: true },
    });
    const rawExtraDelta = extraScoreEvents.reduce((sum, e) => sum + e.delta, 0);
    // Cap a [-15, +15]: educación/misiones suman, pero los VITALS negativos
    // también están topados para no eclipsar las penalizaciones clínicas
    // estructurales (handovers, blank shifts) que son la señal real.
    const extraDelta = Math.max(-15, Math.min(rawExtraDelta, 15));

    // ── Cálculo final ──
    const rawPositives = (rotationsOnTime * 1.5) + (medsAdministered * 0.5) + (preventiveAlerts * 5);
    const positives    = Math.min(rawPositives, 15); // cap para evitar techo por volumen

    // TOPE_NEGATIVOS — los positivos siempre estuvieron topados en 15 y los
    // negativos no tenian tope. Eso hacia que una sola rotacion tardia (-8)
    // pesara mas que 190 rotaciones a tiempo, y que alguien cayera decenas de
    // puntos por debajo de 0 — donde el clamp lo esconde todo y ninguna mejora
    // vuelve a ser visible. El tope mantiene la penalizacion severa (puede
    // llevar de 75 a 40 por si sola) pero deja siempre camino de regreso.
    const rawNegatives =
        // medsOmitted NO entra: ver el comentario largo arriba. Una omisión
        // documentada es trabajo bien hecho, no una falta.
        (rotationsLate * 8) +
        (fastActionsFailed * 8) +
        (unclosedSessions * 10) +
        (incompleteHandovers * 10) +
        (blankShifts * 10);
    const negatives = Math.min(rawNegatives, 35);

    // Base 75 — score de 100 debe ganarse: eval alta + actividad + ronda completa + cero incidentes
    const raw   = 75 + positives - negatives - observationPenalty + evaluationDelta + extraDelta + roundBonus;
    const score = Math.max(0, Math.min(100, Math.round(raw)));

    return {
        score,
        breakdown: {
            base: 75,
            positives: Math.round(positives),
            negatives,
            // Crudos sin tope: el score se topa para que siempre haya camino de
            // regreso, pero el supervisor tiene que poder ver la severidad real.
            rawNegatives,
            rawObservationPenalty,
            observationPenalty,
            evaluationDelta,
            extraDelta,
            roundBonus,
            total: Math.round(raw),
            details: {
                rotationsOnTime,
                medsAdministered,
                preventiveAlerts,
                medsOmitted,
                rotationsLate,
                fastActionsFailed,
                unclosedSessions,
                incompleteHandovers,
                blankShifts,
                appliedObservationsCount: appliedObservations.length,
                evaluationsCount: evaluations.length,
                extraScoreEventsCount: extraScoreEvents.length,
            }
        }
    };
}
