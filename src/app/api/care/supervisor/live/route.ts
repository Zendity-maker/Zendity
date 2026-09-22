import { prisma } from '@/lib/prisma';
import { rotacionVencida, horasDesdeRotacion } from '@/lib/rotacion-upp';
import { NextResponse } from 'next/server';
import { todayStartAST } from '@/lib/dates';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { resolveEffectiveHqId } from '@/lib/hq-resolver';
import { logError } from '@/lib/logger';
import { Z_SCORE_VISIBLE } from '@/lib/z-score-visible';
import { eMARdeHoy, rangoDelDiaAST } from '@/lib/emar-dia';

const SUPERVISOR_ROLES = ['SUPERVISOR', 'DIRECTOR', 'ADMIN'];

export interface TriageTicket {
    id: string;
    sourceId: string;
    sourceType: string;
    category: string;
    title: string;
    description: string;
    patientId?: string | null;
    patientName: string;
    /** Quien lo reporto. Sin esto el supervisor lee una alerta sin saber de
     *  quien viene, y no puede preguntarle a nadie por ella. */
    authorId?: string | null;
    authorName?: string | null;
    authorRole?: string | null;
    /** Solo UPP_SLA: a quién hay que rotar. Es lo único que apaga esta alerta. */
    patientIdParaRotar?: string | null;
    /** Solo UPP_SLA: hora de la última rotación, para que la reaparición se explique. */
    ultimaRotacion?: string | null;
    urgency: string;
    createdAt: Date;
    items?: TriageTicket[];
}

