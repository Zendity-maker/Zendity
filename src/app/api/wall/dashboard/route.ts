import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { todayStartAST, fechaCalendarioAST } from '@/lib/dates';
import { ULCERA_ABIERTA } from '@/lib/upp';
import { requireWallViewer } from '@/lib/wall-auth';

/**
 * LA PARED DEL PISO — lo que falta en este turno.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * PARA QUIÉN ES, Y POR QUÉ ESO LO DECIDE TODO
 *
 * Para el PERSONAL EN TURNO. No es una preferencia: es lo único que el dato
 * sostiene. A una familia no se le puede enseñar el mapa —nombre y apellido más
 * "vive en un hogar de cuidado" ya es información de salud— y sin mapa no queda
 * una pared, queda un cartel. A un residente le serviría el menú, y el menú no
 * existe: UNA fila en toda la historia de las dos sedes, con las cuatro comidas
 * en blanco.
 *
 * Esta pantalla va en la sala de descanso del personal. La del área común es
 * OTRA, con otros datos, y no se construye hasta que haya algo cierto que poner.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LA REGLA: UN BLOQUE ENTRA SI PUEDE LLEGAR A CERO Y SI NOMBRA CUARTO
 *
 * Un número que no puede bajar enseña a no mirar. Uno sin nombre no habilita
 * nada, porque nadie sabe a qué cuarto ir.
 *
 * Lo que había antes fallaba las dos mitades:
 *
 *   · "ALERTAS CLÍNICAS" sumaba quejas abiertas + úlceras activas y lo pintaba
 *     en rojo de 120 píxeles con "Revisar panel de enfermería de inmediato".
 *     Las quejas llevan CERO abiertas —las 9 de la sede están resueltas— así
 *     que ese número era el contador de heridas. Reconstruido día a día: 89 de
 *     los últimos 90 días en rojo. El badge verde "TODO ESTABLE" no se ha
 *     podido dibujar en todo el trimestre. Y no filtraba el estado del
 *     residente: Wilfredo Matos murió el 16-jun y sus dos úlceras contaron 82
 *     días.
 *
 *   · "MEDS HOY" solo sabía subir: contaba `ADMINISTERED` y nada más. Con 10
 *     dosis sin dar hoy, ninguna salía. Y filtraba por `administeredAt >= 6 AM`,
 *     así que se comía la ronda de las 5:00 —que se firma a las 04:4x— de su
 *     propio numerador: 13 de 13 días medidos, la pared marcaba CERO a las 6:30
 *     y a las 7:30 de la mañana, justo durante el relevo.
 *
 *   · El punto verde "Estable" del mapa estaba escrito a mano en los 31
 *     residentes. Salían en verde los cuatro con úlcera abierta — exactamente
 *     los mismos que el número rojo contaba al lado. La pared se desmentía a sí
 *     misma en la misma pantalla.
 *
 *   · El menú salía de un `fallbackMenu` escrito en el código. No es un
 *     respaldo: es lo único que esa pantalla ha enseñado nunca.
 */
export const GET = wallHandler;

