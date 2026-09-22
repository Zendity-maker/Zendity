import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { huboRechazoEnElHueco } from '@/lib/rotacion-no-realizada';
import { variantesDePosicion } from '@/lib/posicion-rotacion';
import { ULCERA_ABIERTA } from '@/lib/upp';
import { solapaConSinServicio } from '@/lib/ventanas-sin-servicio';
import { resolverHoraReal } from '@/lib/hora-real';
import { evaluarRotacion } from '@/lib/rotacion-imputable';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['CAREGIVER', 'NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN'];

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }
        const invokerId = (session.user as any).id;
        const invokerRole = (session.user as any).role;
        const invokerHqId = (session.user as any).headquartersId;

        if (!ALLOWED_ROLES.includes(invokerRole)) {
            return NextResponse.json({ success: false, error: 'Rol no autorizado para rotaciones posturales' }, { status: 403 });
        }

        const { patientId, caregiverId, position, performedAt: horaDeclarada } = await req.json();

        // Hora real del cambio de posicion. Sin ella se usa `now()`, el
        // comportamiento de siempre. Ver src/lib/hora-real.ts.
        const hora = resolverHoraReal(horaDeclarada);
        if (!hora.ok) {
            return NextResponse.json({ success: false, error: hora.error }, { status: 400 });
        }
        const momento = hora.hora;

        if (!patientId || !caregiverId || !position) {
            return NextResponse.json({ success: false, error: "Faltan parámetros obligatorios para el cambio postural." }, { status: 400 });
        }

        /**
         * GUARDA CONTRA DOBLE ENVÍO. Esta ruta no tenía ninguna.
         *
         * `/api/care/rounds` la puso el 30-ago-2026 tras medir 3.325
         * rotaciones duplicadas, pero ESTE es el otro escritor de
         * `PosturalChangeLog` y se quedó sin ella. Medido el 14-sep-2026 sobre
         * 30 días: 609 rotaciones duplicadas de 5.415, y 568 de ellas a menos
         * de DIEZ SEGUNDOS. Eso no es un doble toque accidental: es alguien
         * pulsando hasta ver que pasa algo.
         *
         * Y no es solo ruido: una rotación tardía genera penalidad e incidente,
         * así que el duplicado también falsea el cumplimiento de UPP en la
         * dirección contraria — parece que se rota más de lo que se rota.
         *
         * La ventana se mide contra el momento QUE SE VA A ESCRIBIR, no contra
         * el reloj: un registro retroactivo tiene su `performedAt` en el pasado
         * y contra `Date.now()` se colaría, que es el agujero que tenían la
         * guarda del baño y la de la comida.
         */
        const rotacionReciente = await prisma.posturalChangeLog.findFirst({
            where: {
                patientId,
                /**
                 * POR LADO, IGUAL QUE `/api/care/rounds`.
                 *
                 * Las dos rutas escriben la MISMA tabla y hasta el 22-sep-2026
                 * tenian guardas distintas: esta casaba cualquier rotacion de
                 * la ventana —y se tragaba una correccion de decubito— y la
                 * otra casaba la cadena exacta —y dejaba pasar el doble toque
                 * que cruza superficies, porque la tira escribe "Izquierdo" y
                 * este modal "IZQUIERDA". El mismo acto daba resultados
                 * distintos segun por donde entrara.
                 *
                 * Ver src/lib/posicion-rotacion.ts: 329 duplicados atrapados y
                 * 28 correcciones dejadas pasar, de los 357 pares de 30 dias.
                 */
                position: { in: variantesDePosicion(position) },
                performedAt: {
                    gte: new Date(momento.getTime() - 2 * 60 * 1000),
                    lte: new Date(momento.getTime() + 2 * 60 * 1000),
                },
            },
            select: { id: true },
        });
        if (rotacionReciente) {
            // Éxito, no error: la cuidadora hizo lo correcto y un rojo la haría
            // repetirlo, que es justo lo que produce el duplicado.
            return NextResponse.json({
                success: true,
                duplicada: true,
                message: 'Esta rotación ya estaba registrada hace un momento.',
            });
        }

        // Tenant check: el paciente debe pertenecer a la sede del invocador
        const patient = await prisma.patient.findFirst({
            where: { id: patientId, headquartersId: invokerHqId },
            select: {
                id: true, headquartersId: true, status: true,
                requiresPosturalChanges: true, nortonRisk: true,
                pressureUlcers: { where: ULCERA_ABIERTA, select: { id: true } },
            },
        });
        if (!patient) {
            return NextResponse.json({ success: false, error: 'Residente no encontrado en tu sede' }, { status: 404 });
        }

        // Integridad adicional: el caregiverId del body debe ser el invocador o alguien de la misma sede
        if (caregiverId !== invokerId) {
            const cg = await prisma.user.findUnique({ where: { id: caregiverId }, select: { headquartersId: true } });
            if (!cg || cg.headquartersId !== invokerHqId) {
                return NextResponse.json({ success: false, error: 'Cuidador inválido' }, { status: 403 });
            }
        }

        const lastRotation = await prisma.posturalChangeLog.findFirst({
            where: { patientId },
            orderBy: { performedAt: 'desc' },
            // `nurseId` es lo que permite saber DE QUIEN era el hueco. Sin el,
            // la tardanza la paga quien la cierra. Ver src/lib/rotacion-imputable.ts.
            select: { nurseId: true, performedAt: true },
        });

        /**
         * ¿Se puede castigar por esta rotación?
         *
         * Solo si el residente REQUIERE rotación y estaba en el edificio.
         *
         * Antes no se preguntaba: se castigaba por el reloj y nada más. De las
         * 121 penalidades acumuladas, 9 son de José A. Troche mientras estaba
         * ingresado — a alguien le descontaron puntos por no girar a un señor
         * que estaba en el hospital.
         *
         * Norton por si solo NO alcanza. Es una escala de riesgo, no una orden
         * de rotación: Teresa Rivera se moviliza sola en silla de ruedas.
         * Misma regla que /api/care/nursing/rotation.
         *
         * El premio se conserva sin condición. Registrar una rotación a tiempo
         * es bueno aunque no fuera obligatoria; lo que no se puede es castigar
         * por incumplir algo que nadie mandó.
         */
        const requiereRotacion = patient.requiresPosturalChanges || patient.pressureUlcers.length > 0;
        const enElEdificio = patient.status === 'ACTIVE';

        /**
         * LA EVALUACIÓN, EN UN SOLO SITIO.
         *
         * Tres exenciones, y hasta hoy las tres protegían una vía muerta: ponían
         * `pointsDelta = 0`, y el bloque que leía `pointsDelta` estaba vacío
         * desde el 05-sep. El único canal que de verdad cobra es el contador de
         * banderas de `compliance-score.ts`, y ese leía `isComplianceAlert`, que
         * ninguna exención tocaba. O sea que todo el trabajo de "no se castiga a
         * quien no pudo entrar" y "no se castiga por no girar a quien nadie mandó
         * girar" llevaba once días sin efecto.
         *
         * Ahora las exenciones apagan `esImputable`, que es lo que se cobra.
         *
         *   1. El residente no requiere rotación, o no estaba en el edificio.
         *   2. El hueco atraviesa una caída del sistema — tras la del 28-ago,
         *      casi ocho horas sin que nadie pudiera entrar, la primera rotación
         *      que alguien registrara arrastraba el hueco entero.
         *   3. Y la nueva: el hueco no es suyo, o ya se cobró una vez.
         *      Ver src/lib/rotacion-imputable.ts.
         */
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
            !requiereRotacion ||
            !enElEdificio ||
            (!!lastRotation && solapaConSinServicio(new Date(lastRotation.performedAt), new Date())) ||
            await huboRechazoEnElHueco(patientId, lastRotation?.performedAt ?? null, momento);

        const veredicto = await evaluarRotacion({
            caregiverId,
            anterior: lastRotation,
            momento,
            exento,
        });

        if (veredicto.tarde && !veredicto.imputable) {
            // Se deja constancia de por qué no se cobró. La fila guarda el hecho;
            // el motivo vive en el log, que es donde se puede auditar una regla.
            console.log(`[postural] tardía no imputable (${veredicto.porque})`, { patientId, caregiverId });
        }

        const newRotation = await prisma.posturalChangeLog.create({
            data: {
                patientId,
                nurseId: caregiverId,
                position,
                performedAt: momento,
                // El hecho clínico. No se apaga nunca: un hueco de quince horas
                // es un problema aunque a nadie se le cobre.
                isComplianceAlert: veredicto.tarde,
                // La factura. Es lo único que mira el desempeño.
                esImputable: veredicto.imputable,
            }
        });

        return NextResponse.json({
            success: true,
            rotation: newRotation,
            tarde: veredicto.tarde,
            imputable: veredicto.imputable,
        });

    } catch (error) {
        console.error("Postural Change Route Error:", error);
        return NextResponse.json({ success: false, error: "Error interno procesando el cambio postural (UPP)." }, { status: 500 });
    }
}
