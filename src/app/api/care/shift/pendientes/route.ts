import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { todayStartAST } from '@/lib/dates';
import {
    resolveColorGroupsForCaregiver,
    resolvePatientsByColors,
    resolverTurnoTrabajado,
} from '@/lib/shift-closure-report';
import { dosisSinResolverDelTurno, RESPUESTAS_DOSIS, ventanaDeDosisDelTurno } from '@/lib/dosis-sin-resolver';
import { MOTIVOS_OMISION } from '@/lib/omision-medicamento';

export const dynamic = 'force-dynamic';

const SUPERVISOR_ROLES = ['SUPERVISOR', 'DIRECTOR', 'ADMIN', 'SUPER_ADMIN'];

/**
 * GET /api/care/shift/pendientes?shiftSessionId=...
 *
 * LO QUE EL CIERRE TIENE QUE PREGUNTAR ANTES DE DEJAR FIRMAR.
 *
 * El wizard de cierre ya sabía recibir avisos, bloquear mientras quedara uno
 * sin resolver y guardar la justificación de cada uno en
 * `ShiftHandover.justifications`. Lo que no tenía era quién se los diera: el
 * único sitio donde se monta le pasaba la lista vacía por defecto, y
 * `onResolveWarning` era `async () => true`.
 *
 * Medido el 21-sep-2026: **0 de 294 relevos de 30 días llevan una sola
 * justificación**, mientras 227 de 227 llevan firma. La función estaba
 * construida de punta a punta y se alimentaba con vacío — el patrón de
 * promete-y-no-entrega, en el cableado.
 *
 * Esta ruta es ese cable. Solo lee.
 *
 * ═══ LA VENTANA NO ES `shiftStart` ═══
 *
 * `/preview` y `/end` recortan el inicio con
 * `session.startTime < todayStartAST() ? todayStartAST() : session.startTime`,
 * y para el REPORTE está bien: acota la actividad al día clínico.
 *
 * Para las dosis sería un error, y grande. Un turno de noche poncha a las 22:00
 * y `todayStartAST()` son las 6:00 AM del día siguiente: recortado, la ventana
 * empezaría DESPUÉS de las dos franjas que ese turno tiene a su cargo —las
 * 20:00 y las 05:00— y el cierre de noche no preguntaría nunca por ellas. La
 * franja de las 5:00 AM es justamente la que más tarde se anota.
 *
 * Así que la ventana de dosis va con el ponche REAL. La cota de arriba es
 * `now`: una dosis cuya hora todavía no ha llegado no se le puede reclamar a
 * nadie, y sin esa cota el cierre de las 8:05 AM reclamaría el pack de las
 * 8:00 PM.
 */
