/**
 * Mantiene sincronizadas las dos copias de un mismo evento.
 *
 * Cuando una cuidadora reporta algo, Zendity escribe DOS filas: el registro
 * crudo (DailyLog, Complaint…) y un TriageTicket que lo apunta con
 * originType + originReferenceId. Después cada pantalla lee una copia
 * distinta: el inbox del supervisor lee lo crudo, el centro de triage lee el
 * ticket.
 *
 * Hasta hoy cada lado cerraba solo lo suyo: resolver en triage dejaba la
 * alerta viva en el inbox, y descartar en el inbox dejaba el ticket abierto.
 * Medido en Cupey el 25-ago-2026: 296 alertas clínicas levantadas y CERO
 * resueltas, con 248 de ellas ya cerradas del lado del triage. El supervisor
 * veía como pendiente lo que dirección ya había atendido.
 *
 * Estas dos funciones cierran el otro lado. Son best-effort a propósito: si
 * el espejo falla, la acción principal ya se guardó y no debe revertirse por
 * no haber podido actualizar la copia.
 *
 * NO todos los orígenes se pueden cerrar: Incident y FallIncident no tienen
 * campo de estado en el schema, así que no hay nada que marcar. Cubre
 * DAILY_LOG y COMPLAINT, que son 260 de los 272 tickets históricos.
 */
import { prisma } from '@/lib/prisma';

export type OrigenCerrado = 'dailyLog' | 'complaint' | 'sin-origen-cerrable';

/**
 * Cierra el registro crudo del que nació un ticket.
 * Se llama al resolver desde el centro de triage.
 */
export async function cerrarOrigenDeTicket(
    ticketId: string,
    hqId: string,
): Promise<OrigenCerrado> {
    const ticket = await prisma.triageTicket.findFirst({
        where: { id: ticketId, headquartersId: hqId },
        select: { originType: true, originReferenceId: true },
    });
    if (!ticket?.originReferenceId) return 'sin-origen-cerrable';

    if (ticket.originType === 'DAILY_LOG') {
        // updateMany y no update: si la fila ya no existe, no queremos que
        // explote el cierre del ticket, que es la acción que el usuario pidió.
        const r = await prisma.dailyLog.updateMany({
            where: { id: ticket.originReferenceId, patient: { headquartersId: hqId } },
            data: { isResolved: true },
        });
        return r.count > 0 ? 'dailyLog' : 'sin-origen-cerrable';
    }

    if (ticket.originType === 'COMPLAINT') {
        const r = await prisma.complaint.updateMany({
            where: { id: ticket.originReferenceId, headquartersId: hqId, status: 'PENDING' },
            data: { status: 'RESOLVED' },
        });
        return r.count > 0 ? 'complaint' : 'sin-origen-cerrable';
    }

    // INCIDENT y FALL no tienen estado que cerrar; EMAR_MISS, CRON_SYSTEM y
    // MANUAL no tienen fila de origen.
    return 'sin-origen-cerrable';
}

/**
 * Cierra el ticket que nació de un registro crudo.
 * Se llama al descartar desde el inbox del supervisor.
 *
 * Devuelve cuántos tickets cerró (normalmente 0 o 1).
 */
export async function cerrarTicketDeOrigen(
    originReferenceId: string,
    hqId: string,
    motivo: string,
    invokerId: string,
    invokerName: string,
): Promise<number> {
    const abiertos = await prisma.triageTicket.findMany({
        where: {
            originReferenceId,
            headquartersId: hqId,
            resolvedAt: null,
        },
        select: { id: true, followUpNotes: true },
    });
    if (abiertos.length === 0) return 0;

    for (const t of abiertos) {
        const previas = Array.isArray(t.followUpNotes) ? t.followUpNotes : [];
        await prisma.triageTicket.update({
            where: { id: t.id },
            data: {
                status: 'RESOLVED',
                resolvedAt: new Date(),
                resolvedById: invokerId,
                followUpNotes: [
                    ...previas,
                    {
                        authorId: invokerId,
                        authorName: invokerName,
                        note: `Cerrado desde el inbox del supervisor: ${motivo}`,
                        createdAt: new Date().toISOString(),
                    },
                ] as any,
            },
        });
    }
    return abiertos.length;
}
