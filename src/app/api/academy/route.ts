import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { ordenarPendientes, textoDePlazo } from '@/lib/formacion-pendiente';
import { requireRole, requireSession } from '@/lib/api-auth';
import { applyScoreEvent } from '@/lib/score-event';
import { notifyUser, notifyRoles } from '@/lib/notifications';
import { logError, logWarn } from '@/lib/logger';
import { Z_SCORE_VISIBLE } from '@/lib/z-score-visible';

/**
 * QUIEN PUEDE USAR ACADEMY.
 *
 * Faltaban CLEANING, SOCIAL_WORKER y COORDINATOR — y a los tres se les ASIGNA
 * formacion automaticamente (academy-assign.ts:49-51). El resultado era que el
 * sistema les mandaba un curso y, al terminarlo, el POST que registra el
 * aprobado les contestaba 403. Una tarea imposible de completar, que es
 * justo el anti-patron que este proyecto tiene escrito: prometer y no entregar.
 */
const ALLOWED_ROLES = [
    'CAREGIVER', 'NURSE', 'KITCHEN', 'MAINTENANCE', 'CLEANING',
    'SOCIAL_WORKER', 'COORDINATOR', 'SUPERVISOR', 'DIRECTOR', 'ADMIN',
];
const SUPERVISORY_ROLES = ['SUPERVISOR', 'DIRECTOR', 'ADMIN'];

const CompleteBody = z.object({
    employeeId: z.string().min(1, 'employeeId requerido'),
    courseId:   z.string().min(1, 'courseId requerido'),
    hqId:       z.string().min(1, 'hqId requerido'),
    examScore:  z.coerce.number().int().min(0).max(100).optional(),
});

// 1. OBTENER CURSOS DISPONIBLES O HISTORIAL POR EMPLEADO
export async function GET(req: Request) {
    try {
        const auth = await requireSession();
        if (auth instanceof NextResponse) return auth;

        const { searchParams } = new URL(req.url);
        const hqId = searchParams.get('hqId');
        const employeeId = searchParams.get('employeeId');

        if (!hqId) {
            return NextResponse.json({ success: false, error: "Headquarters ID requerido" }, { status: 400 });
        }
        // Tenant: la sede pedida debe ser la del invocador.
        if (hqId !== auth.headquartersId) {
            return NextResponse.json({ success: false, error: "Sede fuera de tu alcance" }, { status: 403 });
        }
        // Identidad: si pide historial de otro empleado, debe ser supervisión.
        if (employeeId && employeeId !== auth.id && !SUPERVISORY_ROLES.includes(auth.role)) {
            return NextResponse.json({ success: false, error: "No puedes consultar historial ajeno" }, { status: 403 });
        }
        if (employeeId) {
            // Historial de un Solo Empleado + su formación asignada.
            // Las asignaciones son lo que convierte la Academia de biblioteca
            // opcional en trabajo concreto: se devuelven aparte para que la UI
            // pueda ponerlas ARRIBA del catálogo.
            const [enrollments, asignaciones] = await Promise.all([
                /**
                 * `include: { course: true }` traia el curso ENTERO por cada
                 * matricula, contenido incluido. Once cursos aprobados eran
                 * ~264 KB de markdown para pintar una lista de titulos y
                 * fechas. De todo el curso, aqui se usa el titulo.
                 */
                prisma.userCourse.findMany({
                    where: { employeeId },
                    include: {
                        course: {
                            select: {
                                id: true, title: true, category: true,
                                emoji: true, durationMins: true, bonusCompliance: true,
                            },
                        },
                    },
                }),
                prisma.academyAssignment.findMany({
                    where: { userId: employeeId, status: { in: ['PENDING', 'IN_PROGRESS'] } },
                    orderBy: { createdAt: 'asc' },
                }),
            ]);

            // moduleCode guarda el id del curso; se resuelve el título para que
            // la UI no tenga que cruzar dos listas.
            const cursoIds = asignaciones.map(a => a.moduleCode);
            const cursos = cursoIds.length > 0
                ? await prisma.course.findMany({
                    where: { id: { in: cursoIds } },
                    select: { id: true, title: true, durationMins: true, emoji: true, category: true },
                })
                : [];
            const porId = new Map(cursos.map(c => [c.id, c]));

            /**
             * ORDENADAS, NO COMO SALGAN.
             *
             * Antes iban por fecha de creación, y como la certificación entera
             * se asigna de una vez, la persona abría Academy y veía trece
             * tarjetas ámbar idénticas. Trece tareas son cero tareas.
             *
             * `ordenarPendientes` pone delante lo que sale de un incidente, lo
             * vencido antes que lo que aún tiene plazo, y dentro de la
             * certificación respeta el orden de la ruta —el general primero,
             * emergencias al final— que estaba declarado y no leía nadie.
             * Marca además la primera como `siguiente`: es la respuesta a "¿por
             * dónde empiezo?".
             */
            const assignments = ordenarPendientes(
                asignaciones
                    .map(a => {
                        const c = porId.get(a.moduleCode);
                        if (!c) return null; // curso borrado — la asignación no se muestra
                        return {
                            id: a.id,
                            courseId: c.id,
                            title: c.title,
                            durationMins: c.durationMins,
                            emoji: c.emoji,
                            category: c.category,
                            reason: a.reason,
                            assignedAt: a.createdAt,
                            status: a.status,
                        };
                    })
                    .filter((a): a is NonNullable<typeof a> => a !== null),
            ).map(a => ({
                ...a,
                // El plazo se manda ya resuelto: la pantalla no tiene por qué
                // saber que un incidente da siete días y un ingreso catorce.
                vence: a.plazo.vence,
                vencida: a.plazo.vencida,
                textoPlazo: textoDePlazo(a.plazo),
                grupo: a.plazo.grupo,
                diasEsperando: a.plazo.diasEsperando,
            }));

            return NextResponse.json({ success: true, enrollments, assignments });

        } else {
            // El rol se toma de la SESIÓN, no del query param: el cliente
            // mandaba `?role=` y cualquiera podía pedir el catálogo de otro rol.
            // Se incluyen los roles secundarios — hay supervisoras que también
            // son cuidadoras y directores que también son enfermeras; filtrar
            // solo por el primario les escondería la formación de su segundo rol.
            const roles = [auth.role, ...(auth.secondaryRoles ?? [])].filter(Boolean);

            // Los cursos ASIGNADOS se ven siempre, coincida o no el rol. Sin
            // esto, un incidente de higiene a una cuidadora le asignaría el
            // curso de Limpieza (dirigido a CLEANING) y ella no podría abrirlo:
            // una tarea imposible de completar.
            const asignados = await prisma.academyAssignment.findMany({
                where: { userId: auth.id, status: { in: ['PENDING', 'IN_PROGRESS'] } },
                select: { moduleCode: true },
            });
            const idsAsignados = asignados.map(a => a.moduleCode);

            /**
             * EL CATALOGO NO LLEVA EL TEXTO DE LOS CURSOS.
             *
             * Iba sin `select`, asi que devolvia el `content` entero de cada
             * curso. Medido el 11-sep-2026 contra produccion: **431 KB** para
             * una cuidadora que abre Academy en la tableta, de los cuales 420
             * son el markdown de veinte cursos que no va a abrir. Con este
             * select, la misma pantalla son 11 KB.
             *
             * El texto se pide al pulsar "Comenzar", en
             * /api/academy/curso/[id], y son 24 KB de uno solo.
             */
            const catalog = await prisma.course.findMany({
                where: {
                    isActive: true,
                    headquartersId: hqId,
                    OR: [
                        { isGlobal: true, targetRole: null },
                        { targetRole: { in: roles } },
                        ...(idsAsignados.length > 0 ? [{ id: { in: idsAsignados } }] : []),
                    ]
                },
                select: {
                    id: true, title: true, description: true, category: true,
                    durationMins: true, bonusCompliance: true, emoji: true,
                    imageUrl: true, order: true, targetRole: true,
                },
                orderBy: [{ order: 'asc' }, { createdAt: 'asc' }]
            });
            return NextResponse.json({ success: true, catalog });
        }

    } catch (error) {
        logError('academy.get', error);
        return NextResponse.json({ success: false, error: "Fallo leyendo el catálogo formativo" }, { status: 500 });
    }
}

