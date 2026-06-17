import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { withPhiAccessLog } from '@/lib/phi-audit';
import { logError } from '@/lib/logger';

// SW_ALLOWED = roles del módulo TS (lectura+escritura completa).
// COORDINATOR_ALLOWED = COORDINATOR puede crear tareas (referir) y ver SUS
// propios referidos, pero NO leer las del resto del equipo TS (evals/notas
// psicosociales fuera de su need-to-know).
// Sprint Coordinador (jun-2026).
const SW_ALLOWED = ['SOCIAL_WORKER', 'DIRECTOR', 'ADMIN'];
const SW_OR_COORDINATOR = ['SOCIAL_WORKER', 'DIRECTOR', 'ADMIN', 'COORDINATOR'];

/** ¿El actor es COORDINATOR-puro (sin DIR/ADMIN/SW que le dé visibilidad completa)? */
function isCoordinatorOnly(user: { role: string; secondaryRoles?: string[] }): boolean {
    const fullView = ['SOCIAL_WORKER', 'DIRECTOR', 'ADMIN'];
    const all = [user.role, ...(user.secondaryRoles ?? [])];
    return all.includes('COORDINATOR') && !all.some(r => fullView.includes(r));
}

async function getHandler(req: Request) {
    try {
        const auth = await requireRole(SW_OR_COORDINATOR);
        if (auth instanceof NextResponse) return auth;

        const { searchParams } = new URL(req.url);
        const patientId = searchParams.get('patientId');
        if (!patientId) {
            return NextResponse.json({ success: false, error: 'patientId requerido' }, { status: 400 });
        }

        // Coordinador-puro: filtra a SUS propios referidos.
        // DIR/ADMIN/SW: ve todas las tareas del paciente.
        const where: any = { patientId, headquartersId: auth.headquartersId };
        if (isCoordinatorOnly(auth)) where.createdById = auth.id;

        const tasks = await prisma.socialWorkTask.findMany({
            where,
            include: {
                createdBy: { select: { id: true, name: true } },
                assignedTo: { select: { id: true, name: true } },
            },
            orderBy: [{ status: 'asc' }, { priority: 'desc' }, { createdAt: 'desc' }],
        });

        return NextResponse.json({ success: true, tasks });
    } catch (error) {
        logError('social.tasks.get', error);
        return NextResponse.json({ success: false, error: 'Error cargando tareas' }, { status: 500 });
    }
}

async function postHandler(req: Request) {
    try {
        // COORDINATOR puede crear (referir). PATCH (cerrar tarea) NO — eso
        // queda en SW/DIR/ADMIN.
        const auth = await requireRole(SW_OR_COORDINATOR);
        if (auth instanceof NextResponse) return auth;

        const { patientId, title, description, category, priority, dueDate, assignedToId, isZendiSuggested } = await req.json();
        if (!patientId || !title) {
            return NextResponse.json({ success: false, error: 'patientId y title requeridos' }, { status: 400 });
        }

        // Tenant-scope: el patient DEBE pertenecer a la HQ del invoker.
        const patient = await prisma.patient.findFirst({
            where: { id: patientId, headquartersId: auth.headquartersId },
            select: { id: true },
        });
        if (!patient) {
            return NextResponse.json({ success: false, error: 'Residente no encontrado' }, { status: 404 });
        }

        // Tenant-scope: si assignedToId viene, debe ser un User de la misma HQ.
        if (assignedToId) {
            const assignee = await prisma.user.findFirst({
                where: { id: assignedToId, headquartersId: auth.headquartersId, isDeleted: false },
                select: { id: true },
            });
            if (!assignee) {
                return NextResponse.json({ success: false, error: 'Usuario asignado no encontrado en esta sede' }, { status: 400 });
            }
        }

        const task = await prisma.socialWorkTask.create({
            data: {
                patientId,
                headquartersId: auth.headquartersId,
                createdById: auth.id,
                assignedToId: assignedToId || null,
                title,
                description: description || null,
                category: category || 'FOLLOW_UP',
                priority: priority || 'NORMAL',
                dueDate: dueDate ? new Date(dueDate) : null,
                isZendiSuggested: isZendiSuggested || false,
            },
            include: {
                createdBy: { select: { id: true, name: true } },
                assignedTo: { select: { id: true, name: true } },
            },
        });

        return NextResponse.json({ success: true, task });
    } catch (error) {
        logError('social.tasks.post', error);
        return NextResponse.json({ success: false, error: 'Error creando tarea' }, { status: 500 });
    }
}

async function patchHandler(req: Request) {
    try {
        const auth = await requireRole(SW_ALLOWED);
        if (auth instanceof NextResponse) return auth;

        const { taskId, status } = await req.json();
        if (!taskId || !status) {
            return NextResponse.json({ success: false, error: 'taskId y status requeridos' }, { status: 400 });
        }

        // Tenant-scope: validar que la task pertenezca a la HQ del invoker
        // ANTES de actualizar. Cierra el vector cross-tenant PATCH.
        const task = await prisma.socialWorkTask.findFirst({
            where: { id: taskId, headquartersId: auth.headquartersId },
            select: { id: true },
        });
        if (!task) {
            return NextResponse.json({ success: false, error: 'Tarea no encontrada' }, { status: 404 });
        }

        const updateData: any = { status };
        if (status === 'COMPLETED') updateData.completedAt = new Date();

        const updated = await prisma.socialWorkTask.update({
            where: { id: taskId },
            data: updateData,
            include: {
                createdBy: { select: { id: true, name: true } },
                assignedTo: { select: { id: true, name: true } },
            },
        });

        return NextResponse.json({ success: true, task: updated });
    } catch (error) {
        logError('social.tasks.patch', error);
        return NextResponse.json({ success: false, error: 'Error actualizando tarea' }, { status: 500 });
    }
}

// PHI audit (HIPAA Pilar 1). El wrapper captura actor + IP + UA + path +
// success. getPatientId del query string para GET; null en POST/PATCH
// (vienen en body) — forensic join via resourceType + timestamp + userId.
export const GET = withPhiAccessLog(getHandler, {
    resourceType: 'SocialWorkTask',
    getPatientId: ({ req }) => new URL(req.url).searchParams.get('patientId') ?? undefined,
});
export const POST = withPhiAccessLog(postHandler, { resourceType: 'SocialWorkTask' });
export const PATCH = withPhiAccessLog(patchHandler, { resourceType: 'SocialWorkTask' });
