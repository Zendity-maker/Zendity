import { prisma } from '@/lib/prisma';
import { notifyUser } from '@/lib/notifications';
import { logError } from '@/lib/logger';

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
    CAREGIVER: ['Acceso y Roles en Zendity', 'El Cuidador en Zendity', 'eMAR: Administracion Electronica'],
    NURSE: ['Acceso y Roles en Zendity', 'La Enfermera en Zendity', 'eMAR: Administracion Electronica'],
    SUPERVISOR: ['Acceso y Roles en Zendity', 'El Supervisor en Zendity', 'Handover de Enfermeria'],
    DIRECTOR: ['Acceso y Roles en Zendity', 'El Director en Zendity'],
    ADMIN: ['Acceso y Roles en Zendity', 'El Administrador en Zendity'],
    CLEANING: ['Acceso y Roles en Zendity', 'Limpieza y Sanitizacion'],
    SOCIAL_WORKER: ['Acceso y Roles en Zendity', 'Trabajo Social en Zendity'],
    COORDINATOR: ['Acceso y Roles en Zendity', 'El Administrador en Zendity'],
};

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

function etiquetaCategoria(c: string): string {
    const m: Record<string, string> = {
        HYGIENE: 'higiene', PATIENT_CARE: 'cuidado del residente',
        DOCUMENTATION: 'documentación', PUNCTUALITY: 'puntualidad',
        BEHAVIOR: 'comportamiento', UNIFORM: 'uniforme', OTHER: 'otro',
    };
    return m[c] ?? c.toLowerCase();
}
