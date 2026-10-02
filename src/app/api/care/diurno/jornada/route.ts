/**
 * MARCAR LA LLEGADA Y LA SALIDA DE UN RESIDENTE DIURNO.
 *
 * Andrés, 02-oct-2026: «importante poder marcar llegada y salida de los
 * diurnos».
 *
 * La regla entera vive en `src/lib/residente-diurno.ts`; aquí solo se escribe.
 * Lo que importa de este endpoint:
 *
 *   · El horario sigue mandando por defecto. Esto no es un fichaje: no marcar
 *     deja al residente exactamente como estaba (7:00–18:00). Por eso no hay
 *     ningún recordatorio, ninguna alerta por «jornada sin cerrar» y ninguna
 *     fila que se cree sola. Una marca solo sirve para acercarse a la verdad.
 *
 *   · NO se puede marcar a un residente regular. No es una validación
 *     defensiva: una jornada sobre alguien que vive aquí no significa nada, y
 *     dejar que se escriba convertiría la tabla en algo que no se puede leer.
 *
 *   · `hqId` sale de la sesión, nunca del body, y además se comprueba que el
 *     residente sea de esa sede (no basta el rol: hace falta que ESTE
 *     residente sea suyo).
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { assertPatientInTenant } from '@/lib/patient-tenant';
import { logError } from '@/lib/logger';
import { fechaDeLaJornada, jornadaEfectiva, marcasCuadran } from '@/lib/residente-diurno';
import { formatASTTime } from '@/lib/dates';

export const dynamic = 'force-dynamic';

/**
 * Quién marca. El piso, porque es quien lo ve entrar y salir, y también quien
 * dirige y supervisa, que son los que corrigen cuando alguien se olvidó.
 */
const ROLES = ['CAREGIVER', 'NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN'];

type Marca = 'LLEGADA' | 'SALIDA';

/**
 * GET /api/care/diurno/jornada
 *
 * Las jornadas de HOY de la sede, para que la pantalla sepa qué botón enseñar.
 * Devuelve solo los diurnos: de los demás no hay nada que decir.
 */
export async function GET() {
    const auth = await requireRole(ROLES);
    if (auth instanceof NextResponse) return auth;

    try {
        const hqId = auth.headquartersId;
        const fecha = fechaDeLaJornada();

        const filas = await prisma.jornadaDiurna.findMany({
            where: { headquartersId: hqId, fecha },
            select: { patientId: true, llegadaAt: true, salidaAt: true },
        });

        /**
         * `cuadran` lo decide el SERVIDOR, no la pantalla.
         *
         * Es la misma regla que ya usa `jornadaEfectiva` para decidir si hace
         * caso a las marcas. Calcularla otra vez en el cliente seria escribir la
         * regla dos veces — la forma por defecto de equivocarse en este repo— y
         * ademas el cliente no tiene las anclas de hora a mano.
         */
        const ahora = new Date();
        const jornadas = filas.map(j => ({ ...j, cuadran: marcasCuadran(ahora, j) }));

        return NextResponse.json({
            success: true,
            fecha,
            jornadas,
            /**
             * Los extremos por defecto, para que la pantalla pueda decir «7:00
             * (horario)» en vez de dejar el hueco en blanco. Un hueco se lee
             * como «no se sabe», y aquí sí se sabe: se sabe que vale el horario.
             */
            porDefecto: jornadaEfectiva(new Date(), null),
        });
    } catch (e) {
        logError('diurno/jornada GET', e);
        return NextResponse.json({ success: false, error: 'Error cargando jornadas' }, { status: 500 });
    }
}

/**
 * POST /api/care/diurno/jornada
 *
 * Body: { patientId, marca: 'LLEGADA' | 'SALIDA' }
 *
 * La hora es la del servidor, no la del cliente: una hora que llega del
 * navegador es la del reloj de una tableta que puede estar mal puesta, y esto
 * acaba en un registro clínico.
 */
