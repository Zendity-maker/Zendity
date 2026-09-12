import { prisma } from '@/lib/prisma';
import { notifyUser } from '@/lib/notifications';
import { logError } from '@/lib/logger';
import { RUTA_CERTIFICACION } from '@/lib/formacion-pendiente';

/**
 * Asignación de formación — el cable que faltaba entre lo que pasa en el piso
 * y la Academia.
 *
 * Diagnóstico que originó esto (ago-2026): 16 cursos publicados con contenido
 * real, y 17 de 19 empleados que nunca abrieron uno. `AcademyAssignment`
 * existía en el schema con CERO registros: el sistema detectaba 30 incidentes
 * de higiene y jamás ofrecía el curso de higiene que ya tenía.
 *
 * Principio: nadie busca un curso. El curso llega cuando hace falta.
 *
 * NOTA DE ALCANCE CLÍNICO: un hogar de envejecientes no decide tratamiento —
 * la enfermera de home care establece el plan y el hogar hace continuidad.
 * Por eso la formación que se asigna enseña a observar, ejecutar y reportar,
 * nunca a diagnosticar.
 */

/** Días para completar una formación asignada por un incidente. */
const PLAZO_DIAS = 7;

/**
 * Categoría de incidente → curso que la responde.
 *
 * Se busca por fragmento de título en vez de por id: los cursos se siembran
 * por sede (academy-seed) y sus ids difieren entre sedes, pero los títulos son
 * estables. Un fragmento que no encuentre curso simplemente no asigna nada —
 * nunca rompe el flujo del incidente.
 */
const CURSO_POR_CATEGORIA: Record<string, string> = {
    HYGIENE: 'Limpieza y Sanitizacion',
    PATIENT_CARE: 'El Cuidador en Zendity',
    DOCUMENTATION: 'Proceso de Cierre de Turno',
    // PUNCTUALITY y BEHAVIOR no tienen curso todavía (Fase 2 del plan).
    // Se dejan fuera a propósito: asignar un curso que no aborda el problema
    // enseña al equipo a ignorar las asignaciones.
};

/** Cursos base de un empleado nuevo, por rol. */
const RUTA_INGRESO: Record<string, string[]> = {
    /**
     * CAIDAS VA EN LOS TRES ROLES DE PISO, y es el unico curso clinico que
     * entra en una ruta de ingreso.
     *
     * Medido el 12-sep-2026: no lo asignaba NINGUNA ruta — ni el de ingreso, ni
     * la certificacion, ni la regla de incidentes. Vale 30 puntos, el maximo del
     * catalogo, y tenia cero matriculas. Un curso que no asigna nadie es un
     * curso que no abre nadie.
     *
     * Va el primer dia y no en la certificacion porque una caida puede pasar en
     * el primer turno, y lo que hay que saber —que el deslizador de dolor fija
     * la gravedad del expediente, y que a la familia la llama una persona
     * porque el sistema no la avisa— no admite esperar cuatro horas de
     * contenido.
     */
    CAREGIVER: ['Acceso y Roles en Zendity', 'El Cuidador en Zendity', 'eMAR: Administracion Electronica', 'Protocolo de Respuesta a Caidas'],
    NURSE: ['Acceso y Roles en Zendity', 'La Enfermera en Zendity', 'eMAR: Administracion Electronica', 'Protocolo de Respuesta a Caidas'],
    SUPERVISOR: ['Acceso y Roles en Zendity', 'El Supervisor en Zendity', 'Handover de Enfermeria', 'Protocolo de Respuesta a Caidas'],
    DIRECTOR: ['Acceso y Roles en Zendity', 'El Director en Zendity'],
    ADMIN: ['Acceso y Roles en Zendity', 'El Administrador en Zendity'],
    CLEANING: ['Acceso y Roles en Zendity', 'Limpieza y Sanitizacion'],
    SOCIAL_WORKER: ['Acceso y Roles en Zendity', 'Trabajo Social en Zendity'],
    COORDINATOR: ['Acceso y Roles en Zendity', 'El Administrador en Zendity'],
    /**
     * MANTENIMIENTO Y COCINA no estaban, y el `?? RUTA_INGRESO.CAREGIVER` de
     * abajo les daba la ruta de la CUIDADORA: al señor de mantenimiento se le
     * asignaba el curso de administración electrónica de medicamentos. Hay dos
     * personas activas con estos roles.
     */
    MAINTENANCE: ['Acceso y Roles en Zendity', 'Planta Fisica y Mantenimiento'],
    KITCHEN: ['Acceso y Roles en Zendity'],
};

/**
 * Certificación geriátrica — la formación del OFICIO, no del software.
 *
 * Es lo que el Departamento de la Familia exige para acreditar a un cuidador.
 * Va aparte de RUTA_INGRESO a propósito: la ruta de ingreso enseña a usar
 * Zendity y se completa en un par de días; esta acredita a la persona y toma
 * cuatro horas de contenido. Mezclarlas hace que lo urgente entierre lo
 * importante.
 *
 * La lista y su ORDEN viven en `formacion-pendiente.ts`, que no importa Prisma:
 * así el mismo orden que decide qué se asigna decide también qué se enseña
 * primero en pantalla. Estaba declarado aquí y no lo leía nadie — los diez
 * módulos se asignaban de golpe y la persona veía trece tarjetas iguales.
 */
