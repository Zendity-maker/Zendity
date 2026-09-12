import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { notifyUser } from '@/lib/notifications';
import { logError } from '@/lib/logger';
import { ordenarPendientes, textoDePlazo, estadoDePlazo } from '@/lib/formacion-pendiente';

/**
 * ASIGNAR UN CURSO A MANO.
 *
 * Medido el 12-sep-2026 en las dos sedes: de **204 asignaciones, CERO** tenían
 * `assignedBySystem: false`. El campo existía en el schema desde siempre y
 * `assignedByUserId` se rellenaba con quién disparó la regla — pero no había
 * ninguna pantalla ni ningún endpoint para que una persona dijera "quiero que
 * hagas este curso".
 *
 * Toda la formación la decidían tres reglas automáticas: el alta de un
 * empleado, el alta de alguien que toca residentes, y una observación de RRHH
 * emitida. Buenas reglas, pero cubren lo que se puede adivinar. Lo que Celia ve
 * en el piso —"a esta hay que explicarle el relevo otra vez"— no lo adivina
 * ninguna regla, y hasta hoy no tenía dónde ponerlo.
 *
 * Es además la vía que nunca se equivoca de destinatario: la elige alguien que
 * sabe por qué.
 */

/** Quién puede asignar formación a otra persona. */
const PUEDEN_ASIGNAR = ['DIRECTOR', 'ADMIN', 'SUPERVISOR'];

/**
 * GET ?userId=… — lo que esa persona tiene pendiente y lo que se le puede asignar.
 *
 * Devuelve las dos listas juntas a propósito: quien va a asignar necesita ver
 * antes lo que ya tiene abierto. Trece cursos pendientes y uno más no es
 * ayudar.
 */
export async function GET(req: Request) {
    try {
        const auth = await requireRole(PUEDEN_ASIGNAR);
        if (auth instanceof NextResponse) return auth;
        const hqId = auth.headquartersId;

        const userId = new URL(req.url).searchParams.get('userId');
        if (!userId) {
            return NextResponse.json({ success: false, error: 'Falta userId.' }, { status: 400 });
        }

        // El empleado tiene que ser de TU sede. El hqId sale de la sesión.
        const empleado = await prisma.user.findFirst({
            where: { id: userId, headquartersId: hqId },
            select: { id: true, name: true, role: true },
        });
        if (!empleado) {
            return NextResponse.json({ success: false, error: 'Empleado no encontrado en tu sede.' }, { status: 404 });
        }

        const [asignaciones, cursos, aprobados] = await Promise.all([
            prisma.academyAssignment.findMany({
                where: { userId, status: { in: ['PENDING', 'IN_PROGRESS'] } },
                select: { id: true, moduleCode: true, reason: true, createdAt: true, assignedBySystem: true },
            }),
            prisma.course.findMany({
                where: { headquartersId: hqId, isActive: true },
                select: { id: true, title: true, durationMins: true, category: true, bonusCompliance: true },
                orderBy: { title: 'asc' },
            }),
            prisma.userCourse.findMany({
                where: { employeeId: userId, status: 'COMPLETED' },
                select: { courseId: true },
            }),
        ]);

        const porId = new Map(cursos.map(c => [c.id, c]));
        const yaAprobados = new Set(aprobados.map(a => a.courseId));

        const pendientes = ordenarPendientes(
            asignaciones
                .map(a => {
                    const c = porId.get(a.moduleCode);
                    if (!c) return null;
                    return {
                        id: a.id, courseId: c.id, title: c.title,
                        durationMins: c.durationMins, reason: a.reason,
                        assignedAt: a.createdAt, aMano: !a.assignedBySystem,
                    };
                })
                .filter((a): a is NonNullable<typeof a> => a !== null),
        ).map(a => ({ ...a, textoPlazo: textoDePlazo(a.plazo), vencida: a.plazo.vencida }));

        const yaAsignados = new Set(asignaciones.map(a => a.moduleCode));

        return NextResponse.json({
            success: true,
            empleado,
            pendientes,
            // El catálogo marca lo que ya está asignado o aprobado en vez de
            // esconderlo: asignar un refuerzo tras un incidente es legítimo, y
            // quien asigna tiene que poder verlo para decidir.
            catalogo: cursos.map(c => ({
                ...c,
                yaAsignado: yaAsignados.has(c.id),
                yaAprobado: yaAprobados.has(c.id),
            })),
        });
    } catch (error) {
        logError('hr.academy.asignar.get', error);
        return NextResponse.json({ success: false, error: 'Error cargando la formación.' }, { status: 500 });
    }
}

