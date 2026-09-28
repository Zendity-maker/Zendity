/**
 * ACUSE DE RECIBO DEL RELEVO — SIN UN TOQUE DE MÁS
 *
 * ═══ QUÉ FALTABA ═══
 *
 * El relevo tenía dos actos de tres. Medido el 28-sep-2026 sobre los 1.080
 * relevos de personas que hay en producción:
 *
 *     entregados y firmados por quien salía ... 1.079  (99,9 %)
 *     firmados por supervisión ................   255  (24 %)
 *     RECIBIDOS por quien entraba .............     1  — el 20-may, el
 *                                                    primer día, y a mano
 *                                                    desde la pantalla
 *                                                    corporativa
 *
 * `incomingNurseId` existe en el modelo desde el principio y la tableta nunca
 * lo llenó. Los relevos nacen con `status: 'ACCEPTED'` en /api/care/shift/end,
 * pero eso significa «no está bloqueado esperando al supervisor», no «alguien
 * lo recibió». Así que el dato de quién recibió el turno no existía.
 *
 * ═══ POR QUÉ NO HAY PANTALLA NUEVA ═══
 *
 * Andrés: «si, pero no haga complejo el proceso».
 *
 * Y tiene razón: la cuidadora ya pasa por color, cobertura, censo de diez
 * residentes uno por uno, y el relevo. Meterle un paso más para que firme que
 * leyó lo que acaba de leer es cobrarle el doble por lo mismo.
 *
 * El acto ya existe: en la pantalla del relevo ella ve el reporte de quien
 * salió y pulsa «Adelante, Iniciar Cuidados». Eso ES recibir el turno. Lo
 * único que faltaba era anotarlo.
 *
 * Cero toques nuevos. Lo que cambia es que queda escrito.
 *
 * ═══ LO QUE NO SE ANOTA, Y POR QUÉ ═══
 *
 *   · Si el relevo YA tiene quien lo recibió, no se pisa. El primero que entra
 *     es el que lo recibió; los demás lo leen.
 *   · Si quien entra es la MISMA que lo entregó —pasa cuando alguien encadena
 *     dos turnos— no se anota nada. «Recibido por la misma que lo entregó» no
 *     es continuidad de cuidado, es una fila que miente.
 *   · Solo roles de piso. Un DIRECTOR mirando el relevo no lo está recibiendo.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { ROLES_DE_PISO } from '@/lib/roles-clinicos';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    const auth = await requireRole(ROLES_DE_PISO as unknown as string[]);
    if (auth instanceof NextResponse) return auth;

    try {
        const { handoverId } = await req.json().catch(() => ({}));
        if (!handoverId || typeof handoverId !== 'string') {
            return NextResponse.json({ success: false, error: 'Falta el relevo' }, { status: 400 });
        }

        // La sede sale de la sesión, nunca del cuerpo.
        const relevo = await prisma.shiftHandover.findFirst({
            where: { id: handoverId, headquartersId: auth.headquartersId },
            select: { id: true, incomingNurseId: true, outgoingNurseId: true },
        });
        if (!relevo) {
            return NextResponse.json({ success: false, error: 'Relevo no encontrado' }, { status: 404 });
        }

        if (relevo.incomingNurseId) {
            // Ya lo recibió alguien. Éxito, no error: quien llega después hizo
            // lo correcto leyéndolo, y un rojo aquí no le enseña nada.
            return NextResponse.json({ success: true, yaRecibido: true });
        }

        if (relevo.outgoingNurseId === auth.id) {
            return NextResponse.json({ success: true, esSuyo: true });
        }

        await prisma.shiftHandover.update({
            where: { id: relevo.id },
            data: { incomingNurseId: auth.id, acceptedAt: new Date() },
        });

        return NextResponse.json({ success: true, recibido: true });
    } catch (error: any) {
        console.error('[care/briefing/recibido]', error?.message ?? error);
        return NextResponse.json({ success: false, error: 'No se pudo anotar el recibo' }, { status: 500 });
    }
}