export async function POST(req: Request) {
    const auth = await requireRole(ROLES);
    if (auth instanceof NextResponse) return auth;

    try {
        const hqId = auth.headquartersId;
        const { patientId, marca } = await req.json();

        if (!patientId || (marca !== 'LLEGADA' && marca !== 'SALIDA')) {
            return NextResponse.json(
                { success: false, error: 'Falta el residente o la marca (LLEGADA | SALIDA).' },
                { status: 400 },
            );
        }

        const crudo = await prisma.patient.findUnique({
            where: { id: patientId },
            select: { id: true, name: true, headquartersId: true, esDiurno: true, status: true },
        });
        const residente = assertPatientInTenant(crudo, hqId);
        if (residente instanceof NextResponse) return residente;

        if (!residente.esDiurno) {
            return NextResponse.json(
                { success: false, error: `${residente.name} no es residente diurno.` },
                { status: 400 },
            );
        }

        /**
         * `status` se pedia en el select y no se comprobaba nunca.
         *
         * Se podia escribir una jornada de alguien dado de alta, en el hospital
         * o fallecido: una fila que afirma que esa persona estuvo aqui hoy, en
         * un registro clinico. Es el antipatron de «listar personas que ya no
         * estan», en su version de escritura.
         */
        if (residente.status !== 'ACTIVE') {
            return NextResponse.json(
                { success: false, error: `${residente.name} no está activo en el hogar.` },
                { status: 400 },
            );
        }

        const ahora = new Date();
        const fecha = fechaDeLaJornada(ahora);
        const campo = marca === 'LLEGADA' ? 'llegadaAt' : 'salidaAt';
        const campoQuien = marca === 'LLEGADA' ? 'llegadaPorId' : 'salidaPorId';

        /**
         * GUARDA CONTRA EL DOBLE ENVÍO.
         *
         * Un toque doble, o un reintento porque la tableta se vio lenta, y
         * habría dos marcas donde debía haber una. El índice único
         * (patientId, fecha) impide la fila repetida, pero eso solo daría un
         * error en rojo — y un error en rojo hace que la cuidadora lo intente
         * otra vez, que es lo que produce el duplicado.
         *
         * Así que si la marca YA está puesta, se devuelve ÉXITO con la que hay.
         * Quien pulsó hizo lo correcto; la segunda pulsación no debe cambiar la
         * hora, porque la buena es la primera: es la que se observó.
         */
        const existente = await prisma.jornadaDiurna.findUnique({
            where: { patientId_fecha: { patientId, fecha } },
            select: { id: true, llegadaAt: true, salidaAt: true },
        });

        if (existente && existente[campo]) {
            return NextResponse.json({
                success: true,
                yaExistia: true,
                jornada: existente,
                mensaje: marca === 'LLEGADA'
                    ? `La llegada de ${residente.name} ya estaba marcada.`
                    : `La salida de ${residente.name} ya estaba marcada.`,
            });
        }

        /**
         * QUE LA MARCA NO INVIERTA LA JORNADA.
         *
         * Caso real: nadie marco la salida de ayer y a las 06:30 alguien pulsa
         * «Se fue». Quedaria `salidaAt = 06:30` con la llegada valiendo las
         * 7:00 — una ventana vacia. `jornadaEfectiva` ya la ignora y vuelve al
         * horario, asi que el residente no desaparece del cuidado; pero dejar
         * escribir una fila que no puede ser cierta es guardar basura en un
         * registro clinico y obligar a todo lector a defenderse de ella.
         *
         * Se rechaza DICIENDO POR QUE y con que hora choca, no con un «datos
         * invalidos»: quien pulso esta delante del residente y necesita saber
         * si se equivoco de boton o de persona.
         */
        const propuesta = {
            llegadaAt: marca === 'LLEGADA' ? ahora : (existente?.llegadaAt ?? null),
            salidaAt: marca === 'SALIDA' ? ahora : (existente?.salidaAt ?? null),
        };
        if (!marcasCuadran(ahora, propuesta)) {
            const { desde, hasta } = jornadaEfectiva(ahora, null);
            const choca = marca === 'LLEGADA'
                ? `la salida ya marcada`
                : (propuesta.llegadaAt ? `la llegada ya marcada` : `la hora de entrada (${formatASTTime(desde)})`);
            return NextResponse.json({
                success: false,
                error: `Esa hora es anterior a ${choca}, así que la jornada quedaría al revés. `
                    + `Si la marca anterior estaba mal, quítala primero.`,
                jornada: existente ?? null,
                limites: { desde, hasta },
            }, { status: 400 });
        }

        const jornada = await prisma.jornadaDiurna.upsert({
            where: { patientId_fecha: { patientId, fecha } },
            create: {
                headquartersId: hqId,
                patientId,
                fecha,
                [campo]: ahora,
                [campoQuien]: auth.id,
            },
            update: {
                [campo]: ahora,
                [campoQuien]: auth.id,
            },
            select: { id: true, llegadaAt: true, salidaAt: true },
        });

        return NextResponse.json({ success: true, yaExistia: false, jornada });
    } catch (e) {
        logError('diurno/jornada POST', e);
        return NextResponse.json({ success: false, error: 'Error guardando la marca' }, { status: 500 });
    }
}

