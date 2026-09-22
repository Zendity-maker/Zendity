import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { huboRechazoEnElHueco } from '@/lib/rotacion-no-realizada';
import { variantesDePosicion } from '@/lib/posicion-rotacion';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { resolverHoraReal } from '@/lib/hora-real';
import { evaluarRotacion } from '@/lib/rotacion-imputable';
import { solapaConSinServicio } from '@/lib/ventanas-sin-servicio';
import { ULCERA_ABIERTA } from '@/lib/upp';

const ALLOWED_ROLES = ['CAREGIVER', 'NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN'];

/** Los tres tipos de pañal. Cualquier otro valor no escribe nada. */
const TIPOS_DE_PANAL = ['SECO', 'HUMEDO', 'EVACUACION'];

/**
 * SELLO DE RONDA NOCTURNA — el estado en que se encontró al residente.
 *
 * El texto va a `DailyLog.notes` detrás del prefijo `[RONDA NOCTURNA]`, y ESE
 * PREFIJO ES CONTRATO: lo leen `/api/care/rounds/check` para el SLA de dos
 * horas y `/api/care/supervisor/caregiver-rounds` para contar los toques de la
 * noche. Cambiarlo aquí apaga los dos en silencio.
 *
 * Se escribe en `DailyLog` y no en `ClinicalNote` por una razón concreta: de los
 * dos modelos, solo `DailyLog` tiene `isClinicalAlert`, y una anomalía a las
 * tres de la mañana tiene que aparecer en la bandeja del supervisor esa misma
 * noche, no quedarse en una nota que nadie abre.
 */