/** POST { userId, courseId, motivo } — crea la asignación. */
export async function POST(req: Request) {
    try {
        const auth = await requireRole(PUEDEN_ASIGNAR);
        if (auth instanceof NextResponse) return auth;
        const hqId = auth.headquartersId;

        const { userId, courseId, motivo } = await req.json();
        if (!userId || !courseId) {
            return NextResponse.json({ success: false, error: 'Faltan userId y courseId.' }, { status: 400 });
        }

        const razon = typeof motivo === 'string' ? motivo.trim().slice(0, 140) : '';
        if (razon.length < 5) {
            return NextResponse.json({
                success: false,
                error: 'Escribe por qué le asignas este curso. Es lo que va a leer la persona.',
            }, { status: 400 });
        }

        // Las dos comprobaciones de sede. Ninguna confía en el body.
        const [empleado, curso] = await Promise.all([
            prisma.user.findFirst({
                where: { id: userId, headquartersId: hqId, isActive: true, isDeleted: false },
                select: { id: true, name: true },
            }),
            prisma.course.findFirst({
                where: { id: courseId, headquartersId: hqId, isActive: true },
                select: { id: true, title: true },
            }),
        ]);
        if (!empleado) {
            return NextResponse.json({ success: false, error: 'Empleado no encontrado en tu sede.' }, { status: 404 });
        }
        if (!curso) {
            return NextResponse.json({ success: false, error: 'Curso no encontrado o desactivado.' }, { status: 404 });
        }

        /**
         * Guarda contra doble envío — anti-patrón 8.
         *
         * Si ya tiene ese curso abierto, se devuelve ÉXITO con la que existe,
         * no un error. Quien pulsó hizo lo correcto; un rojo le hace intentarlo
         * otra vez, que es justo lo que produce el duplicado.
         */
        const existente = await prisma.academyAssignment.findFirst({
            where: { userId, moduleCode: courseId, status: { in: ['PENDING', 'IN_PROGRESS'] } },
            select: { id: true, reason: true, createdAt: true },
        });
        if (existente) {
            return NextResponse.json({
                success: true,
                yaLoTenia: true,
                mensaje: `${empleado.name} ya tiene "${curso.title}" pendiente — se asignó como "${existente.reason}".`,
            });
        }

        const asignacion = await prisma.academyAssignment.create({
            data: {
                headquartersId: hqId,
                userId,
                moduleCode: courseId,
                // El prefijo "Asignado por" es lo que `formacion-pendiente.ts`
                // busca para darle catorce días de plazo y ponerlo por delante
                // de lo automático. No cambiarlo sin cambiar el patrón allí.
                reason: `Asignado por ${auth.name ?? 'tu supervisión'}: ${razon}`,
                status: 'PENDING',
                assignedBySystem: false,
                assignedByUserId: auth.id,
            },
            select: { id: true, createdAt: true, reason: true },
        });

        const plazo = estadoDePlazo(asignacion.reason, asignacion.createdAt);
        await notifyUser(userId, {
            type: 'COURSE_COMPLETED',
            title: 'Formación asignada',
            message: `"${curso.title}" — ${razon}${plazo.vence ? `. ${textoDePlazo(plazo).toLowerCase()}.` : '.'}`,
            link: '/academy',
        });

        return NextResponse.json({
            success: true,
            yaLoTenia: false,
            mensaje: `"${curso.title}" asignado a ${empleado.name}. Le llega un aviso ahora.`,
        });
    } catch (error) {
        logError('hr.academy.asignar.post', error);
        return NextResponse.json({ success: false, error: 'Error asignando el curso.' }, { status: 500 });
    }
}