/**
 * DELETE /api/care/diurno/jornada?patientId=…&marca=LLEGADA|SALIDA
 *
 * Deshacer una marca puesta por error. Existe porque la alternativa es peor:
 * sin deshacer, quien se equivoca de residente deja una hora falsa en el
 * registro y no tiene forma de quitarla.
 *
 * Borra la marca, no la corrige a otra hora: la hora buena es la que se
 * observe cuando se vuelva a marcar, no una que alguien teclee después.
 */
export async function DELETE(req: Request) {
    const auth = await requireRole(ROLES);
    if (auth instanceof NextResponse) return auth;

    try {
        const hqId = auth.headquartersId;
        const { searchParams } = new URL(req.url);
        const patientId = searchParams.get('patientId');
        const marca = searchParams.get('marca') as Marca | null;

        if (!patientId || (marca !== 'LLEGADA' && marca !== 'SALIDA')) {
            return NextResponse.json(
                { success: false, error: 'Falta el residente o la marca.' },
                { status: 400 },
            );
        }

        const crudo = await prisma.patient.findUnique({
            where: { id: patientId },
            select: { id: true, headquartersId: true },
        });
        const residente = assertPatientInTenant(crudo, hqId);
        if (residente instanceof NextResponse) return residente;

        const fecha = fechaDeLaJornada();
        const campo = marca === 'LLEGADA' ? 'llegadaAt' : 'salidaAt';
        const campoQuien = marca === 'LLEGADA' ? 'llegadaPorId' : 'salidaPorId';

        const existente = await prisma.jornadaDiurna.findUnique({
            where: { patientId_fecha: { patientId, fecha } },
            select: { id: true, llegadaAt: true, salidaAt: true },
        });

        // Borrar algo que no está es lo que el usuario quería: éxito, no error.
        if (!existente) return NextResponse.json({ success: true, jornada: null });

        const jornada = await prisma.jornadaDiurna.update({
            where: { id: existente.id },
            data: { [campo]: null, [campoQuien]: null },
            select: { id: true, llegadaAt: true, salidaAt: true },
        });

        /**
         * Una fila sin llegada y sin salida no dice nada, y dejarla haría que
         * `presenciaDeHoy` tuviera que razonar sobre filas vacías. Se borra.
         */
        if (!jornada.llegadaAt && !jornada.salidaAt) {
            await prisma.jornadaDiurna.delete({ where: { id: jornada.id } });
            return NextResponse.json({ success: true, jornada: null });
        }

        return NextResponse.json({ success: true, jornada });
    } catch (e) {
        logError('diurno/jornada DELETE', e);
        return NextResponse.json({ success: false, error: 'Error quitando la marca' }, { status: 500 });
    }
}
