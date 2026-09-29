import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolverHoraReal } from '@/lib/hora-real';
import { format } from 'date-fns';
import { todayStartAST, parseTimeOfDay } from '@/lib/dates';
import { withPhiAccessLog } from '@/lib/phi-audit';
import { requireRole } from '@/lib/api-auth';
import { conciliarUna, instanteDeLaFranja } from '@/lib/emar-conciliar';
import { minutosDeAdelanto, avisoDeAdelanto, instanteDeclaradoValido, ventanaDelRosterDeDireccion, ocurrenciaEnVentana } from '@/lib/margen-firma';
import { mismaFranja } from '@/lib/franja-horaria';

/**
 * QUIEN PUEDE VER Y ESCRIBIR EL eMAR.
 *
 * Esta ruta comprobaba UNICAMENTE que hubiera sesion iniciada. No miraba el rol
 * y, en el POST, tampoco la sede.
 *
 * LO QUE ESO SIGNIFICABA, medido en Cupey el 05-sep-2026:
 *
 *   · El GET devolvia 33 residentes con sus 261 medicamentos activos a
 *     CUALQUIER cuenta con sesion en la sede. Tres cuentas activas no clinicas
 *     tienen headquartersId de Cupey: cocina, mantenimiento y un INVERSIONISTA.
 *     Un inversionista con la lista de medicacion de cada residente no es un
 *     detalle de permisos.
 *
 *   · El POST escribia una administracion de medicamento —firmada con el id de
 *     quien llamara— sin comprobar rol NI sede. `patientMedicationId` venia del
 *     body y nada verificaba que ese medicamento fuera de un residente de la
 *     sede del invocador. O sea: fuga multi-tenant en escritura, sobre el
 *     registro clinico que dice quien recibio que farmaco.
 *
 * Ver las preguntas 1, 2 y 3 de la auditoria proactiva en CLAUDE.md. Las tres
 * fallaban en el mismo archivo.
 */
/**
 * LEER el roster. SOCIAL_WORKER incluido, con el mismo criterio que ya estaba
 * decidido en /api/emar/patient/[id]: trabajo social lee el eMAR del residente
 * para contextualizar su caso. Como ya puede leerlo uno a uno, bloquearle el
 * listado no protegeria nada y si podria romperle una pantalla.
 */
const VEN_EMAR = ['CAREGIVER', 'NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN', 'SOCIAL_WORKER'];

/**
 * ESCRIBIR una administracion. SOCIAL_WORKER fuera — la decision ya estaba
 * tomada y escrita en /api/emar/patient/[id]: "la administracion de meds vive
 * en /api/care/meds/bulk y /api/emar/route.ts (escritura), donde SW NO esta".
 * Hasta hoy esa frase describia una intencion que el codigo no cumplia.
 */
const ADMINISTRAN = ['CAREGIVER', 'NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN'];

// PHI audit (Pilar 1) — roster eMAR de la sede (lista).
export const GET = withPhiAccessLog(getEmarRosterHandler, { resourceType: 'eMAR' });

