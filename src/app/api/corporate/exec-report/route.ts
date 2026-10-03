import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { requireRole } from '@/lib/api-auth';
import { resolveEffectiveHqId } from '@/lib/hq-resolver';
import { prisma } from '@/lib/prisma';
import { satisfaccion, periodoActual } from '@/lib/encuesta-familia';
import { esVitalCritico, esVitalAnomalo } from '@/lib/vitals-thresholds';
import { ladoDeRotacion } from '@/lib/posicion-rotacion';
import { formacionDeEquipo } from '@/lib/formacion';
import { enrolledResidentsWhere } from '@/lib/billable-residents';
import { todayStartAST } from '@/lib/dates';
import { eMARentre } from '@/lib/emar-dia';
/**
 * EL TIPO DEL PDF, IMPORTADO AQUI A PROPOSITO.
 *
 * El 03-oct-2026 se renombraron tres campos de esta respuesta y `tsc --noEmit`
 * paso limpio con el PDF leyendo `undefined` en los tres. El unico puente entre
 * los dos ficheros era `const data = await res.json()` en page.tsx — o sea un
 * `any`, que no comprueba nada.
 *
 * Declarar la respuesta como `ExecReportData` cierra el circuito: cambiar un
 * campo aqui rompe la compilacion aqui mismo, en vez de romper un PDF que el
 * director se descarga. Es `import type`, asi que no arrastra jsPDF al servidor.
 */
import type { ExecReportData } from '@/lib/exec-report-pdf';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const ALLOWED_ROLES = ['DIRECTOR', 'ADMIN'];

/**
 * GET /api/corporate/exec-report?period=day|week|month
 *
 * Reporte ejecutivo del director: censo+movimientos, clínico, operacional y
 * personal — agregado para el período seleccionado:
 *   - day:   hoy clínico AST (6am hoy → ahora)
 *   - week:  últimos 7 días móviles
 *   - month: últimos 30 días móviles
 *
 * Gated DIRECTOR/ADMIN. hqId desde sesión.
 */
