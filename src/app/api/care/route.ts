import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { todayStartAST, astDateTime } from '@/lib/dates';
import { ACTIVE_PRESENCE_MAX_HOURS } from '@/lib/shift-coverage';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { requireRole } from '@/lib/api-auth';
import { QUIEN_VE_EL_PISO } from '@/lib/roles-clinicos';
import { resolveEffectiveHqId } from '@/lib/hq-resolver';
import { logError } from '@/lib/logger';
import { MOTIVO_OBSERVACION, VENTANA_CIERRE_MS } from '@/lib/observacion-vitales';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * QUIEN PUEDE PEDIR EL TABLERO DEL PISO.
 *
 * Esta ruta solo comprobaba que hubiera SESION, sin mirar el rol. Y devuelve,
 * por cada uno de los 33 residentes de la sede: la medicacion activa con las
 * dosis del dia, el resumen clinico y los riesgos del PAI, el detalle de
 * dieta, los signos vitales de hoy y las ulceras por presion con localizacion
 * y estadio. Ese cuadro clinico completo lo tenia CUALQUIER cuenta con sesion
 * — al 16-sep-2026, en produccion: cocina, mantenimiento, el inversionista y
 * la cuenta de RRHH. Minimo necesario de manual.
 *
 * La lista es quien cuida o responde por el cuidado. requireRole mira tambien
 * los roles secundarios, asi que Celia (DIRECTOR + NURSE) y las dos
 * supervisoras con CAREGIVER secundario entran por cualquiera de los dos.
 */
// La lista vive en src/lib/roles-clinicos.ts porque desde el 28-sep la comparte
// /api/care/foto/[patientId]: si se separan, una ruta ensena la cara de un
// residente a quien la otra no deja ver su nombre.
const QUIEN_CUIDA_EL_PISO = QUIEN_VE_EL_PISO;

/**
 * Fuera a proposito, y por que:
 *
 *  · KITCHEN     — necesita la dieta, no el estadio de una ulcera ni la lista
 *                  de medicamentos. Ya tiene su censo con dieta y textura en
 *                  /api/kitchen/dashboard.
 *  · MAINTENANCE — circulan por el edificio; no cuidan a nadie.
 *  · CLEANING
 *  · INVESTOR    — panel de socios, sin PHI por diseño.
 *  · HR_MANAGER  — el rol se creo (24-ago-2026) explicitamente SIN acceso
 *                  clinico: personal si, residentes no. Ver el enum Role.
 *  · FAMILY      — tiene sesion y headquartersId; con la guarda vieja podia
 *                  leer el censo clinico entero, no solo a su familiar.
 *  · THERAPIST, BEAUTY_SPECIALIST, COORDINATOR — AuthContext los confina a
 *                  /specialists y /coordinator, y ninguna de esas pantallas
 *                  llama aqui (los unicos consumidores son "/" y /care).
 *                  Incluirlos no abriria ninguna pantalla y si ampliaria la
 *                  superficie. Si alguno pasa a llevar tableta de piso se
 *                  añade aqui; y un COORDINATOR con NURSE o DIRECTOR
 *                  secundario ya entra hoy por el rol secundario.
 */

