/**
 * OBSERVACIONES DE PERSONAL QUE ESPERAN UNA DECISIÓN
 * ─────────────────────────────────────────────────
 * El número que va junto a "Observaciones de Personal" en el menú.
 *
 * POR QUÉ HACÍA FALTA. El empleado ya tenía su contador —"Mis Observaciones"
 * lleva badge desde siempre, consultando /api/my-observations/pending-count— y
 * quien decide no tenía ninguno. La asimetría se veía en producción el
 * 04-sep-2026:
 *
 *     EXPLANATION_RECEIVED   56 días parada · Brendali Collazo
 *     EXPLANATION_RECEIVED   45 días parada · Joaneliz Rosario
 *
 * Las dos SÍ dispararon su notificación al responder el empleado —"Pendiente
 * tu decisión"— y llevaban casi dos meses ahí. Una notificación se lee una vez
 * y se va; un contador insiste hasta que alguien resuelve. Ese es el
 * instrumento correcto para algo que espera, y era el que faltaba.
 *
 * DOS NÚMEROS, NO UNO. Lo que espera al director y lo que espera al empleado
 * son cosas distintas y meterlas en el mismo badge lo volvería ambiguo: nadie
 * sabría si el 5 significa "decide" o "persigue a alguien". El badge muestra
 * solo lo accionable; el resto viaja para que la pantalla pueda enseñarlo.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

/** Quienes pueden decidir sobre una observación. Mismo set que /decide. */
const DECIDEN = ['DIRECTOR', 'ADMIN', 'HR_MANAGER'];

/** A partir de aquí, una espera del empleado deja de ser normal. */
const DIAS_SIN_RESPUESTA = 14;

export async function GET() {
    const auth = await requireRole(DECIDEN);
    if (auth instanceof NextResponse) return auth;

    try {
        const limite = new Date(Date.now() - DIAS_SIN_RESPUESTA * 86400000);

        const [borradores, respondidas, sinRespuesta] = await Promise.all([
            // Escrita y sin decidir.
            prisma.incidentReport.count({
                where: { headquartersId: auth.headquartersId, status: 'DRAFT' },
            }),
            // El empleado contestó: le toca al director.
            prisma.incidentReport.count({
                where: { headquartersId: auth.headquartersId, status: 'EXPLANATION_RECEIVED' },
            }),
            // Le toca al empleado, pero lleva demasiado. Nadie más va a
            // perseguirlo: el empleado tiene su propio badge y lo está
            // ignorando.
            prisma.incidentReport.count({
                where: {
                    headquartersId: auth.headquartersId,
                    status: 'PENDING_EXPLANATION',
                    notifiedAt: { lt: limite },
                },
            }),
        ]);

        return NextResponse.json({
            success: true,
            // El badge: solo lo que depende de quien mira.
            pendientes: borradores + respondidas,
            borradores,
            respondidas,
            sinRespuesta,
            diasSinRespuesta: DIAS_SIN_RESPUESTA,
        });
    } catch (error) {
        console.error('HR incidents pending-count error:', error);
        return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 });
    }
}