const ESTADOS_DE_RONDA: Record<string, string> = {
    SLEEPING: 'Sueño profundo',
    AWAKE: 'Despierto',
    ANOMALY: 'Anomalía',
};

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }
        const invokerId = (session.user as any).id;
        const invokerRole = (session.user as any).role;
        const hqId = (session.user as any).headquartersId;
        if (!ALLOWED_ROLES.includes(invokerRole)) {
            return NextResponse.json({ error: 'Rol no autorizado' }, { status: 403 });
        }

        const data = await req.json();
        // type: 'SECO' | 'HUMEDO' | 'EVACUACION' | 'ROTACION' | 'RONDA_NOCTURNA'
        const { patientId, type, position, estado, nota, performedAt: horaDeclarada } = data;

        // Hora real del cuido. Este es el camino que usa la tableta de verdad
        // (logNightRound), no /api/care/postural. Ver src/lib/hora-real.ts.
        const hora = resolverHoraReal(horaDeclarada);
        if (!hora.ok) {
            return NextResponse.json({ success: false, error: hora.error }, { status: 400 });
        }

        if (!patientId || !type) {
            return NextResponse.json({ success: false, error: 'Missing parameters' }, { status: 400 });
        }

        // Tenant check
        const patient = await prisma.patient.findFirst({
            where: { id: patientId, headquartersId: hqId },
            select: { id: true }
        });
        if (!patient) {
            return NextResponse.json({ success: false, error: 'Residente no encontrado' }, { status: 404 });
        }

        // authorId SIEMPRE del session — no se confía en body
        const authorId = invokerId;

        const isDayShift = data.dayShift === true;

        if (type === 'ROTACION') {
            /**
             * Guarda contra doble envio — misma que /adls/bath.
             *
             * Medido el 30-ago-2026: 3 325 rotaciones duplicadas de 17 958.
             * Mismo residente, misma posicion, misma cuidadora, con pares de UN
             * SEGUNDO de diferencia. No es solo ruido: la rotacion tardia
             * genera penalidad de -5 y un incidente HR, asi que un registro
             * doble tambien falsea el cumplimiento de UPP en la direccion
             * contraria — parece que se rota mas de lo que se rota.
             *
             * Dos minutos. Una rotacion real del mismo residente en ese lapso
             * no existe: el objetivo son 120 minutos.
             */
            /**
             * LA VENTANA VA ALREDEDOR DE LA HORA QUE SE VA A ESCRIBIR, NO DEL
             * RELOJ — Y COMPARA LA POSICION.
             *
             * Buscaba `performedAt >= Date.now() - 2min` pero escribe
             * `performedAt: hora.hora`, que es la hora DECLARADA por la
             * cuidadora y puede ir hasta 19 h hacia atras (MAX_ATRAS_HORAS en
             * src/lib/hora-real.ts, que subio de 12 a 19 el 21-sep). O sea que
             * la guarda no veia lo que ella misma acababa de escribir. Es el
             * mismo fallo que `adls/meal` pago el 14-sep y arreglo asi.
             *
             * Medido el 22-sep sobre los 24 dias desde que la guarda existe:
             * 102 pares del mismo residente a menos de 120 s, 57 por debajo de
             * 300 ms y 9 por debajo de 50 ms — no son reenvios retroactivos,
             * son dos peticiones concurrentes.
             *
             * Y AHORA MIRA `position`. Antes casaba cualquier rotacion del
             * mismo residente en la ventana, asi que quien registraba
             * "Izquierdo" y se corregia a "Derecha" en el mismo minuto perdia
             * la correccion en silencio. Los duplicados reales son de la MISMA
             * posicion: de los 357 pares medidos, todos repetian posicion.
             */
            const posicionAEscribir = position || "Rotación General (Pre-programada Zendi)";
            const rotacionReciente = await prisma.posturalChangeLog.findFirst({
                where: {
                    patientId,
                    /**
                     * POR LADO, NO POR CADENA.
                     *
                     * La tira de la cara escribe "Izquierdo" y el modal
                     * "IZQUIERDA": el mismo decubito con dos vocabularios. Con
                     * la cadena exacta, un doble toque que cruza las dos
                     * superficies no se veia.
                     *
                     * Medido sobre los 357 pares del mismo residente a menos de
                     * 2 min en 30 dias: la guarda vieja (cualquier rotacion)
                     * atrapaba los 357 pero se tragaba las correcciones; por
                     * cadena exacta caia a 319; **por lado atrapa 329 y deja
                     * pasar 28**. Y 329 + 28 = 357 exactamente: los 329 son
                     * mismo lado —duplicados de verdad— y los 28 son cambio de
                     * lado, que es justo lo que hay que dejar escribir.
                     */
                    position: { in: variantesDePosicion(posicionAEscribir) },
                    performedAt: {
                        gte: new Date(hora.hora.getTime() - 2 * 60 * 1000),
                        lte: new Date(hora.hora.getTime() + 2 * 60 * 1000),
                    },
                },
                select: { id: true },
            });
            if (rotacionReciente) {
                // Exito, no error: la cuidadora hizo lo correcto y un rojo la
                // haria repetirlo, que es lo que causa el duplicado.
                return NextResponse.json({
                    success: true,
                    duplicada: true,
                    message: 'Esta rotación ya estaba registrada hace un momento.',
                });
            }

            /**
             * ESTA PANTALLA TAMBIEN MIDE. Antes escribia `isComplianceAlert: false`
             * en duro, o sea que declaraba "a tiempo" sin mirar el reloj.
             *
             * Medido el 16-sep-2026: de 5.454 rotaciones en 30 dias, **5.316 —el
             * 97,5%— salen por aqui** y ninguna se evaluaba. Las 138 restantes
             * pasaban por /api/care/postural y cargaban las 48 banderas de la casa.
             * O sea que la penalidad no medía el trabajo: medía QUE PANTALLA usaste.
             *
             * Y era peor que no medir, porque `compliance-score.ts` cuenta
             * `isComplianceAlert: false` como rotacion PUNTUAL: la pantalla que no
             * medía, PREMIABA. Diez de trece cuidadoras marcaban exactamente 100%
             * de puntualidad. Carlos Negron tenia 667 rotaciones, cero banderas, y
             * era dueño de 5 de los 18 huecos que se le cobraron a otra persona.
             *
             * Con la regla de autoria esto no dispara una avalancha: de 1.110
             * huecos reales de mas de 135 min en 30 dias, 592 son del propio autor
             * y quedan **148 imputables**, repartidas entre doce personas. Era la
             * misma medicion que antes daba ~1.100 con la regla vieja de cobrarle
             * al que cierra.
             */
            const anterior = await prisma.posturalChangeLog.findFirst({
                where: { patientId },
                orderBy: { performedAt: 'desc' },
                select: { nurseId: true, performedAt: true },
            });

            const conOrden = await prisma.patient.findUnique({
                where: { id: patientId },
                select: {
                    status: true,
                    requiresPosturalChanges: true,
                    pressureUlcers: { where: ULCERA_ABIERTA, select: { id: true } },
                },
            });

            /**
             * Y LA CUARTA: alguien lo intentó y no se pudo.
             *
             * Sin esto, quien registra honestamente un rechazo sale PEOR que
             * quien firma una rotación falsa: la falsa reinicia el reloj y la
             * honesta deja el hueco abierto, que luego se le cobra a quien
             * llegue detrás. Con ese incentivo nadie vuelve a registrar un
             * rechazo, y volvemos al texto libre del que salimos.
             *
             * Es "veracidad, no puntuación": el dato se queda verdadero —a la
             * residente no la movió nadie, y el reloj sigue rojo— y lo que se
             * retira es el castigo. Ver src/lib/rotacion-no-realizada.ts.
             */
            const exento =
                !conOrden ||
                !(conOrden.requiresPosturalChanges || conOrden.pressureUlcers.length > 0) ||
                conOrden.status !== 'ACTIVE' ||
                (!!anterior && solapaConSinServicio(new Date(anterior.performedAt), new Date())) ||
                await huboRechazoEnElHueco(patientId, anterior?.performedAt ?? null, hora.hora);

            const veredicto = await evaluarRotacion({
                caregiverId: authorId,
                anterior,
                momento: hora.hora,
                exento,
            });

            await prisma.posturalChangeLog.create({
                data: {
                    patientId,
                    nurseId: authorId,
                    position: posicionAEscribir,
                    performedAt: hora.hora,
                    isComplianceAlert: veredicto.tarde,
                    esImputable: veredicto.imputable,
                }
            });
            return NextResponse.json({
                success: true,
                message: 'Rotación guardada',
                tarde: veredicto.tarde,
            });
        } else if (type === 'RONDA_NOCTURNA') {
            /**
             * EL SELLO DE LA RONDA DE NOCHE.
             *
             * Estuvo roto desde el 29-mar-2026 (commit 5a763bb): esta ruta se
             * reescribió para el pañal y la rotación, el cliente se quedó
             * mandando `status`/`note`, y como el contrato nuevo exige `type`
             * el endpoint devolvía 400 en CADA toque. Cinco meses y medio en
             * los que la cuidadora veía "Error Clínico: Missing parameters" en
             * rojo y la noche de ese residente quedaba sin ronda en el
             * expediente. La mitad viva del módulo —pañal y rotación— lo tapó:
             * el panel se veía lleno.
             */
            const etiqueta = ESTADOS_DE_RONDA[String(estado)];
            if (!etiqueta) {
                return NextResponse.json(
                    { success: false, error: 'Falta el estado en que se encontró al residente.' },
                    { status: 400 },
                );
            }

            const texto = typeof nota === 'string' ? nota.trim() : '';

            /**
             * La anomalía sin describir se rechaza AQUÍ, no solo en la tableta.
             * Una validación que vive únicamente en el cliente no es una
             * validación: basta otro cliente, o el mismo en otro estado, para
             * saltársela. Es lo que ya pasa con la firma del PRN.
             */
            if (estado === 'ANOMALY' && texto.length < 5) {
                return NextResponse.json(
                    { success: false, error: 'Describe la anomalía antes de sellar la ronda.' },
                    { status: 400 },
                );
            }

            const notas = `[RONDA NOCTURNA] ${etiqueta}.${texto ? ` ${texto}` : ''}`;

            /**
             * Guarda contra doble envío — la misma forma que la rotación.
             *
             * Se compara el ESTADO, no solo el residente: si vuelve a los tres
             * minutos y ahora encuentra una anomalía, eso es un hecho nuevo y
             * tiene que entrar. Tragarse una anomalía por parecerse a un sello
             * anterior sería peor que el duplicado que se quiere evitar.
             */
            const diezMinutosAtras = new Date(Date.now() - 10 * 60 * 1000);
            const selloReciente = await prisma.dailyLog.findFirst({
                where: {
                    patientId,
                    authorId,
                    notes: { startsWith: `[RONDA NOCTURNA] ${etiqueta}` },
                    createdAt: { gte: diezMinutosAtras },
                },
                select: { id: true },
            });
            if (selloReciente) {
                // Éxito, no error: ella hizo lo correcto.
                return NextResponse.json({
                    success: true,
                    duplicada: true,
                    message: 'Esta ronda ya estaba sellada hace un momento.',
                });
            }

            await prisma.dailyLog.create({
                data: {
                    patientId,
                    authorId,
                    notes: notas,
                    // Lo que mete la anomalía en la bandeja del supervisor esa
                    // misma noche (care/supervisor/live e inbox-count).
                    isClinicalAlert: estado === 'ANOMALY',
                    // Una ronda no dice nada del baño ni de la comida. `null` en
                    // `foodIntake` es exactamente eso; un 100 por defecto sería
                    // inventar que comió. Ver el comentario del campo en el schema.
                    bathCompleted: false,
                    foodIntake: null,
                    // Hora real de la ronda. `createdAt` sigue siendo el tecleo.
                    occurredAt: hora.hora,
                },
            });

            return NextResponse.json({ success: true, message: 'Ronda sellada' });
        } else {
            if (!TIPOS_DE_PANAL.includes(type)) {
                // Antes cualquier `type` desconocido caía aquí y creaba una nota
                // con el contenido vacío: una fila en el expediente que no dice nada.
                return NextResponse.json({ success: false, error: `Tipo de registro no reconocido: ${type}` }, { status: 400 });
            }

            // Prefijo diferente para diurno vs nocturno para no interferir con SLA nocturno
            const prefix = isDayShift ? '[CAMBIO PAÑAL DIURNO ZENDI]' : '[RONDA NOCTURNA ZENDI]';
            let notes = "";
            if (type === 'SECO') notes = `${prefix} Control de continencia: Pañal Seco. Sin novedades.`;
            if (type === 'HUMEDO') notes = `${prefix} Cambio de pañal por humedad regular. Higiene realizada.`;
            if (type === 'EVACUACION') notes = `${prefix} Cambio de pañal por evacuación. Higiene mayor realizada y piel protegida.`;

            const titulo = isDayShift ? `Continencia Diurna (${type})` : `Ronda de Cuidado (${type})`;

            /**
             * Guarda contra doble envío — a esta rama le faltaba.
             *
             * Medido el 13-sep-2026 sobre las 9 166 notas de 90 días: 280 pares
             * del mismo residente y el mismo tipo separados por menos de dos
             * minutos, 145 de ellos por menos de DIEZ SEGUNDOS. Las tres
             * últimas filas de la base eran tres "Ronda de Cuidado (SECO)" del
             * mismo residente en veinte segundos. La rama de ROTACION tiene esta
             * guarda desde el 30-ago; esta se quedó sin ella.
             */
            const dosMinutosAtras = new Date(Date.now() - 2 * 60 * 1000);
            const notaReciente = await prisma.clinicalNote.findFirst({
                where: { patientId, authorId, title: titulo, createdAt: { gte: dosMinutosAtras } },
                select: { id: true },
            });
            if (notaReciente) {
                return NextResponse.json({
                    success: true,
                    duplicada: true,
                    message: 'Ese registro ya estaba guardado hace un momento.',
                });
            }

            await prisma.clinicalNote.create({
                data: {
                    patientId,
                    authorId,
                    title: titulo,
                    content: notes,
                    type: "PROGRESS_NOTE",
                    // Hora real de la ronda. `createdAt` sigue siendo el tecleo.
                    occurredAt: hora.hora,
                }
            });
            return NextResponse.json({ success: true, message: isDayShift ? 'Cambio de pañal registrado' : 'Nota clínica de ronda guardada' });
        }
    } catch (error: any) {
        console.error("Night Rounds Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