async function getEmarRosterHandler(req: Request) {
    try {
        const auth = await requireRole(VEN_EMAR);
        if (auth instanceof NextResponse) return auth;

        const hqId = auth.headquartersId;
        const todayStart = todayStartAST();
        const todayEnd = new Date();
        /**
         * ESTE ROSTER SIGUE EN EL DIA NATURAL, Y NO ES UN OLVIDO.
         *
         * El 29-sep-2026 se movio la frontera en la tableta (/api/care) a
         * `ventanaDeDosisDeLaTableta`. Se intento traerla aqui el mismo dia y se
         * revirtio al verificarla: arregla una cosa y rompe dos.
         *
         * LO QUE ARREGLABA, medido simulando este GET contra produccion el
         * 27-sep sobre 293 franjas: de 00:00 a 04:00 esta pantalla pintaba
         * **293 de 293** franjas como SIN_PROGRAMAR —las filas de hoy no existen
         * hasta que el cron corre a las 04:00 y las de anoche caian fuera— y eso
         * no se distinguia de una jornada en la que de verdad faltara firmarlo
         * todo. Con la ventana nueva bajaba a 7.
         *
         * LO QUE ROMPIA, medido igual:
         *
         *   · La franja de las 5:00 AM. Su dosis de la jornada en curso cae al
         *     dia natural SIGUIENTE, asi que la unica ocurrencia ya pasada es la
         *     de la jornada ANTERIOR. A las 02:00 pasaba de {SIN_PROGRAMAR: 11}
         *     a {ADMINISTERED: 10} con la firma de ayer — y la pantalla, al
         *     verla resuelta, QUITA los tres botones. Cambia un "no sabemos" que
         *     dejaba actuar por una afirmacion falsa que no deja.
         *   · El panel rojo de esta pantalla dice "N dosis de HOY sin
         *     administrar". De madrugada, **393 de 414** entradas eran de un dia
         *     de calendario anterior. El titular miente y no hay fecha en la
         *     lista.
         *
         * Las dos salen del mismo sitio: la ventana alcanza otro dia y la
         * PANTALLA no sabe de que dia es cada dosis. Moverla de verdad pide
         * trabajo de interfaz aqui —fecha por dosis, titular del panel, y una
         * decision de producto sobre que significa la franja de las 5:00 AM en
         * un roster de dia natural— y eso no se hace de paso.
         *
         * Lo que SI quedo hecho es la mitad de identidad: la pantalla manda el
         * instante y el servidor lo valida en vez de deducirlo de su reloj. Con
         * esta ventana de 24 h las dos vias coinciden siempre, asi que hoy no
         * cambia nada; pero cuando la frontera se mueva, esta parte ya esta.
         * Mismo orden que se siguio en la tableta (commits 70083427 y 1f840c78).
         */
        const ventanaDosis = ventanaDelRosterDeDireccion(todayEnd);

        // 1. Obtener todos los residentes de la HQ que tengan medicación activa
        // Excluye DISCHARGED y DECEASED (alineado con convención estándar
        // del resto de endpoints). TEMPORARY_LEAVE sí aparece — historial de
        // meds sigue siendo relevante durante hospitalización.
        const patients = await prisma.patient.findMany({
            where: {
                headquartersId: hqId,
                status: { in: ['ACTIVE', 'TEMPORARY_LEAVE'] },
            },
            include: {
                medications: {
                    where: { isActive: true },
                    include: {
                        medication: true,
                        /**
                         * LAS DOSIS DE HOY, UNA POR UNA — NO "LA ULTIMA".
                         *
                         * Esto traia `take: 1` de las administraciones con
                         * `administeredAt` de hoy, y de ahi salia UN estado por
                         * receta. Con eso la pantalla no podia distinguir nada:
                         * medido el 16-sep, pintaba 251 filas y las 251 decian
                         * PENDING, incluidas las 10 dosis que el panel de
                         * direccion anunciaba como no administradas.
                         *
                         * Ademas `administeredAt` es nulo en todo lo que no se
                         * administro —justamente lo que se quiere ver—, asi que
                         * una omision no podia aparecer nunca.
                         *
                         * Ahora viajan las dosis de hoy con su hora y su estado,
                         * y la pantalla puede decir "las 5:00 AM sin administrar"
                         * en vez de un PENDING generico. La ventana es el dia
                         * NATURAL de Puerto Rico y va por `scheduledTime`, que es
                         * la identidad de la dosis; `administeredAt` solo decide
                         * en las filas sin hora pautada (PRN y lo anterior al cron).
                         */
                        administrations: {
                            where: {
                                OR: [
                                    { scheduledTime: { gte: ventanaDosis.desde, lt: ventanaDosis.hasta } },
                                    { scheduledTime: null, administeredAt: { gte: todayStart, lte: todayEnd } },
                                ],
                            },
                            orderBy: { scheduledTime: 'asc' },
                            select: {
                                id: true, status: true, scheduledFor: true,
                                scheduledTime: true, administeredAt: true,
                            },
                        }
                    }
                }
            }
        });

        // 2. Mapear al modelo DTO que espera el Frontend eMAR
        const payload = patients.map((p: any) => {
            return {
                id: p.id,
                name: p.name,
                room: p.roomNumber || 'Piso General',
                medications: p.medications.map((pm: any) => {
                    /**
                     * LAS FRANJAS PAUTADAS DE ESTA RECETA, y la dosis de hoy de
                     * cada una. `scheduleTimes` es texto separado por comas
                     * ("08:00 AM, 08:00 PM"), y la pantalla necesita poder actuar
                     * sobre UNA franja, no sobre la receta entera: mandar la
                     * cadena completa como `scheduledFor` no identifica ninguna
                     * dosis y la conciliacion no encuentra su fila.
                     */
                    const franjas: string[] = pm.frequency === 'PRN'
                        ? []
                        : String(pm.scheduleTimes ?? '').split(',').map((t: string) => t.trim()).filter(Boolean);

                    const dosisDeHoy = franjas.map((franja: string) => {
                        /**
                         * `mismaFranja` Y NO `===`, PORQUE HAY DOS FORMATOS.
                         *
                         * `scheduledFor` lo escriben dos sitios distintos y no
                         * de la misma forma:
                         *
                         *   · el cron, el token literal de la receta
                         *     (emar-schedule.ts) ................. "05:00 AM"
                         *   · la tableta, la etiqueta canónica del pack
                         *     (meds/bulk, `scheduleTime = pack.label`)  "5:00 AM"
                         *
                         * Y las 255 recetas activas usan TODAS el token con cero
                         * delante, así que toda fila escrita por el camino
                         * `createMany` de la tableta quedaba invisible aquí.
                         *
                         * MEDIDO el 29-sep-2026 simulando este mismo GET día a
                         * día contra producción: **52 dosis ADMINISTERED salían
                         * como SIN_PROGRAMAR** teniendo su fila escrita en el
                         * otro formato. El peor día, el 21-sep: 17 de 293
                         * franjas pintadas (5,8 %). Todas por origen TABLETA;
                         * ninguna por CRON.
                         *
                         * En pantalla eso es una dosis que la cuidadora YA firmó
                         * pintada con reloj gris y con los botones de firmar
                         * ofrecidos, como si nadie la hubiera dado.
                         *
                         * La solución ya existía y estaba aplicada en el otro
                         * sitio: `mismaFranja` en src/lib/franja-horaria.ts, que
                         * la tableta usa desde el 22-sep. Esta era la copia que
                         * quedó sin arreglar — el mismo patrón que el propio
                         * comentario de ese fichero describe.
                         */
                        /**
                         * Y AHORA POR INSTANTE PRIMERO, PORQUE LA ETIQUETA YA NO
                         * IDENTIFICA UNA DOSIS.
                         *
                         * Con la ventana de 48 h de la madrugada, "08:00 PM"
                         * casa con DOS filas: la de anoche y la de esta noche.
                         * `find` devuelve la primera del `orderBy: asc`, o sea
                         * SIEMPRE la mas vieja. Un director mirando a la 01:00
                         * veria el estado de anteanoche con el rotulo de hoy.
                         *
                         * Es el mismo arreglo que `slotStatusToday` en la
                         * tableta. La ocurrencia que toca la elige
                         * `ocurrenciaEnVentana`, que tiene su propia regla
                         * porque esta pantalla no tiene turno.
                         */
                        let instante: Date | null = null;
                        try {
                            const { hour, minute } = parseTimeOfDay(franja);
                            instante = ocurrenciaEnVentana(hour, minute, todayEnd, ventanaDosis);
                        } catch { /* no es una hora: se queda con la etiqueta */ }

                        const fila = (instante
                                ? pm.administrations.find((a: any) =>
                                    a.scheduledTime && a.scheduledTime.getTime() === instante!.getTime())
                                : null)
                            /**
                             * `mismaFranja` Y NO `===` en el respaldo, porque hay
                             * DOS FORMATOS de `scheduledFor`: el cron escribe el
                             * token de la receta ("05:00 AM") y la tableta la
                             * etiqueta del pack ("5:00 AM"). Medido el 29-sep,
                             * 52 dosis ADMINISTERED salian SIN_PROGRAMAR por eso.
                             * Solo aplica a filas SIN instante — PRN y lo
                             * anterior al 15-sep.
                             */
                            ?? pm.administrations.find((a: any) =>
                                !a.scheduledTime && mismaFranja(a.scheduledFor, franja))
                            // Lo mas viejo: ni instante ni franja escrita.
                            ?? pm.administrations.find((a: any) => !a.scheduledFor && a.scheduledTime === null);
                        return {
                            franja,
                            // El instante viaja al cliente para que firme SOBRE
                            // esta dosis y no sobre la que el servidor deduzca
                            // de su reloj. Igual que el pack de la tableta.
                            instante: instante?.toISOString() ?? null,
                            estado: fila ? fila.status : 'SIN_PROGRAMAR',
                            administeredAt: fila?.administeredAt ?? null,
                        };
                    });

                    const sinAdministrar = dosisDeHoy.filter((d: any) => d.estado === 'MISSED');

                    const latestAdmin = pm.administrations[0];
                    return {
                        // Las franjas de hoy con su estado real. Lo que permite a la
                        // pantalla decir "las 5:00 AM sin administrar".
                        dosisDeHoy,
                        sinAdministrar: sinAdministrar.length,
                        id: pm.id,
                        name: pm.medication.name,
                        dosage: pm.medication.dosage,
                        route: pm.medication.route,
                        time: pm.frequency === 'PRN' ? 'PRN' : pm.scheduleTimes, // Tratamiento simple inicial
                        instructions: pm.instructions || 'Dosis Estándar',
                        status: latestAdmin ? latestAdmin.status : 'PENDING' // ADMINISTERED, REFUSED, OMITTED
                    };
                })
            };
        });

        // Filtrar residentes que no tienen medicaciones para no ensuciar el dashboard
        const activePayload = payload.filter((p: any) => p.medications.length > 0);

        return NextResponse.json({ success: true, patients: activePayload });

    } catch (error) {
        console.error('Error fetching eMAR Roster:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const auth = await requireRole(ADMINISTRAN);
        if (auth instanceof NextResponse) return auth;

        const body = await req.json();
        const { patientMedicationId, status, notes, scheduledFor, administeredAt: horaDeclarada, franjaInstante } = body;
        // El firmante SIEMPRE sale de la sesion, nunca del body.
        const nurseId = auth.id;

        // Validaciones Cero-Error
        if (!patientMedicationId || !status) {
            return NextResponse.json({ error: 'Faltan parámetros biométricos' }, { status: 400 });
        }

        /**
         * El medicamento tiene que ser de un residente de ESTA sede.
         *
         * Faltaba por completo: `patientMedicationId` llegaba del body y se
         * escribia sin comprobar nada. Cualquiera con sesion en cualquier sede
         * podia firmar una administracion sobre el expediente de un residente
         * de otra.
         */
        const receta = await prisma.patientMedication.findFirst({
            where: { id: patientMedicationId, patient: { headquartersId: auth.headquartersId } },
            select: { id: true },
        });
        if (!receta) {
            return NextResponse.json({ error: 'Medicamento no encontrado en tu sede' }, { status: 404 });
        }

        /**
         * SE FIRMA LA DOSIS QUE EL CRON YA CREÓ.
         *
         * Esta pantalla manda `scheduledFor` con la franja del medicamento
         * (`selectedMed.time`, que sale de `pm.scheduleTimes`), así que la
         * conciliación es exacta y no una adivinanza: `conciliarUna` reconstruye
         * el mismo instante que usó `materializarDosisDelDia` y busca por la
         * llave única. Ver src/lib/emar-conciliar.ts.
         *
         * Sin esto pasaba lo que le pasó a la tableta el 15-sep-2026: dos filas
         * por dosis —la firmada y la del cron, sin firmar— y al cerrar el turno
         * la segunda quedaba marcada como omitida. Diez omisiones fantasma en
         * una sola mañana, con nombre de residente encima.
         *
         * Si no hay fila que conciliar —un PRN, una receta creada después del
         * cron— se crea suelta, como siempre.
         */
        const ahora = new Date();

        /**
         * LA HORA LA DECLARA QUIEN REGISTRA, Y NO SE INVENTA SOLA.
         *
         * Esta ruta clavaba `administeredAt = ahora` SIEMPRE, sin forma de
         * decir a qué hora se administró de verdad. Es la pantalla de
         * dirección, o sea el sitio desde el que se registra lo que ya pasó:
         * el 21-sep-2026 eso dejó **51 dosis pautadas a las 8:00 AM diciendo
         * que se dieron a las 17:0x**, después de que Andrés llamara por
         * teléfono a las cuidadoras para confirmar que sí se habían dado. La
         * hora del tecleo escrita como si fuera la del acto.
         *
         * `resolverHoraReal` aplica los mismos límites que el resto (hasta 19 h
         * atrás, nada en el futuro). Sin hora declarada sigue siendo `ahora`,
         * que es el comportamiento de siempre.
         *
         * Y PONE `administeredAt` SOLO SI SE ADMINISTRÓ. Antes lo escribía
         * también para REFUSED y OMITTED — una hora de administración en una
         * dosis que nadie administró.
         */
        const hora = resolverHoraReal(horaDeclarada, ahora);
        if (!hora.ok) {
            return NextResponse.json({ success: false, error: hora.error }, { status: 400 });
        }

        /**
         * LA CONCILIACION VA CON `ahora`, NO CON LA HORA DECLARADA.
         *
         * `conciliarUna` usa ese instante para reconstruir QUE dosis es —
         * `instanteDeLaFranja` toma su FECHA de calendario— y eso lo decide el
         * dia en curso, no la hora que teclee quien registra. Al pasarle
         * `hora.hora` (hasta 19 h atras) una franja de hoy se resolvia contra
         * la del dia ANTERIOR: medido, las 114 franjas de hoy se iban al dia de
         * ayer. Regresion introducida esta misma tarde al añadir la hora
         * declarable; la hora declarada se queda donde debe, en
         * `administeredAt`.
         */
        /**
         * TAMPOCO DESDE DIRECCIÓN SE FIRMA UNA DOSIS QUE NO TOCA.
         *
         * La misma regla que la tableta, y por el mismo motivo: esta pantalla
         * es justo desde la que se registra lo que ya pasó, así que la hora
         * declarada puede ir hacia atrás —`resolverHoraReal` la valida— pero la
         * FRANJA que se firma no puede estar en el futuro.
         *
         * Las 18 filas del 21-sep-2026 que dieron origen a la regla —el pack de
         * las 8:00 PM firmado a las 14:12— salieron por el camino del pack, no
         * por aquí. Pero la regla vale igual, y escribirla en un solo sitio es
         * lo que evita que dentro de un mes solo una de las dos copias esté
         * bien. Ver src/lib/margen-firma.ts.
         */
        /**
         * NINGUN estado se escribe sobre una franja que todavia no ha llegado.
         *
         * Esto decia `status === 'ADMINISTERED'`, y el razonamiento estaba mal:
         * di por hecho que marcar por adelantado que una dosis se va a retener
         * era un acto clinico legitimo, y que bloquearlo quitaba una capacidad.
         *
         * No anota una intencion: OCUPA LA FILA. Con
         * `@@unique([patientMedicationId, scheduledTime])`, la fila nace con el
         * instante de la dosis futura; el cron de las 04:00 hace `upsert` con
         * `update: {}` (emar-schedule.ts), asi que la respeta y NO crea la
         * PENDING; y esa noche `conciliarPack` la ve resuelta —OMITTED no esta
         * en ABIERTOS— y la tableta no ofrece el medicamento. La dosis real no
         * se puede dar ni firmar, y no queda traza en el log del cron.
         *
         * El camino: a la 01:30 la ronda "08:00 PM" sale entera SIN_PROGRAMAR
         * —las filas de hoy no existen hasta las 04:00 y la de anoche cae fuera
         * de la ventana de esta pantalla— y no se distingue de una en la que de
         * verdad falte firmar. Un toque en «Omitir» y la dosis de ESTA noche
         * nace omitida 18 h 30 min antes de tocar, mientras la omision de
         * anoche, que era lo que se queria anotar, sigue sin anotarse.
         *
         * Exposicion, no hemorragia: la ruta lleva 4 filas en toda la historia
         * y ninguna tiene esa forma. Se cierra la puerta antes de que el turno
         * de noche aprenda a empujarla.
         */
        /**
         * LA DOSIS LA IDENTIFICA LA PANTALLA, NO EL RELOJ DEL SERVIDOR.
         *
         * Igual que /api/care/meds/bulk desde el 29-sep. Sin esto, a la 01:30
         * "08:00 PM" reconstruia las ocho de ESTA noche —futuro— en vez de las
         * de anoche, que es la dosis sobre la que el director esta actuando.
         *
         * `instanteDeclaradoValido` exige que la hora de pared AST del instante
         * sea EXACTAMENTE la de la etiqueta y que caiga en la ventana. Si no
         * cuadra NO se reconstruye: se rechaza. Reconstruir cuando el cliente
         * declaro un instante escribe en otra dosis sin que nadie vea un error.
         */
        let instanteDeLaDosis: Date | null = null;
        if (scheduledFor && franjaInstante) {
            let esHora = true;
            try {
                const { hour, minute } = parseTimeOfDay(String(scheduledFor).trim());
                instanteDeLaDosis = instanteDeclaradoValido(
                    franjaInstante, hour, minute, ahora,
                    ventanaDelRosterDeDireccion(ahora),
                );
            } catch { esHora = false; }
            if (esHora && !instanteDeLaDosis) {
                return NextResponse.json({
                    success: false,
                    error: 'No se pudo identificar de qué dosis se trata. Recarga la pantalla y vuelve a intentarlo.',
                }, { status: 409 });
            }
        }

        if (scheduledFor) {
            const adelanto = minutosDeAdelanto(instanteDeLaDosis ?? instanteDeLaFranja(scheduledFor, ahora), ahora);
            if (adelanto !== null) {
                return NextResponse.json(
                    { success: false, error: avisoDeAdelanto(String(scheduledFor), adelanto) },
                    { status: 400 },
                );
            }
        }

        const fila = await conciliarUna(patientMedicationId, scheduledFor, ahora, instanteDeLaDosis);

        const datos = {
            administeredById: nurseId,
            status: status, // ADMINISTERED | REFUSED | OMITTED
            notes: notes || null,
            scheduledFor: scheduledFor || null,
            administeredAt: status === 'ADMINISTERED' ? hora.hora : null,
            /**
             * DE DÓNDE VIENE ESTA FILA.
             *
             * Las 76 administraciones que esta ruta escribió en 30 días no
             * llevan firma —ninguna, el 100%— y eso no es un descuido: aquí no
             * hay dedo sobre una pantalla, lo que autentica es la sesión. Lo
             * que faltaba era que la fila lo DIJERA, para que no se leyera como
             * una firma junto a la cama que se perdió.
             */
            origen: 'EMAR_DIRECCION' as const,
        };

        /**
         * SI YA ESTABA RESUELTA, SE DEVUELVE LA QUE HAY. NO SE CREA OTRA.
         *
         * Esta ruta creaba una fila suelta cuando la dosis ya estaba resuelta,
         * porque `conciliarUna` devolvía `null` igual que si no existiera. Un
         * doble toque, o una pantalla lenta, y quedaban dos filas por dosis —
         * y la segunda, sin `scheduledTime`, invisible para el pack de la
         * tableta, que horas después creaba una tercera. Es el mecanismo de las
         * 6 dosis contadas dos veces del 21-sep.
         *
         * Éxito y no error, que es lo que pide CLAUDE.md: quien pulsó hizo lo
         * correcto, y un rojo le hace intentarlo otra vez.
         */
        if (fila?.yaResuelta) {
            const yaEstaba = await prisma.medicationAdministration.findUnique({ where: { id: fila.id } });
            return NextResponse.json({
                success: true,
                adminLog: yaEstaba,
                yaEstaba: true,
                message: 'Esta dosis ya estaba registrada.',
            });
        }

        const adminLog = fila
            ? await prisma.medicationAdministration.update({ where: { id: fila.id }, data: datos })
            : await prisma.medicationAdministration.create({
                data: {
                    patientMedicationId,
                    ...datos,
                    /**
                     * LA FILA NUEVA VA ATADA A SU FRANJA.
                     *
                     * Sin `scheduledTime` la fila queda fuera de la llave única
                     * `(patientMedicationId, scheduledTime)` y es invisible para
                     * `conciliarPack` y para `slotStatusToday` en la tableta: el
                     * pack sigue saliendo abierto y la siguiente firma crea otra.
                     * `/api/care/meds/bulk` ya lo hacía; ésta era la divergencia,
                     * y es lo que dejó 12 filas sueltas el 21-sep.
                     *
                     * Y EL INSTANTE ES EL QUE DECLARÓ LA PANTALLA, NO EL DEL
                     * RELOJ DEL SERVIDOR.
                     *
                     * Esto reconstruía SIEMPRE con `ahora`. Mientras la pantalla
                     * solo enseñaba el día natural daba igual, porque las dos
                     * vías coincidían. Al ensanchar la ventana dejaron de
                     * coincidir, y como la guarda de adelanto de arriba pasó a
                     * usar el instante declarado, ya no frenaba nada:
                     *
                     *   01:30. El director omite el pack de las 8:00 PM de
                     *   ANOCHE. El instante declarado (anoche 20:00) pasa la
                     *   guarda —está en el pasado—, `conciliarUna` no encuentra
                     *   fila, y el `create` escribía `astDateTime(ahora, 20, 0)`
                     *   = las 8:00 PM de ESTA noche. La dosis de esta noche
                     *   nacía OMITIDA 18 h 30 min antes de tocar; el cron de las
                     *   04:00 hace `upsert` con `update: {}`, así que la
                     *   respetaba y no creaba la PENDING, sin traza en el log; y
                     *   la omisión de anoche seguía sin anotarse.
                     *
                     * Es el mismo camino que `/api/care/meds/bulk` cerró hoy,
                     * reabierto en esta copia — y abierto por el propio cambio
                     * que venía a arreglar esta pantalla.
                     *
                     * El comentario de arriba decía que aquí no se puede chocar
                     * con la llave única porque no existe fila para esa franja.
                     * Con el instante declarado vuelve a ser cierto: se busca y
                     * se escribe el MISMO instante.
                     */
                    scheduledTime: instanteDeLaDosis ?? instanteDeLaFranja(scheduledFor, ahora),
                },
            });

        return NextResponse.json({ success: true, adminLog, conciliada: !!fila });

    } catch (error) {
        console.error('Error saving Medication Admin:', error);
        return NextResponse.json({ error: 'Database Write Error' }, { status: 500 });
    }
}
