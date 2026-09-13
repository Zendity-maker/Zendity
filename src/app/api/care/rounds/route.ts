import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { resolverHoraReal } from '@/lib/hora-real';

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
            const dosMinutosAtras = new Date(Date.now() - 2 * 60 * 1000);
            const rotacionReciente = await prisma.posturalChangeLog.findFirst({
                where: { patientId, performedAt: { gte: dosMinutosAtras } },
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

            await prisma.posturalChangeLog.create({
                data: {
                    patientId,
                    nurseId: authorId,
                    position: position || "Rotación General (Pre-programada Zendi)",
                    performedAt: hora.hora,
                    isComplianceAlert: false
                }
            });
            return NextResponse.json({ success: true, message: 'Rotación guardada' });
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