export async function GET(req: Request) {
    try {
        const authSession = await getServerSession(authOptions);
        if (!authSession?.user) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }
        const invokerId = (authSession.user as any).id;
        const invokerRole = (authSession.user as any).role;
        // Del servidor, nunca del request. Ver CLAUDE.md § Multi-tenant.
        const invokerHqId = (authSession.user as any).headquartersId;

        const shiftSessionId = new URL(req.url).searchParams.get('shiftSessionId');
        if (!shiftSessionId) {
            return NextResponse.json({ success: false, error: 'shiftSessionId requerido' }, { status: 400 });
        }

        const session = await prisma.shiftSession.findUnique({
            where: { id: shiftSessionId },
            select: {
                id: true,
                caregiverId: true,
                headquartersId: true,
                startTime: true,
                actualEndTime: true,
            },
        });
        if (!session) {
            return NextResponse.json({ success: false, error: 'Turno no encontrado' }, { status: 404 });
        }

        // Ownership por el [id] concreto, no solo por rol. Ver CLAUDE.md § 3.
        const esSuyo = session.caregiverId === invokerId;
        const esSupervisor = SUPERVISOR_ROLES.includes(invokerRole)
            && session.headquartersId === invokerHqId;
        if (!esSuyo && !esSupervisor) {
            return NextResponse.json(
                { success: false, error: 'Sin permiso para ver este turno' },
                { status: 403 },
            );
        }

        const ahora = new Date();

        /**
         * EL PONCHE REAL, NO EL RECORTADO AL DÍA CLÍNICO.
         *
         * `/preview` y `/end` resuelven el color con
         * `session.startTime < todayStartAST() ? todayStartAST() : ...`, y para
         * el reporte está bien. Aquí sería el fallo de "las tres anclas" de
         * CLAUDE.md: un turno de noche ponchado a las 22:02 queda recortado a
         * las 6 AM del día SIGUIENTE, y `resolveColorGroupsForCaregiver` le
         * encuentra la pauta de mañana — otro color.
         *
         * Medido sobre los turnos de noche de 30 días: 4 recibirían el aviso de
         * un grupo que no cuidaron (y el botón destacado es "Sí, se dieron", o
         * sea firma sobre dosis ajenas) y 6 saldrían sin color teniendo pauta,
         * culpando a la falta de datos de un error de fecha.
         */
        const colorGroups = await resolveColorGroupsForCaregiver(
            session.caregiverId, session.headquartersId, session.startTime,
        );
        const patients = await resolvePatientsByColors(colorGroups, session.headquartersId);

        // El turno que se TRABAJÓ, no la hora de cerrar: es lo que decide desde
        // qué hora empieza la ventana. Mismo resolutor que usa /preview.
        const tipoDeTurno = await resolverTurnoTrabajado(session.caregiverId, session.startTime);
        const ventana = ventanaDeDosisDelTurno({
            ponche: session.startTime,
            tipoDeTurno,
            ahora,
            cierre: session.actualEndTime,
        });

        const franjas = await dosisSinResolverDelTurno({
            patientIds: patients.map(p => p.id),
            desde: ventana.desde,
            hasta: ventana.hasta,
        });

        /**
         * Los avisos se arman AQUÍ, no en la tableta, por dos razones: el
         * cliente no puede importar `dosis-sin-resolver` sin arrastrar Prisma
         * al bundle, y el texto que lee la cuidadora debe salir del mismo sitio
         * que decide qué se le reclama.
         *
         * Uno por FRANJA, no por dosis. El pack ROJO de las 8:00 son 45 dosis
         * de 11 residentes: 45 tarjetas al final de un turno de ocho horas es
         * una lista que se despacha a ciegas para poder irse a casa. Una
         * tarjeta con "ver las 45 dosis" desplegable es la misma información y
         * un solo acto, que es como se dieron.
         */
        /**
         * SIN COLOR RESUELTO, LA LISTA VACÍA NO SIGNIFICA "NO FALTA NADA".
         *
         * Medido el 21-sep-2026 simulando los 10 turnos del día: Neylianne
         * Torres trabajó 22:08→06:05 y `resolveColorGroupsForCaregiver` devuelve
         * CERO colores — no tiene pauta con color asignado y no tocó a ningún
         * residente que la delate. Con la lista vacía cerraba igual, y el cierre
         * decía en silencio lo mismo que un turno impecable.
         *
         * No se bloquea: dejarla sin poder cerrar su turno porque el sistema no
         * sabe a quién cuidaba es castigarla por un dato que no es suyo. Se
         * convierte en un aviso de un solo botón, así que tiene que verlo y
         * queda en `justifications` del relevo, donde el supervisor lo lee.
         *
         * Es la misma regla que ya pagó este proyecto en la auditoría de turno:
         * un cero sin procedencia es una afirmación que nadie hizo.
         */
        if (colorGroups.length === 0) {
            return NextResponse.json({
                success: true,
                // El id NO empieza por `meds:`: `aplicarRespuestasDeCierre` solo
                // toca esas claves, así que esto no escribe ninguna dosis.
                avisos: [{
                    id: 'sin-color:turno',
                    type: 'SIN_COLOR_RESUELTO',
                    title: 'No se pudo saber a qué grupo estuviste asignada',
                    description: 'Por eso este cierre no puede decirte si quedaron'
                        + ' medicamentos sin registrar. No es un problema tuyo, pero'
                        + ' tiene que constar: avísale al supervisor.',
                    respuestas: [{
                        codigo: 'SIN_COLOR_ENTENDIDO',
                        etiqueta: 'Entendido',
                        ayuda: 'Queda anotado en el relevo',
                        principal: true,
                    }],
                }],
                franjas: [],
                contexto: {
                    colorGroups,
                    residentes: patients.length,
                    desde: session.startTime.toISOString(),
                    hasta: ahora.toISOString(),
                    resoluble: false,
                },
            });
        }

        const avisos = franjas.map(f => ({
            id: f.id,
            type: 'MEDS_SIN_RESOLVER',
            title: `Los medicamentos de las ${f.etiqueta} no quedaron registrados`,
            description: `${f.dosis.length} dosis de ${new Set(f.dosis.map(d => d.patientId)).size} residente(s).`
                + ' Si se dieron, se firman con la hora de la franja y queda guardado a qué hora lo escribiste.',
            respuestas: RESPUESTAS_DOSIS.map(r => ({
                codigo: r.codigo,
                etiqueta: r.etiqueta,
                ayuda: r.ayuda,
                pideMotivo: r.efecto === 'PEDIR_MOTIVO',
                // La esperada en el caso normal va destacada, pero NO
                // preseleccionada: un valor por defecto aquí firmaría dosis
                // solo. Ver care/page.tsx, donde el defecto "Ahora" del control
                // de la hora dejó 43 dosis de las 8:00 AM sentadas a las 17:0x.
                principal: r.efecto === 'FIRMAR',
            })),
            motivos: MOTIVOS_OMISION.map(m => ({ codigo: m.codigo, etiqueta: m.etiqueta })),
            /**
             * AGRUPADO POR RESIDENTE, Y NO ES SOLO PRESENTACIÓN.
             *
             * Antes era una línea por dosis: para el pack de las 8:00, 47
             * líneas en una mirilla con scroll donde el nombre de Milagros
             * salía once veces seguidas. Pero el problema de fondo era peor que
             * la mirilla: con una sola respuesta por franja, **un toque afirma
             * un hecho clínico sobre hasta diez residentes a la vez**, y el
             * motivo único escribe sobre todos la misma razón. Una de ellas
             * rehusó, otra estaba en el hospital, y el registro diría lo mismo
             * de las dos — la mentira que esta función vino a evitar, en la
             * dirección contraria.
             *
             * Por eso la unidad de la afirmación es el residente. La tarjeta
             * sigue siendo una por franja —el conteo medido es 1 a 3 tarjetas
             * por turno— y "Todas se dieron" resuelve el caso normal en un
             * toque; quien necesita separar, separa. Coste medido de la
             * granularidad: 8 filas en la peor tarjeta del mes y +27 respuestas
             * en 30 días para todo el hogar.
             */
            porResidente: Array.from(
                f.dosis.reduce((m, d) => {
                    if (!m.has(d.patientId)) {
                        m.set(d.patientId, { patientId: d.patientId, residente: d.residente, medicamentos: [] as string[] });
                    }
                    m.get(d.patientId)!.medicamentos.push(d.medicamento);
                    return m;
                }, new Map<string, { patientId: string; residente: string; medicamentos: string[] }>()).values(),
            )
                .map(r => ({ ...r, dosis: r.medicamentos.length }))
                .sort((a, b) => b.dosis - a.dosis || a.residente.localeCompare(b.residente, 'es')),
        }));

        return NextResponse.json({
            success: true,
            avisos,
            franjas,
            // Se devuelve el porqué de una lista vacía para que la pantalla
            // pueda distinguir "no quedó nada" de "no se pudo saber". Un cero
            // sin procedencia es una afirmación que nadie hizo.
            contexto: {
                colorGroups,
                residentes: patients.length,
                desde: ventana.desde.toISOString(),
                hasta: ventana.hasta.toISOString(),
                ponche: session.startTime.toISOString(),
                turno: tipoDeTurno,
                // Sin colores resueltos no hay residentes, y entonces la lista
                // vacía no significa que no falte nada.
                resoluble: colorGroups.length > 0,
            },
        });
    } catch (error: any) {
        console.error('[shift/pendientes]', error);
        return NextResponse.json(
            { success: false, error: 'Error consultando dosis sin resolver' },
            { status: 500 },
        );
    }
}
