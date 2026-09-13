/**
 * APLICAR UNA OBSERVACIÓN DE PERSONAL. Un solo camino, dos invocadores.
 *
 * Lo llaman `/api/hr/incidents/[id]/decide` (a mano, el director) y
 * `/api/cron/apply-pending-observations` (solo, al vencer el plazo). La
 * política —plazos y puntos— vive en `incidente-politica.ts`; aquí está lo que
 * toca la base.
 *
 * Ver el comentario de ese módulo para qué se rompió y por qué existe esto.
 */
import { prisma } from '@/lib/prisma';
import { notifyUser } from '@/lib/notifications';
import { applyScoreEvent } from '@/lib/score-event';
import { IncidentStatus, type HrIncidentSeverity } from '@prisma/client';
import { puntosPorSeveridad, etiquetaSeveridad } from '@/lib/incidente-politica';

export interface ObservacionAAplicar {
    id: string;
    employeeId: string;
    headquartersId: string;
    severity: HrIncidentSeverity;
    directorNote?: string | null;
    employee?: { complianceScore?: number | null } | null;
}

export interface ResultadoDeAplicar {
    pointsDeducted: number;
    delta: number;
}

/**
 * Escribe la sanción: el hecho, los puntos y el aviso. En este orden y siempre
 * los tres.
 *
 * `automatica` solo cambia el texto del aviso. NO cambia los puntos: el cron
 * decide cuándo, nunca cuánto. Tener dos tablas de puntos es lo que produjo 49
 * sanciones con 70 puntos donde correspondían 217.
 */
export async function aplicarObservacion(
    incident: ObservacionAAplicar,
    opciones: { ahora?: Date; notaDirector?: string | null; automatica?: boolean } = {},
): Promise<ResultadoDeAplicar> {
    const ahora = opciones.ahora ?? new Date();
    const { delta, setToZero } = puntosPorSeveridad(incident.severity);

    const scoreActual = incident.employee?.complianceScore ?? 50;
    // TERMINATION lleva el score a 0: el delta efectivo es todo lo que tenía.
    const deltaEfectivo = setToZero ? -scoreActual : delta;
    const puntos = setToZero ? scoreActual : Math.abs(delta);

    await prisma.incidentReport.update({
        where: { id: incident.id },
        data: {
            status: IncidentStatus.APPLIED,
            appliedAt: ahora,
            visibleToEmployee: true,
            pointsDeducted: puntos,
            ...(opciones.notaDirector !== undefined
                ? { directorNote: opciones.notaDirector || incident.directorNote || null }
                : {}),
        },
    });

    /**
     * El historial auditable. Esto es lo que al cron le faltaba entero: 49
     * sanciones aplicadas y cero filas en ScoreEvent, así que el expediente
     * decía "puntos deducidos: 5" y no había ni rastro de dónde salieron ni de
     * que se hubieran descontado.
     *
     * `applyScoreEvent` no lanza: si falla, lo registra y sigue.
     */
    if (deltaEfectivo !== 0) {
        await applyScoreEvent(
            incident.employeeId,
            incident.headquartersId,
            deltaEfectivo,
            `Observación aplicada: ${etiquetaSeveridad(incident.severity)}`,
            'INCIDENT',
        );
    }

    await notifyUser(incident.employeeId, {
        // HR_OBSERVATION, no EMAR_ALERT. El cron etiquetaba la sanción como una
        // alerta de medicación, que es la campana que la cuidadora aprende a
        // mirar con urgencia por otra cosa.
        type: 'HR_OBSERVATION',
        title: opciones.automatica ? 'Observación aplicada automáticamente' : 'Observación aplicada',
        message: opciones.automatica
            ? `Se aplicó una ${etiquetaSeveridad(incident.severity)} por no responder a tiempo. Puntos deducidos: ${puntos}. Revisa el detalle.`
            : `Se aplicó una ${etiquetaSeveridad(incident.severity)}. Puntos deducidos: ${puntos}. Revisa el detalle.`,
        link: `/my-observations/${incident.id}`,
    });

    return { pointsDeducted: puntos, delta: deltaEfectivo };
}