export { RUTA_CERTIFICACION } from '@/lib/formacion-pendiente';

/**
 * Roles con contacto directo con residentes.
 *
 * La certificación es para quien toca a un residente, no para quien nunca
 * entra al piso. INVESTOR, SUPER_ADMIN y ADMIN quedan fuera; MAINTENANCE y
 * KITCHEN también, aunque circulen por la facilidad.
 */
const ROLES_CON_RESIDENTES = new Set([
    'CAREGIVER', 'NURSE', 'SUPERVISOR', 'DIRECTOR', 'SOCIAL_WORKER', 'COORDINATOR',
]);

export function requiereCertificacion(role: string): boolean {
    return ROLES_CON_RESIDENTES.has(role);
}

async function buscarCurso(hqId: string, fragmento: string) {
    return prisma.course.findFirst({
        where: { headquartersId: hqId, isActive: true, title: { contains: fragmento, mode: 'insensitive' } },
        select: { id: true, title: true },
    });
}

/**
 * Asigna la formación que corresponde a un incidente de RRHH.
 *
 * Best-effort: si algo falla, el incidente ya se creó y no debe revertirse por
 * una asignación de curso.
 */
export async function asignarPorIncidente(opts: {
    hqId: string;
    userId: string;
    category: string;
    incidentId: string;
    assignedByUserId?: string | null;
}): Promise<{ assigned: boolean; courseTitle?: string }> {
    try {
        const fragmento = CURSO_POR_CATEGORIA[opts.category];
        if (!fragmento) return { assigned: false };

        const curso = await buscarCurso(opts.hqId, fragmento);
        if (!curso) return { assigned: false };

        // Idempotencia: si ya tiene esa formación pendiente, no se duplica.
        // Un segundo incidente de la misma categoría no debe generar dos
        // asignaciones del mismo curso.
        const existente = await prisma.academyAssignment.findFirst({
            where: {
                userId: opts.userId,
                moduleCode: curso.id,
                status: { in: ['PENDING', 'IN_PROGRESS'] },
            },
            select: { id: true },
        });
        if (existente) return { assigned: false };

        // Si ya completó el curso, reasignarlo es refuerzo legítimo tras un
        // incidente — pero se deja constancia de que es una repetición.
        const yaCompletado = await prisma.userCourse.findFirst({
            where: { employeeId: opts.userId, courseId: curso.id, status: 'COMPLETED' },
            select: { id: true },
        });

        await prisma.academyAssignment.create({
            data: {
                headquartersId: opts.hqId,
                userId: opts.userId,
                moduleCode: curso.id,
                reason: `Incidente de ${etiquetaCategoria(opts.category)}${yaCompletado ? ' — refuerzo' : ''}`,
                status: 'PENDING',
                assignedBySystem: true,
                assignedByUserId: opts.assignedByUserId ?? null,
            },
        });

        const vence = new Date(Date.now() + PLAZO_DIAS * 24 * 3600 * 1000);
        await notifyUser(opts.userId, {
            type: 'COURSE_COMPLETED',
            title: '📚 Formación asignada',
            message: `"${curso.title}" — tienes hasta el ${vence.toLocaleDateString('es-PR', { day: '2-digit', month: 'long' })} para completarlo.`,
            link: '/academy',
        });

        return { assigned: true, courseTitle: curso.title };
    } catch (err) {
        logError('academy.assign.incident', err);
        return { assigned: false };
    }
}

/**
 * Ruta de ingreso: los cursos base de un empleado nuevo.
 *
 * Sin esto, alguien que entra ve 16 tarjetas sin orden ni prioridad. La
 * pregunta "¿por dónde empiezo?" hoy la contesta el 89% no entrando.
 */
export async function asignarRutaIngreso(opts: {
    hqId: string;
    userId: string;
    role: string;
    assignedByUserId?: string | null;
}): Promise<number> {
    try {
        const fragmentos = RUTA_INGRESO[opts.role] ?? RUTA_INGRESO.CAREGIVER;
        let creadas = 0;

        for (const fragmento of fragmentos) {
            const curso = await buscarCurso(opts.hqId, fragmento);
            if (!curso) continue;

            const existente = await prisma.academyAssignment.findFirst({
                where: { userId: opts.userId, moduleCode: curso.id },
                select: { id: true },
            });
            if (existente) continue;

            await prisma.academyAssignment.create({
                data: {
                    headquartersId: opts.hqId,
                    userId: opts.userId,
                    moduleCode: curso.id,
                    reason: 'Ruta de ingreso',
                    status: 'PENDING',
                    assignedBySystem: true,
                    assignedByUserId: opts.assignedByUserId ?? null,
                },
            });
            creadas++;
        }

        if (creadas > 0) {
            await notifyUser(opts.userId, {
                type: 'COURSE_COMPLETED',
                title: '🎓 Bienvenida — tu formación inicial',
                message: `Tienes ${creadas} curso${creadas !== 1 ? 's' : ''} para empezar. Toca para verlos.`,
                link: '/academy',
            });
        }
        return creadas;
    } catch (err) {
        logError('academy.assign.onboarding', err);
        return 0;
    }
}