// FASE 2: Control Estricto de Caché en Rutas Dinámicas
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }
        // Cierre de agujero de seguridad: antes este endpoint solo validaba
        // sesión, así cualquier usuario (CAREGIVER, NURSE, FAMILY) podía leer
        // toda la telemetría operacional del supervisor llamando a /live.
        const role = (session.user as any).role;
        if (!SUPERVISOR_ROLES.includes(role)) {
            return NextResponse.json({ success: false, error: 'Rol no autorizado' }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        const requestedHqId = searchParams.get('hqId');

        let hqId: string;
        try {
            hqId = await resolveEffectiveHqId(session, requestedHqId);
        } catch (e: any) {
            return NextResponse.json({ success: false, error: e.message || 'Sede inválida' }, { status: 400 });
        }

        // FIX timezone: ventana rodante de 24h en vez de "medianoche UTC del servidor",
        // que deja el dashboard vacío cada noche cuando UTC cruza 00:00.
        const todayStart = todayStartAST();
        const twelveHrsAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
        const fourteenHrsAgo = new Date(Date.now() - 14 * 60 * 60 * 1000);

        /**
         * LOS TRES ÚLTIMOS TURNOS — no "hoy".
         *
         * La tarjeta de relevos acotaba con `createdAt >= todayStart`, el corte
         * de las 6:00 AM AST. Pero el turno de noche entrega ANTES de esa hora:
         * medido en 30 días, 36 relevos se firmaron entre medianoche y las 6 AM,
         * los 36 etiquetados NIGHT, repartidos en 24 días distintos.
         *
         * Por la definición de día clínico de este repo esos relevos pertenecen
         * al día de AYER, así que a las 6:01 desaparecían de la tarjeta. El
         * supervisor que entra por la mañana no veía nunca lo que le acababa de
         * entregar la noche — y peor: la tarjeta podía decir "Día completo, todos
         * los handovers están firmados por ti" con los de la noche sin firmar y
         * fuera de la vista.
         *
         * El arreglo no es redefinir "hoy": es que la tarjeta deje de contar días
         * y pase a contar TURNOS. Lo que un supervisor necesita ver al entrar son
         * los tres turnos del ciclo, el suyo incluido, sin importar en qué lado
         * de las 6 AM cayeron.
         *
         * 26 horas = tres turnos de 8 más dos de margen para cierres tardíos.
         * Cubre el ciclo completo y nunca alcanza el mismo turno de antes de ayer.
         */
        const tresTurnosAtras = new Date(Date.now() - 26 * 60 * 60 * 1000);
        const twentyFourHrsAgo = new Date(Date.now() - 24 * 3600000);

        /**
         * Ventana ampliable SOLO para las alertas clínicas.
         *
         * El panel mira 24 horas, que es lo correcto para operación en tiempo
         * real. El efecto secundario es que lo que no se atendió el mismo día
         * se vuelve inalcanzable: al 28-ago-2026 había 9 alertas preventivas
         * abiertas de residentes activos —vómito, diarrea, poco apetito— la más
         * vieja de hace 80 días, y no existía ninguna pantalla desde la que
         * cerrarlas. No es que nadie quisiera: es que no se podían ver.
         *
         * Se amplía SOLO este feed y solo a petición. Incidentes y caídas se
         * quedan en 24 h a propósito: hay 121 penalidades automáticas de
         * rotación abiertas, y ampliar la ventana de incidentes inundaría el
         * panel con ellas.
         */
        const diasRaw = parseInt(new URL(req.url).searchParams.get('dias') ?? '1', 10);
        const dias = Number.isFinite(diasRaw) ? Math.min(90, Math.max(1, diasRaw)) : 1;
        const desdeAlertas = dias > 1
            ? new Date(Date.now() - dias * 86400000)
            : twentyFourHrsAgo;
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600000);
        // Ventana de zombies: sesiones sin cerrar de los últimos 7 días.
        // Independiente de la ventana de 14h de activeSessions para asegurar
        // que turnos viejos (>14h) sigan visibles en el panel del supervisor
        // y puedan ser cerrados. Antes los zombies >14h se volvían invisibles.
        const zombieWindowStart = sevenDaysAgo;

        // ── Turno clínico activo según hora local AST (America/Puerto_Rico) ──
        // MORNING 6-13 · EVENING 14-21 · NIGHT 22-5
        const astFmt = new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/Puerto_Rico' });
        const astHour = parseInt(astFmt.format(new Date()), 10) % 24;
        const currentShift: 'MORNING' | 'EVENING' | 'NIGHT' =
            astHour >= 6 && astHour < 14 ? 'MORNING'
            : astHour >= 14 && astHour < 22 ? 'EVENING'
            : 'NIGHT';
        // La ventana horaria del turno ([6,14] / [14,22] / [22,30]) se usaba
        // solo para repartir las dosis del turno entre numerador y denominador
        // del porcentaje. Ese porcentaje se fue el 21-sep-2026 y con él la
        // aritmética de franjas: contar dosis SIN DAR no necesita saber en qué
        // hora caía cada una. `currentShift` sigue, que es lo que la pantalla
        // usa para rotular el turno activo.

        // ============================================================================
        // PROMISE.ALL CONCURRENTE — 16 consultas por ciclo.
        //
        // Eran 22 hasta el 21-sep-2026. El recorte quitó siete que alimentaban
        // bloques que no podían decir nada (ver cada `(Removida)` más abajo),
        // fusionó las dos de medicamentos en un groupBy, y añadió una: el
        // `count` que le pone número al botón de alertas anteriores. Con poll
        // de 30 s, cada pestaña abierta pasó de ~2.640 consultas/hora a ~1.920.
        // ============================================================================
        const [
            activeSessions,
            zombieSessionsRaw,
            bathsToday,
            mealsToday,
            pxWithUPP,
            briefing,
            activeFastActions,
            clinicalAlerts,
            alertasFueraDeVentana,
            fallIncidents,
            lastBriefingEver,
            vitalsOrdersToday,
            dosisDelDiaPorEstado,
            handoversTodayFull,
            // ── Tickets referidos a enfermería hoy (para filtrarlos del feed) ──
            referredTodayLogs,
            // ── Historial de acciones del Inbox hoy ──
            inboxHistoryLogs,
        ] = await Promise.all([
            // 1. Cuidadores Activos — ventana rodante de 14h para incluir turnos
            //    NIGHT que arrancaron antes del día clínico actual y sesiones que
            //    iniciaron 16 min antes de las 6am AST. Antes usaba gte: todayStart
            //    (6am AST) y dejaba fuera al NIGHT vivo.
            prisma.shiftSession.findMany({ where: { headquartersId: hqId, actualEndTime: null, startTime: { gte: fourteenHrsAgo } }, include: { caregiver: { select: { id: true, name: true, role: true, complianceScore: true } } } }),
            // 1b. Sesiones zombies — turnos sin cerrar de los últimos 7 días.
            // Sin filtro de 14h para que los olvidos viejos sigan visibles
            // en el panel del supervisor y puedan ser cerrados manualmente.
            prisma.shiftSession.findMany({
                where: {
                    headquartersId: hqId,
                    actualEndTime: null,
                    startTime: { gte: zombieWindowStart, lt: twelveHrsAgo },
                },
                include: { caregiver: { select: { id: true, name: true, role: true } } },
                orderBy: { startTime: 'asc' },
            }),
            // 2. Progreso de Baños
            prisma.bathLog.count({ where: { timeLogged: { gte: todayStart }, patient: { headquartersId: hqId } } }),
            // 3. Progreso de Comidas
            prisma.mealLog.groupBy({ by: ['mealType'], where: { timeLogged: { gte: todayStart }, patient: { headquartersId: hqId } }, _count: { mealType: true } }),
            // 4-6. (Removidas el 21-sep-2026) Incidentes del día, incidentes de
            //      las últimas 24 h para el feed, y quejas PENDING.
            //
            //      `Incident` tiene CERO filas: no en Cupey — en toda la base.
            //      El KPI "Incidentes" era el único tile con tono de peligro y
            //      pulso, y su condición `> 0` no se cumplió jamás. Las caídas,
            //      que es lo que se creía contar ahí, viven en `FallIncident`
            //      (query 13) y ya entran al feed por su propio camino.
            //
            //      `Complaint PENDING` salía en el payload como
            //      `pendingComplaints` y `liveStats.triageInbox`, y ninguno de
            //      los dos se leía en page.tsx. Los señalamientos de familia se
            //      sacaron de este panel a propósito (ver la nota larga abajo):
            //      se resuelven en dirección, no en el turno. Hoy hay 0 PENDING.
            // 7. Pacientes con UPP Activas — solo los que están en la sede (no TEMPORARY_LEAVE)
            prisma.patient.findMany({ where: { headquartersId: hqId, status: 'ACTIVE', pressureUlcers: { some: { status: 'ACTIVE' } } }, include: { posturalChanges: { orderBy: { performedAt: 'desc' }, take: 1 } } }),
            // 8. Zendi Morning Briefing — Sprint L: solo el prólogo del cron (isDailyPrologue=true)
            prisma.shiftHandover.findFirst({ where: { headquartersId: hqId, shiftType: 'MORNING', isDailyPrologue: true, createdAt: { gte: todayStart }, aiSummaryReport: { not: null } }, orderBy: { createdAt: 'desc' } }),
            // 9-10. (Removidos) Schedules ShiftSchedule legacy + Handovers para missingHandovers.
            //       Tabla legacy sin datos en prod; pendiente re-implementación contra ScheduledShift.
            // 11. Fast Actions Activas
            prisma.fastActionAssignment.findMany({ where: { headquartersId: hqId, status: 'PENDING', expiresAt: { gt: new Date() } }, include: { caregiver: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' } }),
            // 12. Alertas Clínicas del Action Hub (DailyLog isClinicalAlert, últimas 24h).
            //     isResolved:false — antes no se filtraba porque nada las resolvía.
            // Solo residentes ACTIVE — los que están en TEMPORARY_LEAVE no generan alertas de vulnerabilidad
            prisma.dailyLog.findMany({ where: { patient: { headquartersId: hqId, status: 'ACTIVE' }, isClinicalAlert: true, isResolved: false, createdAt: { gte: desdeAlertas } }, include: { patient: { select: { id: true, name: true, colorGroup: true } }, author: { select: { id: true, name: true, role: true } } }, orderBy: { createdAt: 'desc' }, take: 20 }),
            /**
             * CUÁNTAS ALERTAS QUEDAN FUERA DE LA VENTANA. El número del botón.
             *
             * El botón "Ver alertas anteriores" era gris, `text-xs`, `ml-auto`
             * y SIN NÚMERO, al lado de pestañas que sí llevaban contador. Y
             * detrás de él estaba todo: en Cupey hay 11 alertas clínicas
             * abiertas de residentes activos, la más vieja de hace 26 días, y
             * CERO en las últimas 24 horas. Con la ventana por defecto el Inbox
             * sale vacío y las 11 solo se ven pulsando un botón que no promete
             * nada. Un botón que no promete nada no se pulsa.
             *
             * Se cuenta lo que queda FUERA de la ventana vigente, así que al
             * ampliar a 90 días el número baja a 0 solo y el botón deja de
             * ofrecer lo que ya está en pantalla.
             */
            prisma.dailyLog.count({
                where: {
                    patient: { headquartersId: hqId, status: 'ACTIVE' },
                    isClinicalAlert: true,
                    isResolved: false,
                    createdAt: { lt: desdeAlertas },
                },
            }),
            // 13. Caídas recientes (FallIncident — NO Incident genérico) — solo residentes presentes
            prisma.fallIncident.findMany({
                where: { patient: { headquartersId: hqId, status: 'ACTIVE' }, incidentDate: { gte: twentyFourHrsAgo }, resolvedAt: null },
                include: { patient: { select: { id: true, name: true, colorGroup: true } } },
                orderBy: { incidentDate: 'desc' },
                take: 10,
            }),
            // 14. Último handover con briefing AI (sin filtro de fecha) — para el estado vacío
            prisma.shiftHandover.findFirst({
                where: { headquartersId: hqId, aiSummaryReport: { not: null } },
                orderBy: { createdAt: 'desc' },
                select: { createdAt: true },
            }),
            // ── Sprint K #15: Vitales de entrada automáticos del día (autoCreated ventana 4h)
            prisma.vitalsOrder.findMany({
                where: { headquartersId: hqId, autoCreated: true, orderedAt: { gte: todayStart } },
                include: {
                    patient: { select: { id: true, name: true, colorGroup: true } },
                    caregiver: { select: { id: true, name: true } },
                },
                orderBy: { orderedAt: 'desc' },
            }),
            /**
             * LAS DOSIS DEL DÍA CLÍNICO, POR ESTADO. Un solo groupBy.
             *
             * Sustituye a dos consultas: la lista completa de administraciones
             * del día y la de `PatientMedication` activos que servía de
             * denominador para el porcentaje del turno. Ese porcentaje se fue
             * el 21-sep-2026 (ver `dosisSinDar` en el payload).
             *
             * TRES DECISIONES, y las tres están medidas:
             *
             * 1) Se acota por `createdAt`, no por `administeredAt` ni
             *    `scheduledTime`. Esos dos son nulos justo en las filas que
             *    importan —`administeredAt` siempre que el estado no sea
             *    ADMINISTERED, `scheduledTime` en las 7.018 filas de los
             *    últimos 30 días— así que filtrar por ellos excluye en silencio
             *    las omisiones, que es lo único que se quiere contar aquí.
             *
             * 2) `patient.status: 'ACTIVE'`. Sin este filtro salen 232 no
             *    administradas en 7 días; con él, 145. Las 87 de diferencia son
             *    de residentes que ya no están —el caso de Isidra E. Beaton,
             *    ingresada en el hospital desde el 9-sep, con 13 dosis
             *    materializadas que nadie del hogar podía dar—. Una dosis no
             *    dada de quien no estaba aquí no es una omisión del piso.
             *
             * 3) El groupBy devuelve TODOS los estados, no solo los no dados.
             *    Hace falta el resto para que el número tenga de dónde salir:
             *    "6 sin dar de 271" se entiende, "6" solo, no.
             */
            prisma.medicationAdministration.groupBy({
                by: ['status'],
                where: {
                    patientMedication: { patient: { headquartersId: hqId, status: 'ACTIVE' } },
                    // Por la FECHA DE LA DOSIS, no por la de escritura. Ver src/lib/emar-dia.ts.
                    ...eMARdeHoy(),
                },
                _count: { status: true },
            }),
            // ── Sprint K #18 + Sprint L: Handovers individuales de cuidadores hoy
            // (isDailyPrologue=false para excluir el prólogo del cron; incluye colorGroups y notas)
            prisma.shiftHandover.findMany({
                where: { headquartersId: hqId, createdAt: { gte: tresTurnosAtras }, isDailyPrologue: false, signature: { not: null } },
                include: {
                    outgoingNurse: { select: { id: true, name: true } },
                    incomingNurse: { select: { id: true, name: true } },
                    supervisorSigned: { select: { id: true, name: true } },
                    _count: { select: { notes: true } },
                },
                orderBy: { createdAt: 'desc' },
                /**
                 * 40, no 20, desde el 21-sep-2026.
                 *
                 * Este feed dejó de ser solo una lista: el parte de los tres
                 * turnos se deriva de él, y de ahí salen el chip rojo "N turnos
                 * sin entrega" y el badge "Ciclo completo ✓". El `orderBy` es
                 * DESC, así que lo que se cae por el `take` es SIEMPRE el turno
                 * más viejo de la ventana — justo el que entonces se acusaría de
                 * no haber entregado.
                 *
                 * Medido sobre 30 días en Cupey: 247 relevos firmados, y el
                 * máximo en cualquier ventana de 26 h fue 16. Con 20 quedaban
                 * cuatro de margen y un día de equipo grande convertía el tope
                 * en una acusación falsa al piso. 40 dobla el peor caso medido.
                 */
                take: 40,
            }),
            /**
             * (Removidas el 21-sep-2026) IncidentReport de 7 días y rondas de
             * inspección del día.
             *
             * RRHH SALE DE LA PANTALLA DEL PISO. Los `IncidentReport`
             * alimentaban "Observaciones de Personal" y "Apelaciones Activas".
             * Nada de eso se resuelve en una o dos horas, que es el criterio de
             * este panel: una apelación se lee, se contesta por escrito y se
             * resuelve en dirección. Su sitio es /hr.
             *
             * *** LO QUE /hr TIENE QUE RECIBIR ARREGLADO: la consulta de
             * apelaciones que vivía aquí NO filtraba por empleado activo. Las
             * 2 apelaciones abiertas de Cupey son las dos de Zuleyka Valcárcel,
             * que tiene isActive:false e isDeleted:true. De las 8 observaciones
             * de los últimos 7 días, 5 son de empleadas ya inactivas. Si el
             * bloque se muda sin `employee: { isActive: true }`, el fallo se
             * muda con él y /hr le pedirá a alguien que gestione a gente que ya
             * no trabaja aquí. Es el antipatrón 7 de CLAUDE.md. ***
             *
             * Las rondas de inspección están dormidas desde el 24-ago-2026 (ver
             * `rondasDeInspeccion` en src/lib/funciones-dormidas.ts): 75
             * registros, ninguno desde el 24 de julio. El chip que consumía
             * `roundsSummary` ya no se pinta, pero la consulta seguía saliendo
             * cada 30 segundos para contar filas de hace dos meses.
             */
            // ── Tickets referidos a enfermería hoy — para ocultarlos del feed
            prisma.systemAuditLog.findMany({
                where: {
                    headquartersId: hqId,
                    action: 'ESCALATED',
                    createdAt: { gte: todayStart },
                },
                select: { payloadChanges: true },
            }),
            // ── Historial de acciones del Inbox hoy (refs + voids) ──
            prisma.systemAuditLog.findMany({
                where: {
                    headquartersId: hqId,
                    action: { in: ['ESCALATED', 'VOIDED'] },
                    createdAt: { gte: todayStart },
                },
                select: { id: true, action: true, payloadChanges: true, createdAt: true },
                orderBy: { createdAt: 'desc' },
                take: 30,
            }),
        ]);

        // IDs de sourceId referidos a enfermería hoy → se excluyen del triageFeed
        const referredSourceIds = new Set<string>(
            referredTodayLogs
                .map((r: any) => {
                    const p = r.payloadChanges as any;
                    return p?.kind === 'REFERRED_TO_NURSING' ? p.sourceId : null;
                })
                .filter(Boolean)
        );

        // IDs de sourceId descartados (VOIDED) hoy → también se excluyen del triageFeed
        // Esto evita que los tickets computados (INCIDENT, CLINICAL_ALERT, UPP_SLA, ZENDI_*)
        // reaparezcan en el siguiente ciclo de polling después de ser descartados.
        const voidedSourceIds = new Set<string>();
        // Para clusters descartados (ZENDI_PX_CLUSTER), el sourceId es el patientId.
        // Guardamos también esos patientIds para suprimir TODOS los sub-tickets del residente hoy.
        const voidedPatientIds = new Set<string>();

        (inboxHistoryLogs as any[]).forEach((r: any) => {
            const p = r.payloadChanges as any;
            if (r.action === 'VOIDED' && p?.sourceId) {
                voidedSourceIds.add(p.sourceId);
                if (p.sourceType === 'ZENDI_PX_CLUSTER') {
                    // sourceId de un cluster = patientId → suprimir todos sus tickets individuales
                    voidedPatientIds.add(p.sourceId);
                }
            }
        });

        // ============================================================================
        // PROCESAMIENTO SINCRÓNICO (CPU) POST-DB
        // ============================================================================
        const triageFeed: TriageTicket[] = [];

        // Integrar Quejas (Family/Mantenimiento)
        // Los senalamientos de familia YA NO entran al panel del supervisor.
        //
        // Este panel es operacion en tiempo real: lo que se resuelve en el piso
        // en una o dos horas. Un senalamiento de familia no lo es — de los 5
        // abiertos en Cupey, uno era la norma de visitas, otro un asunto
        // clinico y otro una queja de conducta SOBRE una cuidadora. Ninguno se
        // arregla en el turno.
        //
        // La unica accion que el panel ofrecia era despacharlo a una cuidadora,
        // y eso esta medido: 8 completados frente a 22 vencidos sin atender.
        // No se le asigna a alguien algo que no esta en su mano resolver.
        //
        // El supervisor sigue siendo el canal de ENTRADA: recibe a la familia
        // y lo registra. Quien lo resuelve es direccion, en /corporate/senalamientos.
        //
        // (Aqui habia ademas una clasificacion por palabras clave —
        // 'mantenimiento', 'roto', 'foco', 'agua' — que en 6 senalamientos no
        // se activo ni una vez. Mantenimiento tiene su canal propio, con 110
        // incidentes registrados.)

        // Integrar Caídas reales (FallIncident — NO el modelo Incident genérico)
        fallIncidents.forEach((fi: any) => {
            const urg = fi.severity === 'SEVERE' || fi.severity === 'FATAL' ? 'INMINENTE'
                : fi.severity === 'MILD' ? 'ATENCION' : 'RUTINA';
            triageFeed.push({
                id: `fall_${fi.id}`,
                sourceId: fi.id,
                // 'FALL', no 'INCIDENT': una caida vive en FallIncident, otra
                // tabla. Marcadas ambas como INCIDENT, cerrar una caida habria
                // hecho un updateMany sobre Incident con un id que no existe
                // ahi — cero filas y ningun error. Fallo silencioso.
                sourceType: 'FALL',
                category: 'CLINICO_CRITICO',
                title: `Caída Reportada (${fi.severity})`,
                description: `${fi.location} — ${fi.interventions}${fi.notes ? ' · ' + fi.notes : ''}`,
                patientId: fi.patientId || null,
                patientName: fi.patient?.name || 'N/A',
                urgency: urg,
                createdAt: fi.incidentDate,
            });
        });

        // Aquí se integraban los tickets del modelo `Incident`. No entraba
        // ninguno: la tabla está vacía en las dos sedes y en toda la historia
        // de la base. Lo que sí llega al feed son las caídas de `FallIncident`,
        // justo arriba, y las alertas clínicas de `DailyLog`, justo abajo.

        // Integrar Alertas Clínicas del Action Hub (DailyLog isClinicalAlert)
        clinicalAlerts.forEach((log: any) => {
            const isUPP = (log.notes || '').includes('[ALERTA UPP');
            // El prefijo es lo que le da nombre propio al hallazgo. Sin esto
            // sale como "Alerta Clínica" y se pierde entre fiebres y caidas,
            // que es justo lo que el reporte venia a evitar.
            const isMed = (log.notes || '').includes('[MEDICAMENTO SIN ADMINISTRAR]');
            triageFeed.push({
                id: `clinical_${log.id}`,
                sourceId: log.id,
                sourceType: 'CLINICAL_ALERT',
                category: isMed ? 'MEDICAMENTO' : isUPP ? 'UPP_PIEL' : 'CLINICO_CRITICO',
                // El titulo ya no dice "(Cuidador)" fijo: lo escribe tanto una
                // cuidadora como una supervisora, y el rol real va abajo con el
                // nombre de quien reporto.
                title: isMed ? 'Medicamento sin administrar' : isUPP ? 'Alerta UPP / Piel' : 'Alerta Clínica',
                description: log.notes || 'Alerta clínica sin descripción',
                patientId: log.patient?.id || null,
                patientName: log.patient?.name || 'N/A',
                // Quien lo reporto. El dato ya se consultaba y no se pasaba al
                // feed, asi que el supervisor leia una alerta sin saber de
                // quien venia — y no podia preguntarle a nadie por ella.
                authorId: log.author?.id || null,
                authorName: log.author?.name || null,
                authorRole: log.author?.role || null,
                urgency: isUPP ? 'ATENCION' : 'ATENCION',
                createdAt: log.createdAt,
            });
        });

        // Integrar Alertas SLA de UPP Activas
        pxWithUPP.forEach(px => {
            const ultima = px.posturalChanges[0]?.performedAt ?? null;
            if (!rotacionVencida(ultima)) return;

            // El umbral sale de src/lib/rotacion-upp.ts para que el badge y
            // esta lista digan lo mismo. Antes el feed usaba 2.5 h y el badge
            // otra cosa, así que el número y la lista no cuadraban.
            const hrs = horasDesdeRotacion(ultima);
            // La hora de la ULTIMA rotacion, no solo cuantas horas van.
            //
            // Zuleyka completo esta tarea a las 18:21 y volvio a las 19:06. Era
            // correcto —no habia rotado a nadie entre medias— pero desde su
            // lado parecia que el sistema la ignoraba. Decir "sigue vencida
            // desde las 14:14" convierte la reaparicion en informacion en vez
            // de en un fallo aparente.
            const desde = ultima
                ? new Intl.DateTimeFormat('es-PR', {
                    hour: '2-digit', minute: '2-digit', hour12: false,
                    timeZone: 'America/Puerto_Rico',
                  }).format(ultima)
                : null;
            triageFeed.push({
                id: `upp_sla_${px.id}`,
                sourceId: px.id,
                sourceType: 'UPP_SLA',
                category: 'UPP_PIEL',
                title: 'SLA Clínico Vencido (Rotación UPP)',
                // El sourceId es el patientId — lo necesita la UI para llevar
                // directo a registrar la rotacion, que es lo unico que apaga
                // esta alerta.
                patientIdParaRotar: px.id,
                ultimaRotacion: desde,
                description: hrs === null
                    // Este caso antes desaparecía de la lista: el código exigía
                    // un último registro para poder comparar, así que quien
                    // nunca fue rotado no aparecía en ninguna parte.
                    ? `El paciente presenta UPP activa y NO tiene ningún registro de rotación. Requiere giro manual urgente.`
                    : `Última rotación a las ${desde}. Lleva ${hrs.toFixed(1)} h sin girar y tiene úlcera activa.`,
                patientId: px.id,
                patientName: px.name,
                urgency: hrs === null || hrs > 4 ? 'INMINENTE' : 'ATENCION',
                createdAt: new Date(),
            });
        });

        // SPRINT 4: Zendi ATC Poli-Incidente (Clustering Geográfico/Multidimensional)
        // Filtrar tickets ya referidos o descartados hoy antes de clusterizar
        const activeTriage = triageFeed.filter(t =>
            !referredSourceIds.has(t.sourceId) &&
            !voidedSourceIds.has(t.sourceId) &&
            // Si se descartó un cluster del paciente hoy, suprimir también sus tickets individuales
            !(t.patientId && voidedPatientIds.has(t.patientId))
        );

        const clusteredTriage: TriageTicket[] = [];
        const pxClusters: Record<string, TriageTicket[]> = {};

        activeTriage.forEach(t => {
            if (t.patientId) {
                if (!pxClusters[t.patientId]) pxClusters[t.patientId] = [];
                pxClusters[t.patientId].push(t);
            } else {
                clusteredTriage.push(t);
            }
        });

        Object.entries(pxClusters).forEach(([pId, tickets]) => {
            if (tickets.length > 1) { // Multi-incidente!
                const hasInminente = tickets.some(t => t.urgency === 'INMINENTE');
                const hasAtencion = tickets.some(t => t.urgency === 'ATENCION');
                const urg = hasInminente ? 'INMINENTE' : (hasAtencion ? 'ATENCION' : 'RUTINA');
                
                clusteredTriage.push({
                    id: `zendi_px_cluster_${pId}`,
                    sourceId: pId,
                    sourceType: 'ZENDI_PX_CLUSTER',
                    category: 'CLINICO_CRITICO',
                    title: `Alerta Multi-Vector Zendi (${tickets.length} Eventos)`,
                    description: `El residente ha acumulado vulnerabilidad en múltiples ejes concurrentes: ${tickets.map(t => t.category.replace('_', ' ')).join(', ')}. Sugiere intervención directiva.`,
                    patientId: pId,
                    patientName: tickets[0].patientName,
                    urgency: urg,
                    items: tickets,
                    createdAt: tickets[0].createdAt
                });
            } else {
                clusteredTriage.push(tickets[0]);
            }
        });

        // Sort y Agrupación Zendi
        const urgencyWeight = { 'INMINENTE': 3, 'ATENCION': 2, 'RUTINA': 1 };
        clusteredTriage.sort((a, b) => {
            const wA = urgencyWeight[a.urgency as keyof typeof urgencyWeight] || 0;
            const wB = urgencyWeight[b.urgency as keyof typeof urgencyWeight] || 0;
            if (wA !== wB) return wB - wA;
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });

        /**
         * Aquí había un apartado que agrupaba los tickets de MANTENIMIENTO en
         * uno solo ("Zendi agrupó N tickets operativos de fondo"). Se fue el
         * 21-sep-2026 porque ya no puede entrar ninguno: el único origen de esa
         * categoría era la clasificación por palabras clave de los
         * señalamientos, y esa se retiró cuando los señalamientos salieron del
         * panel. El grupo se alimentaba solo de lo que él mismo creaba.
         */
        const finalTriage: TriageTicket[] = clusteredTriage;

        /**
         * Aquí vivía `missingHandovers`, y era un ARRAY VACÍO LITERAL.
         *
         * Salía de `ShiftSchedule`, el modelo viejo sin datos (antipatrón 1 de
         * CLAUDE.md). El panel pintaba con él un chip "N brechas" y la sección
         * "Brechas — turnos cerrados sin handover" que ninguna supervisora ha
         * visto nunca con una sola fila dentro.
         *
         * Y arrastraba algo peor: el badge "Día completo ✓" exigía
         * `missingHandovers.length === 0`, que era verdad SIEMPRE. Así que "Día
         * completo, todos los handovers están firmados por ti" podía salir a
         * cien píxeles de la fila "Terminó sin que nadie entregara" del parte de
         * los tres turnos. Al quitar las brechas, esa condición se rehízo en
         * page.tsx sobre el parte, que sí puede ser falso.
         *
         * Lo que de verdad falta —un turno que acabó sin que nadie entregara— ya
         * se ve, con nombre y hora, en el parte de los tres últimos turnos, que
         * se deriva de `handoversFeed` y no de una tabla vacía.
         */

        // ====================================================================
        // SPRINT K — PROCESAMIENTO POST-DB
        // ====================================================================

        /**
         * ═══ LAS DOSIS QUE NO SE DIERON HOY ═══
         *
         * Lo que había aquí era el porcentaje de medicamentos del turno, y era
         * el número más grande de la pantalla: `text-6xl`. No podía significar
         * nada.
         *
         * Su denominador eran TODAS las dosis de las ocho horas del turno y su
         * numerador las dadas hasta ese segundo. A las 7:24 de la mañana —minuto
         * 84 de las 480 del turno— decía 0% EN ROJO, y lo diría todas las
         * mañanas de todos los días, sin que nadie hubiera hecho nada mal. Es el
         * mismo caso que la cobertura de comidas del panel del director que está
         * en CLAUDE.md: una alarma que no puede dejar de sonar.
         *
         * En su lugar va un número que SÍ puede llegar a cero, y que por eso
         * significa algo cuando no lo está. Medido en Cupey el 21-sep-2026,
         * día clínico a día clínico: 0, 8, 20, 25, 57, 11, 24. Se mueve, y
         * ninguna de esas dosis aparecía hasta hoy en pantalla alguna.
         *
         * Qué cuenta como "sin dar": los cuatro estados que el prólogo del cron
         * ya usa para lo mismo (src/app/api/cron/clinical-day-start:105).
         * MISSED lo escribe el sistema al vencer la ventana; OMITTED, REFUSED y
         * HELD los declara la cuidadora. Al piso le importan los cuatro: la
         * pregunta no es quién lo marcó, es qué residente no recibió su dosis.
         *
         * PENDING no entra, y esa es la diferencia con el porcentaje: una dosis
         * cuya hora todavía no ha llegado no es una omisión. Va aparte, como
         * contexto, para que el 0 de las 6 de la mañana se lea como lo que es
         * —el día acaba de empezar— y no como una pantalla vacía.
         */
        const DOSIS_SIN_DAR = ['MISSED', 'OMITTED', 'REFUSED', 'HELD'];
        const cuentaPorEstado = (estados: string[]) =>
            dosisDelDiaPorEstado
                .filter(g => estados.includes(g.status))
                .reduce((n, g) => n + (g._count?.status ?? 0), 0);

        const dosisSinDar = {
            sinDar: cuentaPorEstado(DOSIS_SIN_DAR),
            pendientes: cuentaPorEstado(['PENDING']),
            dadas: cuentaPorEstado(['ADMINISTERED']),
            totalDelDia: dosisDelDiaPorEstado.reduce((n, g) => n + (g._count?.status ?? 0), 0),
        };

        // — Vitales agrupadas por cuidador —
        type VitalsBucket = { caregiverId: string | null; caregiverName: string; pending: number; completedOnTime: number; completedLate: number; expired: number };
        const vitalsByCaregiver: Record<string, VitalsBucket> = {};
        vitalsOrdersToday.forEach(v => {
            const key = v.caregiverId || '__UNASSIGNED__';
            if (!vitalsByCaregiver[key]) {
                vitalsByCaregiver[key] = {
                    caregiverId: v.caregiverId,
                    caregiverName: v.caregiver?.name || 'Sin asignar',
                    pending: 0, completedOnTime: 0, completedLate: 0, expired: 0,
                };
            }
            const b = vitalsByCaregiver[key];
            if (v.status === 'PENDING') b.pending++;
            else if (v.status === 'COMPLETED_ON_TIME') b.completedOnTime++;
            else if (v.status === 'COMPLETED_LATE') b.completedLate++;
            else if (v.status === 'EXPIRED') b.expired++;
        });

        const vitalsTotals = vitalsOrdersToday.reduce((acc, v) => {
            acc.total++;
            if (v.status === 'PENDING') acc.pending++;
            else if (v.status === 'EXPIRED') acc.expired++;
            else if (v.status === 'COMPLETED_ON_TIME' || v.status === 'COMPLETED_LATE') acc.completed++;
            return acc;
        }, { total: 0, pending: 0, completed: 0, expired: 0 });

        // — Team scores (cuidadores activos + complianceScore) —
        const teamScores = activeSessions
            .filter(s => s.caregiver)
            .map(s => ({
                caregiverId: s.caregiverId,
                name: s.caregiver!.name,
                role: s.caregiver!.role,
                complianceScore: (s.caregiver as any).complianceScore ?? null,
            }))
            // El ORDEN sobrevivia a la bandera: la lista salia de peor a mejor
            // segun el numero invertido, asi que las que mas documentan
            // encabezaban algo que se lee como lista de problemas. Por nombre.
            .sort((a, b) => Z_SCORE_VISIBLE
                ? (a.complianceScore ?? 999) - (b.complianceScore ?? 999)
                : String(a.name ?? '').localeCompare(String(b.name ?? ''), 'es'));

        /**
         * Aquí se derivaban tres cosas que ya no se pintan y que salían de las
         * consultas removidas arriba: el resumen X/3 de rondas de inspección
         * (dormidas, sin una fila desde el 24-jul), el feed de observaciones de
         * personal y la lista de apelaciones. Los tres eran RRHH o función
         * dormida en una pantalla de piso.
         *
         * La consulta de apelaciones era además la que NO filtraba por empleado
         * activo — está dicho arriba, en la nota de lo removido, para que quien
         * la lleve a /hr la lleve arreglada.
         */

        // — Handovers feed (individuales por cuidador, sin el prólogo del cron) —
        // Cada fila es el reporte de una cuidadora con los colores que cubrió.
        // Estado derivado: PENDING_SUPERVISOR → SUPERVISOR_SIGNED.
        //
        // DEDUP: si una cuidadora cierra y reabre turno varias veces en el día
        // (mismo shiftType), genera múltiples ShiftHandover — el supervisor veía
        // "3 entregas del mismo turno". Colapsamos a la MÁS RECIENTE por
        // (outgoingNurseId + shiftType). La query ya viene orderBy createdAt desc,
        // así que el primero por clave es el último cierre. Los registros previos
        // NO se borran (auditoría/nómina intactas) — solo no se muestran como
        // relevos duplicados. dupCount expone cuántos cierres hubo.
        const seenHandoverKey = new Map<string, number>();
        const dedupedHandovers = handoversTodayFull.filter(h => {
            const key = `${h.outgoingNurseId}|${h.shiftType}`;
            const count = (seenHandoverKey.get(key) ?? 0) + 1;
            seenHandoverKey.set(key, count);
            return count === 1; // solo el primero (más reciente) por clave
        });
        const handoversFeed = dedupedHandovers.map(h => {
            const derivedStatus: 'PENDING_SUPERVISOR' | 'SUPERVISOR_SIGNED' =
                h.supervisorSignedAt ? 'SUPERVISOR_SIGNED' : 'PENDING_SUPERVISOR';
            return {
                id: h.id,
                shiftType: h.shiftType,
                status: h.status,
                derivedStatus,
                createdAt: h.createdAt,
                signedOutAt: h.signedOutAt,
                supervisorSignedAt: h.supervisorSignedAt,
                handoverCompleted: h.handoverCompleted,
                outgoingName: h.outgoingNurse?.name || null,
                outgoingId: h.outgoingNurseId,
                incomingName: h.incomingNurse?.name || null,
                supervisorName: h.supervisorSigned?.name || null,
                colorGroups: h.colorGroups || [],
                patientCount: h._count?.notes ?? 0,
                aiSummaryReport: h.aiSummaryReport || null,
                // Cuántos cierres hubo de este cuidador+turno hoy (1 = normal).
                // >1 indica re-cierres (cuidadora cerró y reabrió turno).
                dupCount: seenHandoverKey.get(`${h.outgoingNurseId}|${h.shiftType}`) ?? 1,
            };
        });

        // — Vitales feed plano (para la tarjeta de "Vitales de Entrada") —
        const vitalsFeed = vitalsOrdersToday.map(v => ({
            id: v.id,
            patientId: v.patientId,
            patientName: v.patient?.name || 'Paciente',
            colorGroup: v.patient?.colorGroup || null,
            caregiverId: v.caregiverId,
            caregiverName: v.caregiver?.name || null,
            status: v.status,
            orderedAt: v.orderedAt,
            expiresAt: v.expiresAt,
            completedAt: v.completedAt,
            penaltyApplied: v.penaltyApplied,
        }));

        /**
         * RONDAS DE INSPECCIÓN COMPLETADAS HOY, de 3.
         *
         * Va aquí y no en una consulta propia: el panel ya refresca, y el
         * contador que esto alimenta se quitó en agosto precisamente porque
         * corría una consulta cada 30 segundos. Colgarlo de lo que ya viaja
         * cuesta una consulta al refresco en vez de una cada medio minuto.
         *
         * SE CUENTA UNA RONDA COMPLETA, NO UNA EMPEZADA. Una ronda cubre los
         * DOS pisos —`handleSaveRound` manda las zonas de un piso a la vez—,
         * así que firmar solo el Piso 1 no es la ronda hecha. Contar por "al
         * menos una zona" habría dicho "3 de 3" con la mitad del edificio sin
         * mirar, y un contador que dice que está todo hecho cuando no lo está
         * es peor que no tener contador.
         *
         * Por día de calendario AST, que es como se piensa una ronda de las
         * 9:00, las 12:30 y las 17:30.
         */
        const { desde: inicioDiaAST, hasta: finDiaAST } = rangoDelDiaAST();
        const inspeccionesHoy = await prisma.zoneInspection.findMany({
            where: { headquartersId: hqId, createdAt: { gte: inicioDiaAST, lt: finDiaAST } },
            select: { roundType: true, floor: true },
        });
        const pisosPorRonda = new Map<string, Set<number>>();
        for (const i of inspeccionesHoy) {
            if (!pisosPorRonda.has(i.roundType)) pisosPorRonda.set(i.roundType, new Set());
            pisosPorRonda.get(i.roundType)!.add(i.floor);
        }
        const rondasCompletasHoy = [...pisosPorRonda.values()].filter(p => p.size >= 2).length;

        /**
         * LO QUE SE CONTESTÓ AL CERRAR TURNO, Y SOBRE TODO LO QUE NO SE PUDO.
         *
         * El cierre de turno pregunta desde el 21-sep-2026 por las dosis que
         * nadie resolvió, y guarda la respuesta en `ShiftHandover.justifications`.
         * Una de las respuestas es "No puedo garantizarlo", que a propósito NO
         * toca la dosis: no afirma que se dio ni que no.
         *
         * Esa respuesta necesitaba llegar a alguien. Sin esto se guardaba en un
         * JSON que el reporte del relevo imprime en prosa y nadie cuenta — o
         * sea, una duda honesta convertida en silencio, que es justo lo que el
         * cierre vino a quitar. Aquí sale como número y como lista corta para
         * el panel del supervisor, que es quien puede ir a mirarlo.
         *
         * El ancla es `createdAt` del relevo, que siempre tiene valor. Ver
         * CLAUDE.md § "la fecha por la que filtras está nula justo donde
         * importa".
         */
        const relevosDeHoy = await prisma.shiftHandover.findMany({
            where: { headquartersId: hqId, createdAt: { gte: todayStart } },
            // El select lleva lo que se lee. Antipatrón #9.
            select: {
                id: true,
                createdAt: true,
                justifications: true,
                outgoingNurse: { select: { name: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
        const sinGarantizar: { quien: string; hora: string; cuantas: number }[] = [];
        let dosisDeclaradasAlCerrar = 0;
        for (const r of relevosDeHoy) {
            const j = (r.justifications && typeof r.justifications === 'object')
                ? r.justifications as Record<string, string>
                : {};
            const claves = Object.entries(j).filter(([k]) => k.startsWith('meds:'));
            if (claves.length === 0) continue;
            dosisDeclaradasAlCerrar += claves.filter(([, v]) => v === 'SE_DIERON').length;
            const dudas = claves.filter(([, v]) => v === 'NO_PUEDO_GARANTIZAR').length;
            if (dudas > 0) {
                sinGarantizar.push({
                    quien: r.outgoingNurse?.name?.trim() || 'Cuidador(a)',
                    hora: r.createdAt.toLocaleTimeString('es-PR', {
                        timeZone: 'America/Puerto_Rico', hour: 'numeric', minute: '2-digit', hour12: true,
                    }),
                    cuantas: dudas,
                });
            }
        }

        return NextResponse.json({
            success: true,
            activeCaregivers: activeSessions.length,
            /** Rondas de inspección con los dos pisos firmados hoy, de 3. */
            rondasCompletasHoy,
            /**
             * Del cierre de turno. `sinGarantizar` es una lista corta de
             * "alguien dijo que no podía asegurarlo": no es una falta, es algo
             * que hay que ir a preguntar. `declaradasAlCerrar` deja ver cuánto
             * del cumplimiento del día se firmó en el cierre y no en su hora —
             * si ese número crece, el problema no es el registro, es el turno.
             */
            cierreDeTurno: {
                sinGarantizar,
                declaradasAlCerrar: dosisDeclaradasAlCerrar,
                relevosLeidos: relevosDeHoy.length,
            },
            liveStats: {
                baths: bathsToday,
                meals: mealsToday.reduce((acc, curr) => ({ ...acc, [curr.mealType]: curr._count.mealType }), {}),
                // `incidents` y `triageInbox` se fueron el 21-sep-2026 con sus
                // consultas: el primero contaba un modelo de cero filas, el
                // segundo no lo leía nadie en page.tsx.
            },
            activeSessions,
            // Sesiones zombies (>12h sin cerrar, hasta 7 días atrás) — visibles
            // en el panel para cerrar manualmente con ForceCloseShiftButton.
            zombieSessions: zombieSessionsRaw.map((s: any) => ({
                id: s.id,
                caregiverId: s.caregiverId,
                startTime: s.startTime,
                hoursOpen: Math.round((Date.now() - new Date(s.startTime).getTime()) / 360000) / 10,
                caregiver: s.caregiver
                    ? { id: s.caregiver.id, name: s.caregiver.name, role: s.caregiver.role }
                    : null,
            })),
            triageFeed: finalTriage,
            alertasFueraDeVentana,
            activeFastActions,
            // `fallIncidents` en crudo salía aquí y no lo leía nadie: las caídas
            // llegan a la pantalla por el triageFeed, ya clasificadas por
            // gravedad. Se consultan igual — solo no se duplican en el payload.
            morningBriefing: briefing?.aiSummaryReport || null,
            lastBriefingAt: lastBriefingEver?.createdAt?.toISOString() || null,
            // ── Sprint K — Mission Control payload ──
            currentShift,
            vitalsFeed,
            vitalsByCaregiver: Object.values(vitalsByCaregiver),
            vitalsTotals,
            // Sustituye a `medsProgress`, que era el porcentaje del turno. Ver
            // la nota larga de `dosisSinDar` arriba.
            dosisSinDar,
            teamScores,
            handoversFeed,
            inboxHistory: inboxHistoryLogs.map((log: any) => {
                const p = log.payloadChanges as any;
                return {
                    id: log.id,
                    action: log.action,
                    kind: p?.kind || log.action,
                    description: p?.description || p?.reason || '—',
                    reason: p?.reason || null,
                    sourceType: p?.sourceType || null,
                    createdAt: log.createdAt,
                };
            }),
        });

    } catch (error) {
        logError('care.supervisor.live.get', error);
        return NextResponse.json({ success: false, error: "Error obteniendo telemetría en vivo" }, { status: 500 });
    }
}