async function wallHandler(req: Request) {
    try {
        const quien = await requireWallViewer(req);
        if (quien instanceof NextResponse) return quien;
        const headquartersId = quien.headquartersId;

        /**
         * EL DÍA CLÍNICO, POR `createdAt`.
         *
         * Regla de CLAUDE.md: para acotar "lo de hoy" en una tabla de eventos se
         * usa `createdAt`, que siempre tiene valor. Aquí además arregla las dos
         * mitades a la vez: el cron crea las filas del día a las 06:00, así que
         * la ronda de las 5:00 entra en el conteo aunque se firme a las 04:4x.
         */
        const inicioDelDia = todayStartAST();
        const ahora = new Date();

        const [dosisDelDia, residentes, heridas, señalamientos, menu, hq] = await Promise.all([
            prisma.medicationAdministration.findMany({
                where: {
                    createdAt: { gte: inicioDelDia },
                    patientMedication: { patient: { headquartersId, status: 'ACTIVE' } },
                },
                select: {
                    status: true,
                    scheduledFor: true,
                    scheduledTime: true,
                    patientMedication: {
                        select: {
                            medication: { select: { name: true } },
                            patient: { select: { name: true, roomNumber: true } },
                        },
                    },
                },
                take: 2000,
            }),

            // El mapa: ubica, no diagnostica. Sin foto y sin grupo de color.
            // `photoUrl` son 1,12 MiB de base64 por consulta que la pantalla NO
            // dibuja —pinta la inicial del nombre—, cada 60 segundos. Y el grupo
            // de color no es un turno: RED concentra 7 de los 8 encamados, o sea
            // que es una etiqueta de dependencia viajando por la red.
            prisma.patient.findMany({
                where: { headquartersId, status: 'ACTIVE' },
                select: { id: true, name: true, roomNumber: true },
                orderBy: { roomNumber: 'asc' },
            }),

            // ULCERA_ABIERTA = ACTIVE + HEALING, que es como el resto del repo
            // define "abierta" (src/lib/upp.ts:67). Antes solo miraba ACTIVE: el
            // día que alguien marcara HEALING una herida abierta, la pared se
            // habría puesto verde por el motivo equivocado.
            prisma.pressureUlcer.findMany({
                where: { ...ULCERA_ABIERTA, patient: { headquartersId, status: 'ACTIVE' } },
                select: {
                    id: true, stage: true, bodyLocation: true,
                    patient: { select: { name: true, roomNumber: true } },
                    logs: {
                        where: { tipo: 'CURACION' },
                        orderBy: { createdAt: 'desc' },
                        take: 1,
                        select: { createdAt: true },
                    },
                },
            }),

            // Cualquier estado que no sea RESUELTO. El contador viejo miraba solo
            // PENDING y ROUTED_NURSING, y el enum tiene además APPROVED_ADMIN y
            // ROUTED_MAINTENANCE, que también están abiertos.
            prisma.complaint.count({
                where: { headquartersId, status: { not: 'RESOLVED' } },
            }),

            /**
             * EL MENÚ, O LA VERDAD DE QUE NO HAY.
             *
             * Por la LLAVE [sede, fecha], no por una ventana. Antes era un
             * `findFirst` con un rango que empezaba a las 6 AM AST: entre las 6:30
             * de la mañana y las 8 de la noche NO PODÍA contener ninguna
             * medianoche UTC, que es como cocina guarda. Durante desayuno,
             * almuerzo y cena el acierto era imposible.
             *
             * Y es `fechaCalendarioAST()`, no `clinicalDayCalendarUTC()`: ese
             * retrocede antes de las 6 AM. Comprobado hora a hora, habría enseñado
             * el menú de ayer todas las madrugadas, de medianoche a las seis — y
             * a esa hora lo que viene es el desayuno de hoy.
             */
            prisma.dailyMenu.findFirst({
                where: { headquartersId, date: fechaCalendarioAST() },
                select: { breakfast: true, lunch: true, dinner: true },
            }),

            prisma.headquarters.findUnique({
                where: { id: headquartersId },
                select: { name: true, logoUrl: true },
            }),
        ]);

        // ── eMAR del turno ────────────────────────────────────────────────
        const dadas = dosisDelDia.filter(d => d.status === 'ADMINISTERED').length;
        const resueltasDeOtroModo = dosisDelDia.filter(
            d => d.status === 'REFUSED' || d.status === 'OMITTED' || d.status === 'HELD',
        ).length;

        const sinDar = dosisDelDia
            .filter(d => d.status === 'MISSED')
            .map(d => ({
                residente: d.patientMedication.patient.name.trim(),
                cuarto: d.patientMedication.patient.roomNumber,
                medicamento: d.patientMedication.medication.name,
                franja: d.scheduledFor,
            }));

        // Vencidas: pendientes cuya hora ya pasó. Son las que alguien puede ir a
        // resolver ahora mismo — el resto del pendiente todavía no toca.
        const vencidas = dosisDelDia
            .filter(d => d.status === 'PENDING' && d.scheduledTime && d.scheduledTime < ahora)
            .map(d => ({
                residente: d.patientMedication.patient.name.trim(),
                cuarto: d.patientMedication.patient.roomNumber,
                medicamento: d.patientMedication.medication.name,
                franja: d.scheduledFor,
            }));

        // ── Curas del día ─────────────────────────────────────────────────
        // Mide el ACTO, no la herida: por eso puede llegar a cero todos los días.
        const HOY = inicioDelDia.getTime();
        const curas = heridas.map(u => {
            const ultima = u.logs[0]?.createdAt ?? null;
            return {
                residente: u.patient.name.trim(),
                cuarto: u.patient.roomNumber,
                etapa: u.stage,
                zona: u.bodyLocation,
                curadaHoy: !!ultima && ultima.getTime() >= HOY,
                horasSinCura: ultima ? Math.round(((ahora.getTime() - ultima.getTime()) / 3600e3) * 10) / 10 : null,
            };
        });

        const limpio = (t: string | null | undefined) => (t ?? '').trim() || null;

        return NextResponse.json({
            success: true,
            data: {
                sede: { nombre: hq?.name ?? 'Zéndity', logoUrl: hq?.logoUrl ?? null },
                mirandoComo: quien.via === 'DISPOSITIVO' ? quien.quien : null,
                generadoA: ahora.toISOString(),
                meds: {
                    dadas,
                    resueltasDeOtroModo,
                    vencidas,
                    sinDar,
                    totalDelDia: dosisDelDia.length,
                },
                curas: {
                    hechasHoy: curas.filter(c => c.curadaHoy).length,
                    total: curas.length,
                    pendientes: curas.filter(c => !c.curadaHoy),
                },
                señalamientosAbiertos: señalamientos,
                residentes,
                // Sin `fallbackMenu`. Cadena vacía es ausencia, no un menú en
                // blanco: la única fila que existe en la base tiene las cuatro
                // comidas en "" y el `||` la enseñaba como si fuera comida.
                menu: menu
                    ? { desayuno: limpio(menu.breakfast), almuerzo: limpio(menu.lunch), cena: limpio(menu.dinner) }
                    : null,
            },
        });
    } catch (error) {
        console.error('[wall] ', error);
        return NextResponse.json({ success: false, error: 'No se pudo cargar la pared' }, { status: 500 });
    }
}