export async function GET(req: Request) {
    try {
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;
        const session = await getServerSession(authOptions);

        const { searchParams } = new URL(req.url);
        const periodParam = (searchParams.get('period') || 'day') as 'day' | 'week' | 'month';
        if (!['day', 'week', 'month'].includes(periodParam)) {
            return NextResponse.json({ success: false, error: 'period inválido (day|week|month)' }, { status: 400 });
        }

        let hqId: string;
        try { hqId = await resolveEffectiveHqId(session!, searchParams.get('hqId')); }
        catch (e: any) { return NextResponse.json({ success: false, error: e.message || 'Sede inválida' }, { status: 400 }); }

        const now = new Date();
        const periodStart =
            periodParam === 'day' ? todayStartAST() :
            periodParam === 'week' ? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) :
            new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const periodEnd = now;

        const hq = await prisma.headquarters.findUnique({ where: { id: hqId }, select: { name: true } });

        /**
         * Cierre financiero — SOLO en el periodo mensual.
         *
         * Andres pidio sumar gastos operativos e ingreso comercial. La data ya
         * existe y comparte anclaje: MonthlyExpense.periodMonth e
         * Invoice.issueDate apuntan los dos al primer dia del mes, con esa nota
         * escrita en el schema.
         *
         * Se calcula SOLO si el periodo es 'month'. En la vista de dia o semana,
         * mostrar los gastos del mes seria comparar un numero mensual contra
         * actividad de siete dias — el margen saldria absurdo y nadie lo notaria
         * hasta tomar una decision con el.
         */
        let cierre: null | {
            mes: string;
            facturado: number; cobrado: number; pendiente: number; vencido: number;
            gastos: { categoria: string; monto: number }[];
            totalGastos: number;
            margen: number;
        } = null;

        if (periodParam === 'month') {
            /**
             * El ULTIMO MES COMPLETO, no el que va corriendo.
             *
             * Un cierre del mes en curso no es un cierre: es una foto a mitad.
             * Comprobado el 01-sep-2026 antes de publicar esta seccion — el mes
             * corriente daba margen de $67 079 con SOLO 2 partidas de gasto
             * cargadas y $0 cobrado de $78 746 facturados. Un numero excelente
             * y falso, del tipo con el que alguien decide gastar.
             *
             * Los gastos se cargan a mano y llegan tarde en el mes; las facturas
             * se emiten al principio. Comparar los dos a mitad de mes siempre
             * favorece, y siempre miente.
             */
            const inicioMes = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
            const finMes = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

            const [facturas, gastos] = await Promise.all([
                prisma.invoice.findMany({
                    where: { headquartersId: hqId, issueDate: { gte: inicioMes, lt: finMes } },
                    select: { totalAmount: true, status: true },
                }),
                prisma.monthlyExpense.findMany({
                    where: { headquartersId: hqId, periodMonth: { gte: inicioMes, lt: finMes } },
                    select: { category: true, amount: true },
                }),
            ]);

            const suma = (f: typeof facturas) => f.reduce((s, x) => s + (x.totalAmount ?? 0), 0);
            const porCategoria = new Map<string, number>();
            gastos.forEach(g => porCategoria.set(g.category, (porCategoria.get(g.category) ?? 0) + (g.amount ?? 0)));
            const totalGastos = gastos.reduce((s, g) => s + (g.amount ?? 0), 0);
            const facturado = suma(facturas);

            cierre = {
                mes: inicioMes.toLocaleDateString('es-PR', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
                facturado,
                cobrado:   suma(facturas.filter(f => f.status === 'PAID')),
                pendiente: suma(facturas.filter(f => f.status === 'PENDING')),
                vencido:   suma(facturas.filter(f => f.status === 'OVERDUE')),
                gastos: [...porCategoria].map(([categoria, monto]) => ({ categoria, monto }))
                    .sort((a, b) => b.monto - a.monto),
                totalGastos,
                margen: facturado - totalGastos,
            };
        }

        // Batch en paralelo — todas las agregaciones del período.
        const [
            activeNow, leaveNow,
            admisiones, egresos, hospitalizaciones,
            medsByStatus, vitalsRows, rotacionesCrudas, clinIncidents,
            sessionsOpened, sessionsClosed, sessionsForcedClosed,
            absences, handoversAll, handoversCompleted, overridesCrudos,
            staffWithScore, hrIncidents,
        ] = await Promise.all([
            /**
             * «EN EL HOGAR» SON LOS ACTIVE, Y NADA MAS.
             *
             * Esto era `enrolledResidentsWhere` —que es ACTIVE + TEMPORARY_LEAVE—
             * con el subtitulo «Residentes ACTIVE», y justo al lado una casilla
             * «En licencia» contando los TEMPORARY_LEAVE. O sea que el
             * hospitalizado salia en las DOS, y en la primera bajo un rotulo que
             * para el es falso: no esta en el hogar, esta en el hospital.
             *
             * Medido el 03-oct-2026 en Cupey: imprimia 33 habiendo 32 activos.
             *
             * Ahora las dos casillas son disjuntas y suman la matricula, que es
             * lo que el director espera de dos numeros puestos uno al lado del
             * otro.
             */
            prisma.patient.count({ where: { headquartersId: hqId, status: 'ACTIVE' } }),
            prisma.patient.count({ where: { headquartersId: hqId, status: 'TEMPORARY_LEAVE' } }),
            /**
             * ADMISIONES Y EGRESOS, SIN LAS FICHAS QUE NUNCA FUERON NADIE.
             *
             * Una ficha duplicada se crea y se cierra el mismo dia, y sumaba en
             * los dos sitios: medido el 03-oct-2026, «Admisiones 7» de la semana
             * eran 3 residentes y «Egresos 10» del mes eran 2 altas de verdad
             * (lo demas: 4 fallecimientos y 4 fichas duplicadas).
             *
             * `fichaAnulada` es una bandera explicita, no una lectura del texto
             * del motivo. Ver la nota del campo en schema.prisma.
             */
            prisma.patient.count({ where: { headquartersId: hqId, fichaAnulada: false, createdAt: { gte: periodStart, lte: periodEnd } } }),
            prisma.patient.count({ where: { headquartersId: hqId, fichaAnulada: false, status: 'DISCHARGED', dischargeDate: { gte: periodStart, lte: periodEnd } } }),
            /**
             * ⚠️ ESTA CASILLA NO CUENTA HOSPITALIZACIONES Y NO SE PUEDE ARREGLAR AQUI.
             *
             * `leaveType`/`leaveDate` son campos ESCALARES del residente, no un
             * historial: el boton «Registrar Retorno al Piso» los pone a null, y
             * reportar un fallecimiento sobreescribe `leaveType`. O sea que **el
             * regreso borra la hospitalizacion**.
             *
             * Medido el 03-oct-2026 en Cupey: la casilla decia 0 en el mes
             * mientras la bitacora tenia 9 traslados de 6 personas. Hector Velez
             * fue tres veces en quince dias y cuenta 0. Y lo unico que esta
             * consulta sabe producir distinto de cero es un expediente cerrado
             * al que nadie limpio la marca: los dos unicos Patient con
             * `leaveType='HOSPITAL'` puesto hoy estan los dos DECEASED.
             *
             * El dato de un MOVIMIENTO no cabe en un campo que se sobrescribe.
             * Arreglarlo pide una tabla de movimientos —el ingreso, el egreso,
             * la hospitalizacion y la dialisis son todos eventos y hoy los tres
             * primeros viven como estado— y eso es un sprint, no una linea.
             *
             * Mientras tanto se cuenta la fuente que SI es append-only: las
             * notas de traslado que escribe /api/care/hospitalize. No es el
             * numero de personas, es el de traslados, y el rotulo lo dice.
             */
            prisma.dailyLog.count({
                where: {
                    patient: { headquartersId: hqId },
                    notes: { contains: 'TRASLADO HOSPITALARIO' },
                    createdAt: { gte: periodStart, lte: periodEnd },
                },
            }),
            // Meds: filtrar vía PatientMedication → Patient → headquartersId
            prisma.medicationAdministration.groupBy({
                by: ['status'],
                where: {
                    patientMedication: { patient: { headquartersId: hqId } },
                    // Por la FECHA DE LA DOSIS. Ver src/lib/emar-dia.ts.
                    ...eMARentre(periodStart, periodEnd, true),
                },
                _count: { _all: true },
            }),
            /**
             * `heartRate` y `temperature` NO SOBRAN EN ESTE SELECT.
             *
             * Sin ellos, el calculo de abajo no puede ver dos de los cuatro
             * signos que la enfermera aprobo como "llamar ya" — y un campo que
             * no pides vale `undefined`, que se lee igual que "no habia nada".
             * Antipatrono 9 de CLAUDE.md.
             */
            prisma.vitalSigns.findMany({
                where: { patient: { headquartersId: hqId }, createdAt: { gte: periodStart, lte: periodEnd } },
                select: { systolic: true, diastolic: true, spo2: true, heartRate: true, temperature: true },
            }),
            /**
             * Se traen las POSICIONES, no un conteo. El rotulo "Rotaciones UPP"
             * sobre este count era falso por dos lados a la vez; se separa
             * abajo, donde se cuenta.
             */
            prisma.posturalChangeLog.findMany({
                where: { patient: { headquartersId: hqId }, performedAt: { gte: periodStart, lte: periodEnd } },
                select: { position: true },
            }),
            prisma.incidentReport.groupBy({
                by: ['severity'],
                where: { headquartersId: hqId, createdAt: { gte: periodStart, lte: periodEnd } },
                _count: { _all: true },
            }),
            prisma.shiftSession.count({ where: { headquartersId: hqId, startTime: { gte: periodStart, lte: periodEnd } } }),
            prisma.shiftSession.count({ where: { headquartersId: hqId, actualEndTime: { gte: periodStart, lte: periodEnd } } }),
            prisma.systemAuditLog.count({
                where: { headquartersId: hqId, action: 'SYSTEM_ABANDONED', createdAt: { gte: periodStart, lte: periodEnd } },
            }),
            /**
             * LAS AUSENCIAS, SIN LAS DE QUIEN YA NO TRABAJA AQUI.
             *
             * Le faltaban los dos filtros que CLAUDE.md pide a toda consulta
             * contra `ScheduledShift`, y el resultado es el de siempre: medido
             * el 03-oct-2026 en el periodo mensual, imprimia **4 ausencias y
             * solo 1 era de alguien del equipo**. Las otras tres son de Zuleyka
             * Valcarcel y Joaneliz Rosario, inactivas y borradas — las MISMAS
             * dos personas que ya habian salido en `pantalla-direccion` el
             * 21-sep. El fallo no se arreglo entonces: se arreglo alli.
             *
             * `schedule.status: 'PUBLISHED'` hoy no cambia el numero (los
             * cuatro horarios estan publicados), y va igual: un horario en
             * BORRADOR es un ensayo del constructor y sus ausencias no son
             * hechos. Sin el, esto es la divergencia que avisa CLAUDE.md.
             */
            prisma.scheduledShift.count({
                where: {
                    schedule: { headquartersId: hqId, status: 'PUBLISHED' },
                    user: { isActive: true, isDeleted: false },
                    isAbsent: true,
                    absentMarkedAt: { gte: periodStart, lte: periodEnd },
                },
            }),
            prisma.shiftHandover.count({
                where: { headquartersId: hqId, createdAt: { gte: periodStart, lte: periodEnd }, isDailyPrologue: false, signature: { not: null } },
            }),
            prisma.shiftHandover.count({
                where: { headquartersId: hqId, createdAt: { gte: periodStart, lte: periodEnd }, isDailyPrologue: false, handoverCompleted: true },
            }),
            /**
             * UNA REDISTRIBUCION MUEVE A ONCE PERSONAS, NO ES ONCE
             * REDISTRIBUCIONES.
             *
             * El PDF imprimia «Redistribuciones 1212 / Overrides creados». Esas
             * 1.212 son filas: una por residente movido. Y hay dos cosas mas,
             * medidas el 03-oct-2026 sobre el periodo mensual:
             *
             *   · **764 de las 1.212 van de un color AL MISMO color.** Eso no
             *     es mover a nadie: es una fila que dice "sigue donde estaba".
             *   · Las 1.212 filas son **119 actos** (fecha + turno + cuidadora)
             *     repartidos en 63 turnos.
             *
             * Un director que lee 1.212 entiende que su hogar se reorganiza mil
             * veces al mes. Se reorganizo 119 veces, y en 63 turnos de 260.
             *
             * Se trae el detalle y se cuenta abajo.
             */
            prisma.shiftPatientOverride.findMany({
                where: { headquartersId: hqId, createdAt: { gte: periodStart, lte: periodEnd } },
                select: {
                    originalColor: true, assignedColor: true, caregiverId: true,
                    shiftDate: true, shiftType: true, patientId: true, reason: true,
                },
            }),
            prisma.user.findMany({
                where: { headquartersId: hqId, isActive: true, isDeleted: false, role: { in: ['CAREGIVER', 'NURSE', 'SUPERVISOR'] } },
                select: { id: true, name: true, role: true, complianceScore: true },
            }),
            prisma.incidentReport.groupBy({
                by: ['severity'],
                where: {
                    headquartersId: hqId,
                    createdAt: { gte: periodStart, lte: periodEnd },
                    status: { in: ['APPLIED', 'PENDING_EXPLANATION', 'EXPLANATION_RECEIVED'] as any[] },
                },
                _count: { _all: true },
            }),
        ]);

        // Meds
        const medsMap: Record<string, number> = {};
        medsByStatus.forEach(m => { medsMap[m.status] = m._count._all; });
        /**
         * EL CUMPLIMIENTO eMAR SE DIVIDE ENTRE LAS RESUELTAS.
         *
         * Sumaba TODOS los estados, y ahi dentro van dos que no son fallo de
         * nadie: las PENDING —dosis que aun no han llegado a su hora— y, desde
         * el 22-sep-2026, las VOIDED (filas anuladas por duplicadas). Las dos
         * hinchan el denominador y bajan el cumplimiento del informe que lee
         * direccion.
         *
         * DOSIS_RESUELTAS de CLAUDE.md.
         */
        const RESUELTAS_EMAR = ['ADMINISTERED', 'MISSED', 'OMITTED', 'REFUSED', 'HELD'];
        const medsTotal = Object.entries(medsMap)
            .filter(([estado]) => RESUELTAS_EMAR.includes(estado))
            .reduce((a, [, n]) => a + (n as number), 0);
        const administered = medsMap['ADMINISTERED'] || 0;
        const compliancePct = medsTotal > 0 ? Math.round((administered / medsTotal) * 100) : 0;

        /**
         * ─── VITALES: LA CUARTA COPIA DE LOS UMBRALES ─────────────────────
         *
         * Aqui vivian tres comparaciones escritas a mano —`spo2 < 94`,
         * `systolic > 160`, `diastolic > 100`— bajo el rotulo "criticos". El
         * comentario de `esVitalAnomalo` ya documenta dos copias divergentes
         * que se unificaron el 05-sep-2026; esta era la tercera, y seguia viva.
         *
         * Medido el 03-oct-2026 sobre las 1.825 tomas del periodo mensual, y
         * el solape es peor que la diferencia:
         *
         *     lo que imprimia ...... 162
         *     LLAMAR de verdad ..... 204
         *     de esos 162, NO son criticos ... 92   (son ANOTAR)
         *     criticos que no contaba ........ 134
         *
         * Las dos mitades del error tienen una causa clara:
         *
         *   · `>160` y `>100` son las bandas **ANOTAR** de la enfermera, no las
         *     de llamar, que son `>180` y `>110`. Igual `spo2 < 94`, que es la
         *     banda de anotar (llamar es `<90`). Asi que inflaba.
         *   · Y no miraba **pulso ni temperatura**, que son dos de los cuatro
         *     signos que pueden exigir una llamada: 70 y 14 casos del periodo.
         *     Asi que a la vez perdia.
         *
         * Los dos errores se tapaban entre si y el total parecia razonable. Un
         * numero que sale de dos equivocaciones de signo contrario es el que
         * mas tarda en detectarse.
         *
         * Ahora se pregunta a `vitals-thresholds.ts`, que es lo que revisó la
         * enfermera del hogar.
         */
        const vitalsCritical = vitalsRows.filter(v => esVitalCritico(v)).length;
        const vitalsAnomalos = vitalsRows.filter(v => esVitalAnomalo(v)).length;

        /**
         * ─── "ROTACIONES UPP": DOS COSAS FALSAS EN TRES PALABRAS ──────────
         *
         * El PDF imprimia este conteo con el rotulo «Rotaciones UPP /
         * Posturales». Medido el 03-oct-2026 sobre las 5.212 filas del periodo
         * mensual, ninguna de las dos palabras aguanta:
         *
         *   · **UPP**: solo 1.003 (19%) son de residentes con alguna ulcera
         *     registrada. En la sede hay 6 residentes con UPP de 32.
         *   · **Posturales**: 4.439 de 5.212 (85%) son «Rotación General
         *     (Pre-programada Zendi)» — el boton de Rondas, que registra que se
         *     paso a ver al residente SIN decir a que lado se le giro. Los
         *     cambios de decubito con lado escrito son 773.
         *
         * Un director que lee «5.212 rotaciones UPP» entiende que el hogar hizo
         * cinco mil cambios posturales a sus residentes con ulceras. Hizo 773
         * cambios de decubito, y la inmensa mayoria del numero son rondas.
         *
         * Se separan, y cada mitad lleva el nombre de lo que es. `ladoDeRotacion`
         * ya sabia distinguirlas: existia para la guarda anti-duplicado.
         */
        const rotacionesPorLado = { IZQ: 0, SUP: 0, DER: 0, GENERICA: 0 };
        for (const r of rotacionesCrudas) rotacionesPorLado[ladoDeRotacion(r.position)]++;
        const rotaciones = {
            /** Con lado escrito: lo que el protocolo de UPP llama un cambio. */
            conDecubito: rotacionesPorLado.IZQ + rotacionesPorLado.SUP + rotacionesPorLado.DER,
            /** El boton de Rondas: se paso a ver, sin registrar el lado. */
            rondas: rotacionesPorLado.GENERICA,
            total: rotacionesCrudas.length,
        };

        /** Las redistribuciones, contadas por acto y no por fila. Ver la nota arriba. */
        const clave = (o: typeof overridesCrudos[number]) =>
            `${o.shiftDate.toISOString().slice(0, 10)}|${o.shiftType}|${o.caregiverId}`;
        const redistribuciones = {
            actos: new Set(overridesCrudos.map(clave)).size,
            /** Filas que de verdad cambian de grupo. 764 de 1.212 no lo hacian. */
            residentesMovidos: overridesCrudos.filter(o => o.originalColor !== o.assignedColor).length,
            turnosAfectados: new Set(
                overridesCrudos.map(o => `${o.shiftDate.toISOString().slice(0, 10)}|${o.shiftType}`),
            ).size,
            /** Por que hubo que mover: llegada tarde, ausencia, o a mano. */
            porAusencia: new Set(overridesCrudos.filter(o => o.reason === 'ABSENCE_REDISTRIB').map(clave)).size,
            porLlegadaTarde: new Set(overridesCrudos.filter(o => o.reason === 'LATE_COVER').map(clave)).size,
        };

        // Incidents por severidad (clínico — todos los del período)
        const sevBuckets = ['OBSERVATION', 'WARNING', 'SUSPENSION', 'TERMINATION'];
        const incidentsBySev: Record<string, number> = {};
        sevBuckets.forEach(s => { incidentsBySev[s] = 0; });
        clinIncidents.forEach(i => { incidentsBySev[i.severity] = i._count._all; });
        const hrIncBySev: Record<string, number> = {};
        sevBuckets.forEach(s => { hrIncBySev[s] = 0; });
        hrIncidents.forEach(i => { hrIncBySev[i.severity] = i._count._all; });

        /**
         * ─── EL PERSONAL, CON NOMBRE Y CON HECHOS ────────────────────────
         *
         * Hasta el 14-sep-2026 esto eran dos listas —"TOP PERFORMERS" y
         * "A SEGUIR"— ordenadas por `complianceScore`. Ese número está apagado
         * desde el 09-sep (ver src/lib/z-score-visible.ts) porque está
         * invertido: medido el 13-sep, Yedaira González —517 notas en 30 días,
         * la que más documenta del piso— tenía 25, y Caridad Veras —dieciséis
         * días en el hogar y cero notas— tenía 100. Las listas habrían
         * impreso a una en "A SEGUIR" y a la otra en "TOP PERFORMERS".
         *
         * Un resumen ejecutivo SÍ debe nombrar a su gente: es un documento
         * administrativo. Lo que no puede es ordenarla por un número que
         * miente, porque un PDF se descarga y circula, y no se puede desdecir.
         *
         * Así que van los hechos, que son cuatro, cada uno observable y ya
         * registrado — sin fundirlos en un índice y sin etiquetas de juicio.
         * Ordenado alfabético a propósito: cualquier otro orden es un ranking.
         */
        const idsPiso = staffWithScore.map(s => s.id);
        const enElPeriodo = { gte: periodStart, lte: periodEnd };

        const [turnosPorPersona, cerradosPorPersona, forzadosDelPeriodo, cursosPorPersona, obsPorPersona] =
            await Promise.all([
                prisma.shiftSession.groupBy({
                    by: ['caregiverId'],
                    where: { headquartersId: hqId, caregiverId: { in: idsPiso }, startTime: enElPeriodo },
                    _count: { _all: true },
                }),
                prisma.shiftSession.groupBy({
                    by: ['caregiverId'],
                    where: { headquartersId: hqId, caregiverId: { in: idsPiso }, startTime: enElPeriodo, handoverCompleted: true },
                    _count: { _all: true },
                }),
                /**
                 * Los turnos que cerró supervisión por ella. NO cuentan como
                 * suyos sin cerrar: `/api/care/shift/force-close` pone
                 * `actualEndTime` y deja constancia en SystemAuditLog, pero no
                 * toca `handoverCompleted`. Medido: de 86 turnos sin cerrar del
                 * hogar, 60 son forzados — Neylianne tenía 15 y doce lo eran.
                 */
                prisma.shiftSession.findMany({
                    where: {
                        headquartersId: hqId, caregiverId: { in: idsPiso }, startTime: enElPeriodo,
                        handoverCompleted: false,
                        aiSummaryReport: { startsWith: 'Cierre forzado' },
                    },
                    select: { caregiverId: true },
                }),
                prisma.userCourse.groupBy({
                    by: ['employeeId'],
                    where: { employeeId: { in: idsPiso }, completedAt: enElPeriodo },
                    _count: { _all: true },
                }),
                prisma.incidentReport.groupBy({
                    by: ['employeeId'],
                    where: { headquartersId: hqId, employeeId: { in: idsPiso }, status: 'APPLIED', createdAt: enElPeriodo },
                    _count: { _all: true },
                }),
            ]);

        const mapa = <T extends { _count: { _all: number } }>(filas: T[], clave: keyof T) =>
            new Map(filas.map(f => [String(f[clave]), f._count._all]));
        const nTurnos = mapa(turnosPorPersona, 'caregiverId');
        const nCerrados = mapa(cerradosPorPersona, 'caregiverId');
        const nCursos = mapa(cursosPorPersona, 'employeeId');
        const nObs = mapa(obsPorPersona, 'employeeId');
        const nForzados = new Map<string, number>();
        for (const f of forzadosDelPeriodo) nForzados.set(f.caregiverId, (nForzados.get(f.caregiverId) ?? 0) + 1);

        const roster = staffWithScore
            .map(s => ({
                name: s.name,
                role: s.role,
                turnos: nTurnos.get(s.id) ?? 0,
                cerrados: nCerrados.get(s.id) ?? 0,
                forzados: nForzados.get(s.id) ?? 0,
                cursos: nCursos.get(s.id) ?? 0,
                observaciones: nObs.get(s.id) ?? 0,
            }))
            .sort((a, b) => a.name.localeCompare(b.name, 'es'));

        /**
         * ─── EL RELEVO: 100% PORQUE NO PODIA SER OTRA COSA ────────────────
         *
         * Dividia los relevos con `handoverCompleted: true` entre los relevos
         * con `signature != null`. Medido el 03-oct-2026 sobre el periodo
         * mensual: 242 y 242. **Cero** firmados sin completar, **cero**
         * completados sin firma. Los dos campos se escriben en el mismo acto,
         * asi que son el mismo hecho contado dos veces y el cociente es 1 por
         * construccion. El PDF lo imprimia DOS veces, con dos rotulos
         * distintos: «100% completados» y «Turnos cerrados con el relevo 100%».
         *
         * Es el olor que describe CLAUDE.md: una metrica que sale redonda
         * siempre no es buena, es una que no puede moverse. La prueba es
         * preguntarse bajo que dato daria otra cosa — y no habia ninguno.
         *
         * El denominador honesto son los TURNOS, no los relevos: un turno puede
         * cerrarse sin que nadie deje relevo, y eso es justo lo que el director
         * necesita ver. Medido igual: **239 de 260 turnos = 92%**, y de los 21
         * sin relevo, **16 los cerro supervision** por ella.
         *
         * Ese reparto importa y se manda aparte: un cierre forzado no es una
         * cuidadora que se fue sin entregar, es un turno que supervision tuvo
         * que cerrar. Son dos conversaciones distintas con la misma persona.
         */
        const [turnosDelPeriodo, turnosConRelevo, turnosForzados] = await Promise.all([
            prisma.shiftSession.count({ where: { headquartersId: hqId, startTime: enElPeriodo } }),
            prisma.shiftSession.count({ where: { headquartersId: hqId, startTime: enElPeriodo, handoverCompleted: true } }),
            prisma.shiftSession.count({
                where: {
                    headquartersId: hqId, startTime: enElPeriodo, handoverCompleted: false,
                    aiSummaryReport: { startsWith: 'Cierre forzado' },
                },
            }),
        ]);
        const relevoPct = turnosDelPeriodo > 0 ? Math.round((turnosConRelevo / turnosDelPeriodo) * 100) : null;

                // ── Familias: percepcion y comunicacion ──────────────────────────
        // El resto del informe cuenta actividad. Esto cuenta lo que la familia
        // siente y lo que se le conto.
        /**
         * LA SATISFACCION ES DEL TRIMESTRE, Y EL INFORME PUEDE SER DE HOY.
         *
         * `satisfaccion(hqId)` usa `periodoActual()` por defecto: el trimestre
         * natural de Puerto Rico. En un informe rotulado «ultimos 30 dias» —o
         * peor, en el de un dia— ese numero no es del periodo que el director
         * cree estar leyendo. Hoy es 03-oct: el trimestre empezo hace tres dias.
         *
         * No se recorta al periodo, que seria peor: una encuesta trimestral
         * acotada a un dia da cero respuestas y un promedio nulo. Se manda el
         * trimestre para que el PDF lo DIGA, que es lo unico honesto cuando un
         * dato tiene su propio reloj.
         */
        const trimestreEncuesta = periodoActual();
        const sat = await satisfaccion(hqId, trimestreEncuesta);

        const equipo = await formacionDeEquipo(hqId);
        const dePiso = equipo.filter(x => ['CAREGIVER', 'NURSE', 'SUPERVISOR', 'SOCIAL_WORKER'].includes(x.role));
        const formacionAlDiaPct = dePiso.length
            ? Math.round((dePiso.filter(x => x.porcentaje >= 100).length / dePiso.length) * 100)
            : null;

        // Denominador honesto: solo residentes que TIENEN familia registrada.
        // Contar sobre los 33 activos daria un porcentaje que nadie puede subir
        // — 19 de ellos no tienen a quien avisar.
        const conFamilia = await prisma.patient.count({
            where: { headquartersId: hqId, status: 'ACTIVE', familyMembers: { some: {} } },
        });
        const actualizadas = await prisma.patient.count({
            where: {
                headquartersId: hqId, status: 'ACTIVE', familyMembers: { some: {} },
                zendiNursingUpdates: { some: { status: 'SENT', createdAt: { gte: periodStart } } },
            },
        });

        const payload: ExecReportData = {
            hqName: hq?.name || 'Sede',
            directorName: auth.name || 'Director',
            period: periodParam,
            periodStart: periodStart.toISOString(),
            periodEnd: periodEnd.toISOString(),
            censo: { activeNow, leaveNow, admisiones, egresos, hospitalizaciones },
            clinico: {
                meds: {
                    total: medsTotal,
                    administered,
                    // Faltaba, y es la categoria grande. Ver la nota del PDF.
                    missed: medsMap['MISSED'] || 0,
                    omitted: medsMap['OMITTED'] || 0,
                    refused: medsMap['REFUSED'] || 0,
                    held: medsMap['HELD'] || 0,
                    pending: medsMap['PENDING'] || 0,
                    compliancePct,
                },
                vitals: { total: vitalsRows.length, critical: vitalsCritical, anomalos: vitalsAnomalos },
                rotaciones,
                incidents: incidentsBySev,
            },
            operacional: {
                sessionsOpened, sessionsClosed, sessionsForcedClosed,
                absences,
                relevo: {
                    turnos: turnosDelPeriodo,
                    conRelevo: turnosConRelevo,
                    sinRelevo: turnosDelPeriodo - turnosConRelevo,
                    cerradosPorSupervision: turnosForzados,
                    pct: relevoPct,
                },
                redistribuciones,
            },
            personal: {
                totalStaff: staffWithScore.length,
                roster,
                hrIncidents: hrIncBySev,
                formacionAlDiaPct,
            },
            familias: {
                satisfaccion: sat.promedio,
                encuestasRespondidas: sat.respondidas,
                encuestasEnviadas: sat.enviadas,
                /** Para que el PDF pueda decir de que trimestre es ese numero. */
                trimestreEncuesta,
                actualizadas,
                conFamilia,
            },
            cierre,
        };

        return NextResponse.json({ success: true, ...payload });
    } catch (error: any) {
        console.error('[corporate/exec-report] error:', error);
        return NextResponse.json({ success: false, error: 'Error generando reporte ejecutivo' }, { status: 500 });
    }
}
