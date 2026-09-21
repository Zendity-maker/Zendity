"use server";
import { prisma } from '@/lib/prisma';
import {  TicketPriority, TicketOriginType, TicketStatus, SystemAuditAction, Role } from '@prisma/client';
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

/**
 * Cerrar un pendiente con su nota.
 *
 * OJO AL LEER ESTO: la pantalla /corporate/triage NO usa esta acción — usa
 * `PATCH /api/corporate/triage/resolve`, que hace lo mismo y ya estaba bien.
 * Esta acción no tiene llamadores en `src/`. No se borra porque una rama en
 * curso (worktree `sad-wiles`) sí la importa, y borrarla la rompería al
 * mergear. Dos caminos a la misma escritura es una trampa: el que no se usa
 * se queda sin arreglar y un día alguien cablea el equivocado. Le acaba de
 * pasar a `createTriageTicket`, que llevaba meses muerta y se cableó hoy.
 * Si la rama se descarta, esta función se borra.
 *
 * Se le arreglan cuatro cosas de golpe, todas presentes desde que se escribió:
 */
export async function resolveTriageTicket(ticketId: string, resolutionNote: string) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return { success: false, error: 'No autorizado' };
    }

    /**
     * 1. LOS ROLES SECUNDARIOS CUENTAN.
     *
     * Comparaba solo `session.user.role` contra [SUPERVISOR, DIRECTOR]. En
     * este hogar eso deja fuera a cualquiera que tenga el rol de secundario,
     * y es una configuración normal aquí: la enfermería la hace la directora
     * con NURSE secundario, y las dos supervisoras tienen CAREGIVER
     * secundario. La ruta equivalente usa `requireRole`, que sí los mira; esto
     * es una server action y no puede usarla, así que replica su criterio.
     * Se añade ADMIN para igualar a la ruta.
     */
    const suyos = [
        (session.user as any).role,
        ...(((session.user as any).secondaryRoles ?? []) as string[]),
    ];
    const PUEDEN_CERRAR: string[] = [Role.SUPERVISOR, Role.DIRECTOR, Role.ADMIN];
    if (!suyos.some(r => PUEDEN_CERRAR.includes(r))) {
        return { success: false, error: 'Tu rol no puede cerrar pendientes' };
    }

    // @ts-ignore
    const hqId = session.user.headquartersId;
    // @ts-ignore
    const userId = session.user.id;

    const nota = resolutionNote?.trim() || '';
    if (!nota) {
        // 2. Cerrar sin decir qué se hizo vacía el valor del tablero: de los 356
        //    tickets, 344 tienen nota de resolución escrita a mano. Eso es lo
        //    único que lo hace consultable después.
        return { success: false, error: 'Escribe qué se hizo antes de cerrarlo' };
    }

    try {
        /**
         * 3. EL TICKET TIENE QUE SER DE TU SEDE.
         *
         * Hacía `update({ where: { id } })` sin comprobar nada: con el id de un
         * ticket de la otra sede, se cerraba. Es la misma clase de agujero que
         * se cerró el 19-sep en `hr/staff` y en `hq-resolver`. La ruta
         * equivalente sí lo comprueba (/api/corporate/triage/resolve:23-30).
         *
         * 4. Y NO SE PISA EL CIERRE DE OTRO. Si ya estaba resuelto, se devuelve
         *    el que hay en vez de sobrescribir la nota y la autoría de quien lo
         *    cerró primero. Dos personas mirando el mismo tablero es el caso
         *    normal, no el raro.
         */
        const actual = await prisma.triageTicket.findUnique({
            where: { id: ticketId },
            select: { headquartersId: true, status: true },
        });
        if (!actual || actual.headquartersId !== hqId) {
            return { success: false, error: 'Ese pendiente no es de tu sede' };
        }
        if (actual.status === TicketStatus.RESOLVED) {
            const yaCerrado = await prisma.triageTicket.findUnique({ where: { id: ticketId } });
            return { success: true, ticket: yaCerrado, yaEstabaCerrado: true };
        }

        const ticket = await prisma.triageTicket.update({
            where: { id: ticketId },
            data: {
                status: TicketStatus.RESOLVED,
                resolutionNote: nota,
                resolvedById: userId,
                resolvedAt: new Date()
            }
        });

        await createAuditLog(hqId, 'TriageTicket', ticket.id, SystemAuditAction.RESOLVED, { resolutionNote: nota });
        revalidatePath('/corporate/triage');
        revalidatePath('/care/supervisor');
        return { success: true, ticket };
    } catch (error) {
        // Devolvía el objeto de error crudo al cliente, que puede llevar dentro
        // la consulta y el nombre de las columnas. Se registra aquí y afuera va
        // una frase.
        console.error('[resolveTriageTicket]', error);
        return { success: false, error: 'No se pudo cerrar el pendiente' };
    }
}
