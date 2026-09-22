import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolverHoraReal } from '@/lib/hora-real';
import { format } from 'date-fns';
import { todayStartAST, astDateTime } from '@/lib/dates';
import { withPhiAccessLog } from '@/lib/phi-audit';
import { requireRole } from '@/lib/api-auth';
import { conciliarUna, instanteDeLaFranja } from '@/lib/emar-conciliar';

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
        // El dia NATURAL de Puerto Rico. `todayStartAST()` es el dia CLINICO
        // (arranca a las 6 AM) y parte en dos el pack de las 5:00 AM.
        const inicioDelDiaAST = astDateTime(todayEnd, 0, 0);
        const finDelDiaAST = new Date(inicioDelDiaAST.getTime() + 24 * 60 * 60 * 1000);

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
                                    { scheduledTime: { gte: inicioDelDiaAST, lt: finDelDiaAST } },
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
                        const fila = pm.administrations.find((a: any) => a.scheduledFor === franja)
                            // Respaldo para lo anterior al cron, que guardaba la franja en `scheduleTime`.
                            ?? pm.administrations.find((a: any) => !a.scheduledFor && a.scheduledTime === null);
                        return {
                            franja,
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
        const { patientMedicationId, status, notes, scheduledFor, administeredAt: horaDeclarada } = body;
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
        const fila = await conciliarUna(patientMedicationId, scheduledFor, ahora);

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
                     * Solo llega aquí cuando NO existe ninguna fila para esa
                     * franja, así que no puede chocar con la llave única.
                     */
                    scheduledTime: instanteDeLaFranja(scheduledFor, ahora),
                },
            });

        return NextResponse.json({ success: true, adminLog, conciliada: !!fila });

    } catch (error) {
        console.error('Error saving Medication Admin:', error);
        return NextResponse.json({ error: 'Database Write Error' }, { status: 500 });
    }
}
