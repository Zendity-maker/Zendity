import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/api-auth';
import { logError } from '@/lib/logger';
import { resolverHoraReal } from '@/lib/hora-real';
import { notifyRoles } from '@/lib/notifications';
import {
    esMotivoNoRotacionValido,
    etiquetaNoRotacion,
    avisaAEnfermeria,
} from '@/lib/rotacion-no-realizada';

export const dynamic = 'force-dynamic';

/**
 * POST /api/care/rotacion-no-realizada
 *
 * SE INTENTÓ ROTAR Y NO SE PUDO.
 *
 * Nace de un hallazgo de Zendi del 21-sep-2026 sobre Elisa Medina Maldonado —
 * «se niega a la rotación postural, que es un requisito de su cuidado»— y de
 * comprobar que la cuidadora no tenía forma de decirlo: los únicos valores de
 * `position` que existen en las 21.664 filas son decúbitos. Sin esta ruta, sus
 * opciones eran firmar una rotación falsa, dejar el SLA en rojo, o escribirlo
 * en texto libre. Hizo lo tercero, que es lo más honesto de los tres y lo único
 * que el sistema no sabía leer.
 *
 * Body: { patientId, motivo, nota?, timeLogged? }
 */
export async function POST(req: Request) {
    try {
        const auth = await requireSession();
        if (auth instanceof NextResponse) return auth;
        const { id: invokerId, headquartersId: hqId } = auth;

        const { patientId, motivo, nota, timeLogged } = await req.json();

        if (!patientId || !motivo) {
            return NextResponse.json(
                { success: false, error: 'patientId y motivo son requeridos' },
                { status: 400 },
            );
        }
        /**
         * El motivo viene de una lista cerrada, y se valida. Un código libre
         * acabaría siendo prosa otra vez, que es de donde venimos.
         */
        if (!esMotivoNoRotacionValido(motivo)) {
            return NextResponse.json(
                { success: false, error: 'Motivo no reconocido' },
                { status: 400 },
            );
        }
        /**
         * "Otro" EXIGE decir cuál. Es la salida honesta de la lista, no un
         * atajo para no elegir: sin texto se convertiría en el cajón donde cae
         * todo y dejaría de informar. Mismo criterio que la omisión de
         * medicamentos.
         */
        if (motivo === 'OTRO' && !String(nota || '').trim()) {
            return NextResponse.json(
                { success: false, error: 'Si eliges "Otro motivo", escribe cuál.' },
                { status: 400 },
            );
        }

        const ahora = new Date();
        // La hora del intento la declara quien lo vivió. Ver src/lib/hora-real.ts.
        const hora = resolverHoraReal(timeLogged, ahora);
        if (!hora.ok) {
            return NextResponse.json({ success: false, error: hora.error }, { status: 400 });
        }

        // Multi-tenant: el residente tiene que ser de la sede de quien escribe.
        const paciente = await prisma.patient.findFirst({
            where: { id: patientId, headquartersId: hqId },
            select: { id: true, name: true },
        });
        if (!paciente) {
            return NextResponse.json(
                { success: false, error: 'Residente no encontrado en tu sede' },
                { status: 404 },
            );
        }

        /**
         * GUARDA CONTRA DOBLE ENVÍO — y devuelve ÉXITO, no un rojo.
         *
         * Dos minutos, la misma ventana que las rotaciones y por el mismo
         * motivo: un doble toque no es un segundo intento. Y se compara contra
         * la hora que se va a ESCRIBIR, no contra el reloj, que es el fallo que
         * ya pagaron la guarda del baño, la de la comida y la de rounds.
         */
        const yaEstaba = await prisma.rotacionNoRealizada.findFirst({
            where: {
                patientId,
                momento: {
                    gte: new Date(hora.hora.getTime() - 2 * 60 * 1000),
                    lte: new Date(hora.hora.getTime() + 2 * 60 * 1000),
                },
            },
            select: { id: true },
        });
        if (yaEstaba) {
            return NextResponse.json({
                success: true,
                duplicada: true,
                message: 'Eso ya estaba anotado hace un momento.',
            });
        }

        const fila = await prisma.rotacionNoRealizada.create({
            data: {
                headquartersId: hqId,
                patientId,
                nurseId: invokerId,
                motivo,
                nota: String(nota || '').trim() || null,
                momento: hora.hora,
            },
        });

        /**
         * ENFERMERÍA SE ENTERA HOY, NO EN EL RESUMEN DEL TURNO.
         *
         * Que alguien rechace que la muevan, o que le duela al moverla, o que
         * haga falta una segunda persona que no hay, no son preferencias: son
         * datos clínicos con consecuencia. Un residente en protocolo de úlcera
         * que rechaza la rotación tres veces seguidas es una conversación con
         * el médico, no una anotación.
         *
         * No bloquea el registro: si el aviso falla, el intento ya quedó
         * escrito. Y el cuerpo NO lleva detalle clínico más allá de lo
         * imprescindible — ver regla 7 de CLAUDE.md.
         */
        if (avisaAEnfermeria(motivo)) {
            notifyRoles(hqId, ['NURSE', 'SUPERVISOR', 'DIRECTOR'], {
                type: 'EMAR_ALERT',
                title: `No se pudo rotar — ${paciente.name.trim()}`,
                message: `${etiquetaNoRotacion(motivo)}. Lo registró ${auth.name ?? 'personal'}.`,
                link: '/care/supervisor',
            }, invokerId).catch(e => console.error('Aviso de rotación no realizada:', e));
        }

        return NextResponse.json({
            success: true,
            id: fila.id,
            /**
             * Se le dice a la cuidadora lo que de verdad pasó: queda anotado, y
             * el reloj SIGUE corriendo. Prometerle que se apaga sería mentir —
             * a la residente no la movió nadie y el riesgo es el mismo.
             */
            message: `Anotado: ${etiquetaNoRotacion(motivo)?.toLowerCase()}.`
                + ' El aviso de rotación sigue activo porque no se la movió.',
        });
    } catch (error) {
        logError('care.rotacion-no-realizada.post', error);
        return NextResponse.json(
            { success: false, error: 'Error registrando el intento de rotación' },
            { status: 500 },
        );
    }
}