/**
 * Asigna la certificación geriátrica completa.
 *
 * Idempotente por curso: si ya tiene la asignación (en cualquier estado) no la
 * duplica, así que puede correrse sobre personal existente sin ensuciar nada.
 *
 * Una sola notificación al final, no siete. El ruido es lo que hace que la
 * gente deje de mirar la campana.
 */
export async function asignarRutaCertificacion(opts: {
    hqId: string;
    userId: string;
    assignedByUserId?: string | null;
    /** Sin notificación: para backfills masivos que se anuncian aparte. */
    silencioso?: boolean;
}): Promise<number> {
    try {
        let creadas = 0;

        for (const fragmento of RUTA_CERTIFICACION) {
            const curso = await buscarCurso(opts.hqId, fragmento);
            if (!curso) continue;

            const existente = await prisma.academyAssignment.findFirst({
                where: { userId: opts.userId, moduleCode: curso.id },
                select: { id: true },
            });
            if (existente) continue;

            await prisma.academyAssignment.create({
                data: {
                    headquartersId: opts.hqId,
                    userId: opts.userId,
                    moduleCode: curso.id,
                    reason: 'Certificación geriátrica',
                    status: 'PENDING',
                    assignedBySystem: true,
                    assignedByUserId: opts.assignedByUserId ?? null,
                },
            });
            creadas++;
        }

        if (creadas > 0 && !opts.silencioso) {
            await notifyUser(opts.userId, {
                type: 'COURSE_COMPLETED',
                title: '🎓 Certificación geriátrica',
                message: `Tu formación de cuidado geriátrico está disponible: ${creadas} módulo${creadas !== 1 ? 's' : ''}. Es la que acredita tu preparación.`,
                link: '/academy',
            });
        }
        return creadas;
    } catch (err) {
        logError('academy.assign.certificacion', err);
        return 0;
    }
}

/**
 * EL CURSO DEL TURNO DE NOCHE, CUANDO LE TOCA SU PRIMERA NOCHE.
 *
 * "Turno Nocturno del Cuidador" tampoco lo asignaba ninguna ruta. Meterlo en la
 * ruta de ingreso seria mentir dos veces: se lo daria a quien nunca trabaja de
 * noche, y a quien si lo hace se lo daria meses antes de necesitarlo, mezclado
 * con otros catorce.
 *
 * El momento honesto existe y esta medido en el propio sistema: cuando el
 * horario publicado le pone su primer turno de noche. La pantalla de la tableta
 * cambia sola a las diez —modo de rondas, botones grandes, plazo de rotacion de
 * dos horas— y quien no lo ha visto nunca se lo encuentra de madrugada.
 *
 * Idempotente: solo asigna si no lo tiene ya abierto Y no lo ha aprobado nunca.
 * Se llama en cada publicacion de horario, asi que se ejecuta muchas veces.
 */
export async function asignarPorPrimerTurnoDeNoche(opts: {
    hqId: string;
    userId: string;
    assignedByUserId?: string | null;
}): Promise<boolean> {
    try {
        const curso = await buscarCurso(opts.hqId, 'Turno Nocturno');
        if (!curso) return false;

        const [abierto, aprobado] = await Promise.all([
            prisma.academyAssignment.findFirst({
                where: { userId: opts.userId, moduleCode: curso.id },
                select: { id: true },
            }),
            prisma.userCourse.findFirst({
                where: { employeeId: opts.userId, courseId: curso.id, status: 'COMPLETED' },
                select: { id: true },
            }),
        ]);
        if (abierto || aprobado) return false;

        await prisma.academyAssignment.create({
            data: {
                headquartersId: opts.hqId,
                userId: opts.userId,
                moduleCode: curso.id,
                // El prefijo importa: `formacion-pendiente.ts` lo lee para
                // decidir plazo y orden. "Ruta de ingreso" le da 14 dias.
                reason: 'Ruta de ingreso — tu primer turno de noche',
                status: 'PENDING',
                assignedBySystem: true,
                assignedByUserId: opts.assignedByUserId ?? null,
            },
        });

        await notifyUser(opts.userId, {
            type: 'COURSE_COMPLETED',
            title: 'Tu primer turno de noche',
            message: 'La tableta cambia sola de modo a las 10:00 PM. El curso "Turno Nocturno del Cuidador" te explica que cambia.',
            link: '/academy',
        });
        return true;
    } catch (err) {
        logError('academy.assign.turno-nocturno', err);
        return false;
    }
}

function etiquetaCategoria(c: string): string {
    const m: Record<string, string> = {
        HYGIENE: 'higiene', PATIENT_CARE: 'cuidado del residente',
        DOCUMENTATION: 'documentación', PUNCTUALITY: 'puntualidad',
        BEHAVIOR: 'comportamiento', UNIFORM: 'uniforme', OTHER: 'otro',
    };
    return m[c] ?? c.toLowerCase();
}
