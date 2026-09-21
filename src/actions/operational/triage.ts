"use server";
import { prisma } from '@/lib/prisma';
import { TicketPriority, TicketOriginType, SystemAuditAction, Role } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { createAuditLog } from './audit';
import { revalidatePath } from 'next/cache';



/** Ventana de la guarda contra doble envío. Ver el porqué dentro de la función. */
const VENTANA_DOBLE_ENVIO_MS = 2 * 60 * 1000;

export async function createTriageTicket(data: {
    originType: TicketOriginType;
    description: string;
    priority?: TicketPriority;
    patientId?: string;
    originReferenceId?: string;
    /** Una línea que diga de qué va. Ver el porqué en prisma/schema.prisma. */
    title?: string;
    /** A quién se le encarga. Opcional: un pendiente sin dueño sigue siendo un pendiente. */
    assignedToId?: string;
}) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return { success: false, error: 'No autorizado' };
    }

    /**
     * Se miran los roles SECUNDARIOS además del principal.
     *
     * Antes esto comparaba solo `session.user.role` contra [SUPERVISOR,
     * DIRECTOR, NURSE], y en este hogar la rama NURSE no alcanzaba a nadie: no
     * hay ninguna persona con NURSE de rol primario. La enfermería la hace la
     * directora con NURSE secundario. Gatear solo por el primario deja fuera
     * exactamente a quien se quería dejar entrar — es el mismo fallo que ya
     * costó dos roles fantasma en otras partes del repo.
     *
     * `requireRole` (src/lib/api-auth.ts) hace esto mismo, pero es para route
     * handlers y devuelve un NextResponse; esto es una server action.
     */
    const suyos = [
        (session.user as any).role,
        ...(((session.user as any).secondaryRoles ?? []) as string[]),
    ];
    const PUEDEN_ABRIR: string[] = [Role.SUPERVISOR, Role.DIRECTOR, Role.ADMIN, Role.NURSE];
    if (!suyos.some(r => PUEDEN_ABRIR.includes(r))) {
        return { success: false, error: 'Tu rol no puede abrir pendientes' };
    }

    // @ts-ignore
    const hqId = session.user.headquartersId;

    const titulo = data.title?.trim() || null;
    const descripcion = data.description?.trim() || '';
    if (!descripcion && !titulo) {
        return { success: false, error: 'Escribe al menos de qué se trata' };
    }

    try {
        /**
         * GUARDA CONTRA DOBLE ENVÍO — antipatrón nº1 de este proyecto.
         *
         * Un doble toque, o un reintento porque la pantalla se vio lenta, y hay
         * dos pendientes donde debía haber uno. Ya costó 30 tomas de vitales
         * duplicadas, una caída contada dos veces y dos residentes duplicados.
         * Y Andrés pidió esta pantalla esperando que fuera "muy usada y viva
         * diariamente": si lo es, se nota al día siguiente.
         *
         * Se devuelve ÉXITO con el que ya existe, no un error. Quien pulsó hizo
         * lo correcto; un error en rojo le hace intentarlo otra vez, que es
         * justo lo que produce el duplicado.
         *
         * Dos minutos: es un acto de teclear, no un registro retroactivo.
         */
        const yaExiste = await prisma.triageTicket.findFirst({
            where: {
                headquartersId: hqId,
                originType: data.originType,
                description: descripcion,
                createdAt: { gte: new Date(Date.now() - VENTANA_DOBLE_ENVIO_MS) },
            },
            orderBy: { createdAt: 'desc' },
        });
        if (yaExiste) {
            return { success: true, ticket: yaExiste, yaExistia: true };
        }

        const ticket = await prisma.triageTicket.create({
            data: {
                headquartersId: hqId,
                originType: data.originType,
                title: titulo,
                description: descripcion,
                priority: data.priority || 'MEDIUM',
                patientId: data.patientId,
                originReferenceId: data.originReferenceId,
                assignedToId: data.assignedToId || null,
            }
        });

        await createAuditLog(hqId, 'TriageTicket', ticket.id, SystemAuditAction.CREATED, { data });
        revalidatePath('/corporate/triage');
        revalidatePath('/care/supervisor');
        return { success: true, ticket };
    } catch (error) {
        console.error("Create Triage Error:", error);
        return { success: false, error: 'Internal Server Error' };
    }
}

/*
 * AQUÍ VIVÍA `resolveTriageTicket`, y se borró el 21-sep-2026.
 *
 * Era un segundo camino para cerrar un ticket, en paralelo al que la pantalla
 * usa de verdad: `PATCH /api/corporate/triage/resolve`. Esa ruta ya hacía lo
 * mismo y ya estaba bien —requireRole, que mira roles secundarios, y
 * comprobación de que el ticket sea de tu sede—.
 *
 * El camino muerto llevaba cuatro fallos desde que se escribió: gateaba solo
 * por rol primario, escribía con `update({ where: { id } })` sin mirar la sede,
 * pisaba la nota y la autoría de quien hubiera cerrado primero, y devolvía el
 * objeto de error crudo al cliente. Se arreglaron y luego se quitó entero.
 *
 * POR QUÉ SE QUITA EN VEZ DE DEJARLO ARREGLADO: dos caminos a la misma
 * escritura es una trampa. El que no se usa se queda sin mantener, y un día
 * alguien cablea el equivocado. No es hipotético: `createTriageTicket` llevaba
 * meses sin un solo llamador y se cableó el 21-sep. Si se hubiera cableado
 * este en vez de aquel, el agujero de sede habría entrado en producción.
 *
 * Lo único que lo sostenía era una rama de abril —worktree `sad-wiles`— que
 * todavía lo importaba. Esa rama estaba mergeada en main y sus cambios sin
 * guardar ya estaban en main por otra vía; se borró el mismo día.
 *
 * Para cerrar un ticket: PATCH /api/corporate/triage/resolve.
 */

