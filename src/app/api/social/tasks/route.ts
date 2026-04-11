import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const ALLOWED_ROLES = ['SOCIAL_WORKER', 'DIRECTOR', 'ADMIN', 'SUPERVISOR', 'NURSE'];

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !ALLOWED_ROLES.includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const patientId = searchParams.get('patientId');

        if (!patientId) {
            return NextResponse.json({ success: false, error: 'patientId requerido' }, { status: 400 });
        }

        const tasks = await prisma.socialWorkTask.findMany({
            where: { patientId, headquartersId: (session.user as any).headquartersId },
            include: {
                createdBy: { select: { id: true, name: true } },
                assignedTo: { select: { id: true, name: true } },
            },
            orderBy: [{ status: 'asc' }, { priority: 'desc' }, { createdAt: 'desc' }],
        });

        return NextResponse.json({ success: true, tasks });
    } catch (error) {
        console.error('Social Tasks GET Error:', error);
        return NextResponse.json({ success: false, error: 'Error cargando tareas' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !ALLOWED_ROLES.includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const { patientId, title, description, category, priority, dueDate, assignedToId, isZendiSuggested } = await req.json();

        if (!patientId || !title) {
            return NextResponse.json({ success: false, error: 'patientId y title requeridos' }, { status: 400 });
        }

        const task = await prisma.socialWorkTask.create({
            data: {
                patientId,
                headquartersId: (session.user as any).headquartersId,
                createdById: session.user.id,
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
        console.error('Social Tasks POST Error:', error);
        return NextResponse.json({ success: false, error: 'Error creando tarea' }, { status: 500 });
    }
}

export async function PATCH(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !ALLOWED_ROLES.includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const { taskId, status } = await req.json();

        if (!taskId || !status) {
            return NextResponse.json({ success: false, error: 'taskId y status requeridos' }, { status: 400 });
        }

        const updateData: any = { status };
        if (status === 'COMPLETED') updateData.completedAt = new Date();

        const task = await prisma.socialWorkTask.update({
            where: { id: taskId },
            data: updateData,
            include: {
                createdBy: { select: { id: true, name: true } },
                assignedTo: { select: { id: true, name: true } },
            },
        });

        return NextResponse.json({ success: true, task });
    } catch (error) {
        console.error('Social Tasks PATCH Error:', error);
        return NextResponse.json({ success: false, error: 'Error actualizando tarea' }, { status: 500 });
    }
}