// 2. CERTIFICAR COMPLETACIÓN DE CURSO Y AUMENTAR SCORE DEL USUARIO
//
// Comportamiento (post-fix):
//   - Idempotente: si el curso ya está COMPLETED para el empleado, devuelve
//     éxito sin re-otorgar puntos ni re-notificar (evita doble-click bug).
//   - Delta real en la notificación: usa scoreAfter - scoreBefore (no el
//     `bonusCompliance` declarado del curso) para no mentir cuando el score
//     ya está en el cap de 100.
//   - Auto-desbloqueo: si el empleado tenía isShiftBlocked=true (bloqueado
//     por RRHH), completar un curso lo desbloquea automáticamente.
//   - Notificación al supervisor con link='/academy' para abrir el catálogo
//     en lugar de caer al fallback de SHIFT_ALERT.
export async function POST(req: Request) {
    try {
        // Auth obligatoria + rol clínico/operativo (antes este endpoint era público).
        // requireRole soporta primary OR secondary roles vía /lib/api-auth.
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;

        const rawBody = await req.json().catch(() => null);
        const parsed = CompleteBody.safeParse(rawBody);
        if (!parsed.success) {
            const first = parsed.error.issues[0];
            const path = first?.path?.join('.') || 'body';
            return NextResponse.json({
                success: false,
                error: `Datos inválidos en ${path}: ${first?.message || 'formato incorrecto'}`,
            }, { status: 400 });
        }
        const { employeeId, courseId, hqId, examScore } = parsed.data;

        // Tenant: la sede del body debe ser la del invocador.
        if (hqId !== auth.headquartersId) {
            return NextResponse.json({ success: false, error: "Sede fuera de tu alcance" }, { status: 403 });
        }
        // Identidad: solo puedes certificar TU propio curso, salvo que seas supervisión.
        if (employeeId !== auth.id && !SUPERVISORY_ROLES.includes(auth.role)) {
            return NextResponse.json({
                success: false,
                error: "Solo supervisión puede certificar cursos a otros empleados",
            }, { status: 403 });
        }

        const course = await prisma.course.findUnique({ where: { id: courseId } });
        if (!course) {
            return NextResponse.json({ success: false, error: "Curso no encontrado" }, { status: 404 });
        }

        // Idempotencia: si ya está COMPLETED, no re-aplicar nada.
        const existing = await prisma.userCourse.findUnique({
            where: { employeeId_courseId: { employeeId, courseId } },
            select: { id: true, status: true },
        });
        if (existing?.status === 'COMPLETED') {
            return NextResponse.json({
                success: true,
                alreadyCompleted: true,
                message: 'Este curso ya estaba completado.',
            });
        }

        const bonus = course.bonusCompliance;

        // 1. Marcar completado (upsert por si no existía enrollment previo)
        const enrollment = await prisma.userCourse.upsert({
            where: { employeeId_courseId: { employeeId, courseId } },
            update: { status: 'COMPLETED', score: examScore ?? 100, completedAt: new Date() },
            create: { employeeId, courseId, headquartersId: hqId, status: 'COMPLETED', score: examScore ?? 100, completedAt: new Date() },
        });

        // Cerrar la asignación que motivó este curso, si la hubo. Sin esto, el
        // empleado completa la formación y la sigue viendo como pendiente —
        // que es la forma más rápida de enseñarle a ignorar las asignaciones.
        await prisma.academyAssignment.updateMany({
            where: { userId: employeeId, moduleCode: courseId, status: { in: ['PENDING', 'IN_PROGRESS'] } },
            data: { status: 'COMPLETED', completedAt: new Date() },
        });

        // 2. Sumar puntos al Z-Score (clamp [0,100] interno)
        const employee = await prisma.user.findUnique({
            where: { id: employeeId },
            select: { name: true, headquartersId: true, isShiftBlocked: true },
        });
        const scoreEvt = await applyScoreEvent(
            employeeId, hqId, bonus,
            `Curso completado: ${course.title || course.id}`,
            'ACADEMY',
        );
        // Delta REAL aplicado (puede ser menor que bonus si el score llegó al cap).
        const realDelta = scoreEvt ? scoreEvt.scoreAfter - scoreEvt.scoreBefore : 0;

        // 3. Auto-desbloqueo si el empleado estaba bloqueado por RRHH.
        let unblocked = false;
        if (employee?.isShiftBlocked) {
            await prisma.user.update({
                where: { id: employeeId },
                data: { isShiftBlocked: false, blockReason: null },
            });
            unblocked = true;
        }

        /**
         * 4. Notificación al empleado. SIN HABLAR DEL SCORE.
         *
         * Decía "Tu Z-Score subió +N" o, si no subía, "Ya estás en el máximo de
         * Z-Score (100)". Dos problemas:
         *
         *   - `realDelta` es 0 desde que applyScoreEvent dejó de escribir el
         *     campo (10-sep-2026), así que TODO el mundo recibía el mensaje del
         *     máximo. Ya era matemáticamente cero desde el 01-sep por el tope.
         *   - Y el score está oculto: decírselo por notificación es la octava
         *     fuga del mismo número.
         *
         * El curso completado ya es la buena noticia. No hace falta un número
         * detrás, y menos uno que no es verdad.
         */
        const scoreMessage = '¡Bien hecho!';
        const unblockMessage = unblocked
            ? ' Además, tu acceso a turnos fue restablecido.'
            : '';
        await notifyUser(employeeId, {
            type: 'COURSE_COMPLETED',
            title: '🎉 ¡Curso completado!',
            message: `Completaste "${course.title || 'el curso'}". ${scoreMessage}${unblockMessage}`,
            link: '/academy',
        });

        // 5. Notificación al equipo supervisor (best-effort) con link al catálogo.
        try {
            await notifyRoles(hqId, ['SUPERVISOR', 'DIRECTOR', 'ADMIN'], {
                type: 'COURSE_COMPLETED',
                title: '🎓 Logro del equipo',
                message: `${employee?.name || 'Un empleado'} completó el curso "${course.title || course.id}" en Academy.`,
                link: '/academy',
            });
        } catch (e) {
            logWarn('academy.post.notify_supervision', e, { employeeId, courseId });
        }

        return NextResponse.json({
            success: true,
            enrollment,
            // El score sale de la respuesta: esta ruta la llama la pantalla de
            // Academy, que es del propio empleado. Ver src/lib/z-score-visible.ts.
            newComplianceScore: Z_SCORE_VISIBLE ? (scoreEvt?.scoreAfter ?? null) : null,
            delta: Z_SCORE_VISIBLE ? realDelta : null,
            unblocked,
        });

    } catch (error) {
        logError('academy.post', error);
        return NextResponse.json({ success: false, error: "Fallo emitiendo Certificación Zendity" }, { status: 500 });
    }
}