// GET: Obtiene residentes filtrados por el Color seleccionado en el turno
export async function GET(req: Request) {
    try {
        const auth = await requireRole(QUIEN_CUIDA_EL_PISO);
        if (auth instanceof NextResponse) return auth;

        // resolveEffectiveHqId todavia pide el Session crudo de NextAuth (no el
        // SessionUser de requireRole); se lee aparte, ya pasado el gate de rol.
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const colorParam = searchParams.get('color') || 'UNASSIGNED';
        const requestedHqId = searchParams.get('hqId');
        const invokerId = auth.id;

        // Sprint N.4 — multi-color. El param puede venir como 'RED' (legacy)
        // o 'RED,YELLOW' (sustituto cubriendo varios grupos). Split por coma.
        const colors = colorParam
            ? colorParam.split(',').map(c => c.trim()).filter(Boolean)
            : [];

        // Resolución segura: roles limitados quedan anclados a su sede
        let hqId: string;
        try {
            hqId = await resolveEffectiveHqId(session, requestedHqId);
        } catch (e: any) {
            return NextResponse.json({ success: false, error: e.message || "Sede inválida" }, { status: 400 });
        }

        console.log("CARE API CALLED WITH:", { colors, hqId });

        // Guard: un cuidador sin color asignado NO debe ver residentes UNASSIGNED.
        // Antes este caso caía al filtro por colorGroup='UNASSIGNED' y mostraba
        // residentes huérfanos (incluyendo duplicados como los 3 registros de
        // Daniela Arrieta que aparecían en el tablet).
        if (colors.length === 1 && colors[0] === 'UNASSIGNED') {
            return NextResponse.json({ success: true, patients: [], events: [], hospitalizedCount: 0 });
        }

        const todayStart = todayStartAST();
        const todayEnd = new Date();

        /**
         * El DIA CALENDARIO de Puerto Rico, de medianoche a medianoche.
         *
         * No es lo mismo que `todayStartAST()`, que devuelve el arranque del DIA
         * CLINICO — las 6:00 AM. Esa frontera parte en dos el pack de las 5:00 AM,
         * que es exactamente lo que rompio la ronda de tiroides del 16-sep. Para
         * decidir si una dosis pautada es "de hoy" hace falta el dia natural.
         */
        const inicioDelDiaAST = astDateTime(todayEnd, 0, 0);
        const finDelDiaAST = new Date(inicioDelDiaAST.getTime() + 24 * 60 * 60 * 1000);
        // Cap UNIFICADO de presencia (16h sliding). Alineado con
        // isSoloCaregiver y caregiver-rounds — los 3 call-sites que cuentan
        // "presencia" en piso usan el mismo umbral.
        const presenceCap = new Date(Date.now() - ACTIVE_PRESENCE_MAX_HOURS * 60 * 60 * 1000);

        // Nivel 2 — Auto-escalación a ALL para cuidadora solitaria.
        // Si el invocador es el único cuidador clínico (CAREGIVER + NURSE) con
        // sesión activa en la sede, ignoramos el filtro de color y mostramos
        // todos los residentes. Auto-corrige cuando otro cuidador inicia turno
        // porque se recalcula en cada poll.
        const activeCount = await prisma.shiftSession.count({
            where: {
                headquartersId: hqId,
                actualEndTime: null,
                startTime: { gte: presenceCap },
                caregiver: { role: { in: ['CAREGIVER', 'NURSE'] } },
            },
        });
        const isSolo = activeCount <= 1;

        // Sprint N.4 — Overrides asignados a ESTE cuidador hoy (shiftPatientOverride
        // con isActive=true). Se combinan con el colorFilter propio vía OR para que
        // el tablet muestre "mis residentes del color X + los residentes cubiertos
        // temporalmente por ausencia/redistribución".
        const overrideRows = await prisma.shiftPatientOverride.findMany({
            where: {
                caregiverId: invokerId,
                headquartersId: hqId,
                isActive: true,
                shiftDate: { gte: todayStart },
            },
            select: { patientId: true, originalColor: true, reason: true },
        });
        const overridePatientIds = overrideRows.map(o => o.patientId);
        const overrideByPatientId = new Map(overrideRows.map(o => [o.patientId, o]));

        // Filtro por color propio. Si la cuidadora es la única en piso, se
        // ignora el filtro y se traen todos.
        const includesAll = colors.includes('ALL') || isSolo;
        const ownColorFilter = (colors.length === 0 || includesAll)
            ? {}
            : { colorGroup: { in: colors as any[] } };

        const baseStatusFilter = {
            headquartersId: hqId,
            status: { in: ['ACTIVE', 'TEMPORARY_LEAVE'] as any },
        };

        const where = overridePatientIds.length > 0
            ? {
                OR: [
                    { ...ownColorFilter, ...baseStatusFilter },
                    { id: { in: overridePatientIds }, ...baseStatusFilter },
                ],
            }
            : {
                ...ownColorFilter,
                ...baseStatusFilter,
            };

        /**
         * LA VERSIÓN DE CADA FOTO, SIN TRAERSE NINGUNA FOTO.
         *
         * `photoUrl` ya no viaja: son 43 kB de JPEG en base64 por residente,
         * 1.339 kB en total, reenviados enteros en cada poll porque dentro de
         * un JSON el navegador no puede cachear nada. Ahora cada cara tiene su
         * propia URL —/api/care/foto/[id]— y el navegador la guarda.
         *
         * Pero una URL fija con caché de un día dejaría a quien acaba de tomar
         * la foto viendo la vieja. Así que la URL lleva los 8 primeros
         * caracteres del md5 del contenido: si la foto cambia, la URL cambia.
         *
         * El md5 lo calcula Postgres, así que por el cable van 8 caracteres por
         * residente en vez de 43 kB. Y el `IS NOT NULL` hace de bandera: quien
         * no sale de aquí no tiene foto, y la tableta pinta sus iniciales —que
         * es lo que ya hacía cuando `photoUrl` venía en null.
         */
        const versionesDeFoto = await prisma.$queryRaw<{ id: string; v: string }[]>`
            SELECT id, substring(md5("photoUrl"), 1, 8) AS v
            FROM "Patient"
            WHERE "headquartersId" = ${hqId} AND "photoUrl" IS NOT NULL
        `;
        const versionFoto = new Map(versionesDeFoto.map(r => [r.id, r.v]));

        const patientsRaw = await prisma.patient.findMany({
            where,
            /**
             * SELECT EXPLICITO. LO QUE LA TABLETA USA Y NADA MAS.
             *
             * Esto era `include` a secas, o sea que cada poll de la pantalla del
             * piso se llevaba la FILA ENTERA de cada residente. Medido el
             * 28-sep-2026 sobre los 31 residentes de Cupey: **4.386 kB**, y los
             * includes anidados —medicamentos, vitales, banos, ulceras— no eran
             * el peso: los residentes SOLOS ya eran 4.386 de los 4.593 totales.
             *
             * Cuatro columnas eran el 99 %, y no son URLs aunque se llamen asi:
             * son documentos escaneados en base64 dentro de la fila.
             *
             *     photoUrl .......... 1.339 kB   43 kB por residente   SE USA (el avatar)
             *     medicalPlanUrl .... 1.275 kB   41 kB                 0 usos en /care
             *     idCardUrl ......... 1.141 kB   mediana 169.187 car.  0 usos en /care
             *     medicareCardUrl ...   585 kB                         0 usos en /care
             *
             * Y ADEMAS, POR SER `include`, VIAJABA TODO LO DEMAS. De los 62
             * campos escalares de Patient, /api/care y la tableta usan 21.
             * Los otros 41 incluyen `achAccountNumber`, `achRoutingNumber`,
             * `ssnLastFour`, `medicareNumber`, `medicaidNumber`, `idNumber`,
             * `insurancePolicyNumber` y `monthlyFee`: el numero de cuenta y de
             * ruta bancaria de cada residente, en la tableta de cada cuidadora,
             * en cada poll, para pintar una pantalla que no los enseña.
             *
             * Los 21 no son a ojo: son los que aparecen de verdad en esta ruta,
             * en care/page.tsx, en components/care/* y en los cuatro componentes
             * que care/page importa de fuera (EmergencyPdfButton,
             * FallIncidentPrint, DietPrescription, ZendiAssist) — de ahi salen
             * `dateOfBirth`, `dietPegKcalMl` y `downtonRisk`, que la ruta sola
             * no usaba.
             *
             * OJO AL ANADIR UN CAMPO: con `select` explicito, una columna nueva
             * de Patient NO llega sola a la tableta. Hay que ponerla aqui. Es el
             * precio de no mandar el numero de cuenta de nadie, y se paga.
             *
             * Las tres pantallas que SI necesitan los documentos escaneados
             * —intake, /corporate/medical/patients/[id] y el resumen— tienen su
             * propia ruta: /api/corporate/patients/[id].
             */
            select: {
                id: true, headquartersId: true, name: true, roomNumber: true,
                dateOfBirth: true, diet: true, dietTexture: true, dietDiabetic: true,
                dietLowSodium: true, dietRenal: true, dietVegetarian: true, dietPegKcalMl: true,
                downtonRisk: true, nortonRisk: true, requiresPosturalChanges: true, colorGroup: true,
                status: true, leaveType: true, needsDialysis: true,
                createdAt: true,

                medications: {
                    where: {
                        isActive: true,
                        status: { in: ['ACTIVE', 'PRN'] }
                    },
                    include: {
                        medication: true,
                        /**
                         * QUE DOSIS DE HOY YA ESTAN RESUELTAS.
                         *
                         * Esto filtraba por `createdAt` dentro del dia clinico, y desde
                         * el 15-sep-2026 `createdAt` DEJO DE SIGNIFICAR "cuando se cuido":
                         * ahora la fila la crea el cron a las 06:00:37, asi que esa fecha
                         * dice cuando corrio el cron y nada mas.
                         *
                         * LO QUE ESO ROMPIO, el 16-sep a las 5 de la madrugada. El dia
                         * clinico empieza a las 6:00 AM y hay un pack a las 5:00 AM, o sea
                         * justo del otro lado de la frontera. La firma de la ronda de
                         * tiroides del dia anterior vivia en una fila creada a las
                         * 06:00:39 — dentro del dia clinico que aun corria— asi que la
                         * tableta la conto como de hoy y enseño el pack COMPLETO.
                         * Carlos Negron y Yedaira Gonzalez administraron las diez dosis y
                         * el sistema ya se creia firmado. A las 6:30 el barrido las marco
                         * omitidas. Diez residentes medicados y un expediente que decia
                         * lo contrario.
                         *
                         * LA REGLA CORRECTA: una dosis se identifica por `scheduledTime`
                         * —el instante para el que estaba pautada—, no por cuando se
                         * escribio la fila. `createdAt` solo decide en las filas que no
                         * tienen hora pautada: PRN, semanales y lo anterior al cron.
                         */
                        administrations: {
                            where: {
                                OR: [
                                    { scheduledTime: { gte: inicioDelDiaAST, lt: finDelDiaAST } },
                                    { scheduledTime: null, createdAt: { gte: todayStart, lte: todayEnd } },
                                ],
                                // HELD incluido desde sep-2026: una omision por
                                // indicacion medica ya no se guarda como OMITTED.
                                // Ver src/lib/omision-medicamento.ts.
                                status: { in: ['ADMINISTERED', 'OMITTED', 'REFUSED', 'HELD'] }
                            },
                            select: { id: true, status: true, scheduleTime: true, createdAt: true, notes: true }
                        }
                    }
                },
                lifePlans: {
                    orderBy: { createdAt: 'desc' }, take: 1,
                    // Solo lo que la tableta usa. Sin `select` venia el modelo
                    // entero, incluido signatureBase64 (@db.Text) y familyVersion:
                    // hoy estan vacios, pero en cuanto se firmen planes eso viaja
                    // completo a cada tableta en cada carga. Mismo patron que costo
                    // 19 MB en history-report.
                    select: { id: true, risks: true, preferences: true, dietDetails: true, clinicalSummary: true, status: true },
                },
                mealLogs: {
                    where: { timeLogged: { gte: todayStart, lte: todayEnd } },
                    distinct: ['mealType'],
                    select: { id: true, mealType: true }
                },
                vitalSigns: {
                    where: { createdAt: { gte: todayStart, lte: todayEnd } },
                    select: { id: true, systolic: true, diastolic: true, heartRate: true, temperature: true, glucose: true, createdAt: true },
                    orderBy: { createdAt: 'desc' }
                },
                bathLogs: {
                    where: { timeLogged: { gte: todayStart, lte: todayEnd } },
                    /**
                     * `timeLogged` VA EN EL SELECT PORQUE LA TABLETA LO LEE.
                     *
                     * Sin el, `bathCompletedToday` en care/page.tsx hacia
                     * `new Date(log.timeLogged || log.createdAt)` sobre dos
                     * campos que no se habian pedido, y el candado de "ya se
                     * bano hoy" daba SIEMPRE false. El boton de bano nunca se
                     * deshabilitaba y la cara nunca podia decir que estaba
                     * hecho. Es el antipatron 9 de CLAUDE.md, vivo: un campo
                     * que no pides vuelve null en todas las filas y se lee
                     * igual que "ninguna lo tiene".
                     */
                    select: { id: true, timeLogged: true },
                    take: 1
                },
                pressureUlcers: {
                    // La cuidadora registra el cambio de aposito desde su
                    // tarjeta, asi que necesita saber CUAL ulcera y su plan:
                    // pedirle que actue sin enseñarle el plan del home care es
                    // pedirle que actue de memoria. HEALING tambien: una ulcera
                    // que va sanando sigue llevando aposito.
                    where: { status: { in: ['ACTIVE', 'HEALING'] } },
                    select: { id: true, bodyLocation: true, stage: true, planTratamiento: true, planEstablecidoPor: true },
                },
                /**
                 * `posturalChanges` YA NO VA AQUÍ. Ver `ultimaRotacion` más
                 * abajo: el `take: 1` anidado de Prisma se traía las 19.336
                 * filas del historial completo.
                 */
                vitalsOrders: {
                    /**
                     * PENDING **Y** LA REVISIÓN DE OBSERVACIÓN YA VENCIDA.
                     *
                     * Con `status: 'PENDING'` a secas, la tarjeta perdía la
                     * orden en el instante en que empezaba a importar: el cron
                     * corre cada 5 minutos y marca EXPIRED lo vencido, así que
                     * la franja roja «Ventana vencida» solo podía verse durante
                     * esos 5 minutos. Medido el 22-sep-2026: 6.884 órdenes
                     * EXPIRED sin completar en la base, CERO en PENDING-vencida
                     * en ese momento, y de las 96 últimas completadas tarde, el
                     * 75 % se completó cuando la tarjeta ya no enseñaba nada.
                     * La cuidadora que llegó tarde y aun así fue, fue por su
                     * cuenta — no porque la pantalla se lo dijera.
                     *
                     * Se arregla SOLO para la revisión de observación, que es
                     * una obligación clínica sobre alguien a quien el sistema
                     * marcó como crítico. Extenderlo a las ventanas de entrada
                     * dejaría a 8 de los 32 residentes de Cupey en rojo
                     * permanente (25 %), y eso es una decisión de producto, no
                     * un arreglo.
                     */
                    where: {
                        completedAt: null,
                        OR: [
                            { status: 'PENDING' },
                            {
                                status: 'EXPIRED',
                                reason: MOTIVO_OBSERVACION,
                                /**
                                 * LA FRANJA Y EL CIERRE MIDEN LO MISMO.
                                 *
                                 * Esto pedía 24 h mientras `cerrarObservacionesAbiertas`
                                 * solo cierra lo que tenga menos de VENTANA_CIERRE_MS
                                 * (8 h). En medio quedaban 16 h y 45 min en los que la
                                 * franja roja pedía una revisión que el servidor iba a
                                 * rechazar en silencio: la cuidadora podía ir, tomar los
                                 * vitales, y la franja seguía ahí.
                                 *
                                 * El ancla es `orderedAt` y no `expiresAt` porque es la
                                 * que usa el cierre. Con `expiresAt` las dos ventanas
                                 * quedaban desfasadas 45 minutos — el mismo fallo, más
                                 * pequeño.
                                 *
                                 * Lo que se retira es la PETICIÓN, no el hecho: la orden
                                 * sigue EXPIRED con `completedAt` en null, y el panel del
                                 * supervisor la lista sin tope de tiempo y marca las que
                                 * llevan más de un día. Si 8 h resulta ser el número
                                 * equivocado, se cambia en observacion-vitales.ts y esto
                                 * lo sigue solo.
                                 */
                                orderedAt: { gte: new Date(Date.now() - VENTANA_CIERRE_MS) },
                            },
                        ],
                    },
                    // Por PLAZO, no por antigüedad. Con una revisión de
                    // observación de 45 min abierta junto a la ventana de
                    // entrada de 4 h, `orderedAt: desc` acertaba por accidente
                    // —la revisión siempre es más nueva— pero fallaba al revés:
                    // una ventana de entrada a punto de vencer quedaba tapada
                    // por una revisión recién abierta. El que vence antes es el
                    // que hay que enseñar.
                    orderBy: { expiresAt: 'asc' },
                    /**
                     * DOS, no una.
                     *
                     * Con `take: 1` la revisión de observación VENCIDA gana
                     * siempre el orden —su `expiresAt` está en el pasado y el
                     * de la ventana de entrada del turno está 4 h en el
                     * futuro—, así que durante 24 h enterraba la ventana de
                     * quien está mirando la tableta. Son dos obligaciones
                     * distintas y caben las dos: una franja cada una.
                     */
                    take: 2,
                    select: { id: true, expiresAt: true, reason: true, orderedAt: true, status: true }
                }
            },
            orderBy: { name: 'asc' }
        });

        /**
         * LA ÚLTIMA ROTACIÓN DE CADA RESIDENTE, SIN TRAER EL HISTORIAL ENTERO.
         *
         * ═══ QUÉ HACÍA PRISMA ═══
         *
         * Esto era una relación más del `select`:
         *
         *     posturalChanges: { orderBy: { performedAt: 'desc' }, take: 1 }
         *
         * Parece inocente y no lo es. El SQL que Prisma emite para un `take: 1`
         * anidado NO LLEVA LIMIT — capturado el 28-sep-2026 con el log de
         * consultas contra producción:
         *
         *     SELECT <todas las columnas> FROM "PosturalChangeLog"
         *     WHERE "patientId" IN ($1…$31)
         *     ORDER BY "performedAt" DESC
         *     OFFSET $32
         *
         * O sea que se trae **las 19.336 filas** del historial de rotaciones de
         * esos 31 residentes y hace el «quédate con la primera de cada uno» EN
         * MEMORIA, en el servidor de Next. En cada poll de la pantalla del piso.
         *
         * ═══ MEDIDO CONTRA PRODUCCIÓN, mediana de 5 pasadas ═══
         *
         *     take: 1 anidado de Prisma ......... 2.033 ms
         *     DISTINCT ON en Postgres ...........   136 ms      ← 15x
         *
         *     y dentro de la consulta grande, esa sola relación costaba 1.287 ms
         *     de los ~2.000 totales: más que todas las demás juntas.
         *
         * El índice ya existía —`(patientId, performedAt DESC)`— y `DISTINCT ON`
         * lo usa; el problema nunca fue la base, sino el SQL que se le mandaba.
         *
         * Va en paralelo con la consulta grande: se acota por sede y estado, que
         * es un superconjunto de los residentes que se devuelven, así que no
         * hace falta esperar a tener sus ids.
         */
        const ultimaRotacionPorResidente = prisma.$queryRaw<Array<{
            id: string; patientId: string; nurseId: string; position: string;
            performedAt: Date; createdAt: Date; isComplianceAlert: boolean | null;
            esImputable: boolean | null;
        }>>`
            SELECT DISTINCT ON (pc."patientId") pc.*
            FROM "PosturalChangeLog" pc
            JOIN "Patient" p ON p.id = pc."patientId"
            WHERE p."headquartersId" = ${hqId}
              AND p.status IN ('ACTIVE', 'TEMPORARY_LEAVE')
            ORDER BY pc."patientId", pc."performedAt" DESC
        `;

        // FASE 80: Residentes en hospital permanecen en el censo (con badge),
        // pero sus medicamentos NO aparecen en el eMAR activo del turno.
        // Sprint N.4: anexar overrideInfo al residente que está cubierto por
        // redistribución (para pintar el badge "COBERTURA [COLOR]" en el tablet).
        const rotaciones = new Map((await ultimaRotacionPorResidente).map(r => [r.patientId, r]));

        const patients = patientsRaw.map(p => {
            const override = overrideByPatientId.get(p.id);
            /**
             * `photoUrl` conserva el NOMBRE y cambia el VALOR: antes traía los
             * 43 kB del JPEG, ahora la URL de donde bajarlo. Así el único sitio
             * que lo consume —ZendiCameraEnhancer, que hace
             * `{currentPhotoUrl ? <img/> : iniciales}`— no cambia ni una línea,
             * y `null` sigue significando «no tiene foto».
             */
            const v = versionFoto.get(p.id);
            // `posturalChanges` conserva la forma que la tableta ya leía: un
            // array con la última rotación, o vacío si no hay ninguna.
            const rot = rotaciones.get(p.id);
            const conFoto = {
                ...p,
                photoUrl: v ? `/api/care/foto/${p.id}?v=${v}` : null,
                posturalChanges: rot ? [rot] : [],
            };
            const base = p.status === 'TEMPORARY_LEAVE' ? { ...conFoto, medications: [] } : conFoto;
            if (override) {
                return {
                    ...base,
                    overrideInfo: {
                        originalColor: override.originalColor,
                        reason: override.reason,
                    },
                };
            }
            return base;
        });

        const hospitalizedCount = patientsRaw.filter(p => p.status === 'TEMPORARY_LEAVE' && p.leaveType === 'HOSPITAL').length;

        // Nivel 3 — desglose propios vs cobertura para el header del tablet.
        const overrideSet = new Set(overridePatientIds);
        const ownCount = patientsRaw.filter(p => !overrideSet.has(p.id)).length;
        const coverageCount = patientsRaw.filter(p => overrideSet.has(p.id)).length;

        // Events targeted a este cuidador: ALL + match con cualquiera de sus colores.
        // Si es cuidadora solitaria (isSolo → includesAll forzado), ve todos los eventos.
        const eventColorOrs = colors.length > 0 && !includesAll
            ? colors.map(c => ({ targetGroups: { has: c } }))
            : [];

        // Eventos dirigidos a un residente concreto (targetPopulation SPECIFIC).
        // Aqui vivian las citas de familia: al aprobar una videollamada o visita
        // se crea un HeadquartersEvent con targetPopulation 'SPECIFIC',
        // targetGroups [] y targetPatients [idDelResidente]. El OR de abajo solo
        // tenia rama para 'ALL' y para grupos de color, asi que esos eventos no
        // podian salir NUNCA en la tableta — no fallaban a veces, era estructural.
        //
        // Maria del Pilar Velez pidio 9 citas para Hector Velez Grau, 6 se
        // aprobaron y ninguna llego a la cuidadora. No las ignoraron: no les
        // llegaron. Se incluyen los residentes de cobertura porque quien cubre
        // es quien tiene que atender la llamada.
        const misPacientes = patientsRaw.map(p => p.id);
        const eventPatientOrs = misPacientes.length > 0
            ? [{ targetPopulation: 'SPECIFIC', targetPatients: { hasSome: misPacientes } }]
            : [];

        /**
         * EL DIA ENTERO, NO "HASTA AHORA".
         *
         * La ventana era [inicio del dia clinico .. `todayEnd`], y `todayEnd` es
         * `new Date()` — o sea AHORA. Con eso un evento de las 11:00 no aparecia
         * a las 8:00: aparecia a las 11:00, cuando ya habia empezado.
         *
         * El caso que lo destapo: la videollamada de Hector Velez con su hija
         * era hoy 16-sep a las 11:00, aprobada el domingo. La cuidadora que tenia
         * que tenerlo listo no pudo verla en la tableta hasta las 11:00 en punto.
         *
         * Un aviso que llega cuando el acto ya empezo no es un aviso. Ahora la
         * ventana cubre el dia clinico completo: lo que viene se ve venir.
         */
        const finDelDiaClinico = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

        const events = await prisma.headquartersEvent.findMany({
            where: {
                headquartersId: hqId,
                startTime: { gte: todayStart, lt: finDelDiaClinico },
                type: { not: 'INFRASTRUCTURE' },
                assignedToId: null,
                targetPopulation: { not: 'STAFF' },
                title: { not: { startsWith: 'Ronda de Supervisor' } },
                OR: [
                    { targetPopulation: 'ALL' },
                    ...eventColorOrs,
                    ...eventPatientOrs,
                ],
            },
            include: {
                patient: { select: { id: true, name: true } }
            },
            orderBy: { startTime: 'asc' }
        });

        return NextResponse.json({
            success: true,
            patients,
            events,
            hospitalizedCount,
            isSolo,
            ownCount,
            coverageCount,
        });
    } catch (error: any) {
        logError('care.get', error);
        return NextResponse.json({ success: false, error: "Error: " + (error.message || String(error)) }, { status: 500 });
    }
}
