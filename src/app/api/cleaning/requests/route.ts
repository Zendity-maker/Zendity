import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const ALLOWED_ROLES_READ = ['CLEANING', 'MAINTENANCE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN', 'NURSE'];
const ALLOWED_ROLES_CREATE = ['ADMIN', 'DIRECTOR', 'SUPERVISOR', 'NURSE'];
const ALLOWED_ROLES_UPDATE = ['CLEANING', 'MAINTENANCE'];

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !ALLOWED_ROLES_READ.includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const hqId = searchParams.get('hqId') || (session.user as any).headquartersId;

        if (!hqId) {
            return NextResponse.json({ success: false, error: 'hqId requerido' }, { status: 400 });
        }

        const now = new Date();

        // Auto-expire pending requests past their SLA
        await prisma.cleaningRequest.updateMany({
            where: {
                headquartersId: hqId,
                status: { in: ['PENDING', 'IN_PROGRESS'] },
                expiresAt: { lt: now },
            },
            data: { status: 'EXPIRED' },
        });

        // Fetch active requests
        const requests = await prisma.cleaningRequest.findMany({
            where: {
                headquartersId: hqId,
                status: { in: ['PENDING', 'IN_PROGRESS'] },
            },
            include: {
                requestedBy: { select: { id: true, name: true, role: true } },
                assignedTo: { select: { id: true, name: true } },
                area: { select: { id: true, name: true, category: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        return NextResponse.json({ success: true, requests });
    } catch (error) {
        console.error('Cleaning Requests GET Error:', error);
        return NextResponse.json({ success: false, error: 'Error cargando solicitudes' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !ALLOWED_ROLES_CREATE.includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const { areaName, description, photoUrl, priority, areaId } = await req.json();

        if (!areaName || !description) {
            return NextResponse.json({ success: false, error: 'areaName y description requeridos' }, { status: 400 });
        }

        const expiresAt = new Date(Date.now() + 45 * 60 * 1000); // 45 minutes SLA

        const request = await prisma.cleaningRequest.create({
            data: {
                headquartersId: (session.user as any).headquartersId,
                requestedById: session.user.id,
                areaId: areaId || null,
                areaName,
                description,
                photoUrl: photoUrl || null,
                priority: priority || 'NORMAL',
                expiresAt,
            },
            include: {
                requestedBy: { select: { id: true, name: true, role: true } },
                area: { select: { id: true, name: true, category: true } },
            },
        });

        return NextResponse.json({ success: true, request });
    } catch (error) {
        console.error('Cleaning Requests POST Error:', error);
        return NextResponse.json({ success: false, error: 'Error creando solicitud' }, { status: 500 });
    }
}

export async function PATCH(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !ALLOWED_ROLES_UPDATE.includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const { requestId, status } = await req.json();

        if (!requestId || !status) {
            return NextResponse.json({ success: false, error: 'requestId y status requeridos' }, { status: 400 });
        }

        const existing = await prisma.cleaningRequest.findUnique({ where: { id: requestId } });
        if (!existing) {
            return NextResponse.json({ success: false, error: 'Solicitud no encontrada' }, { status: 404 });
        }

        const updateData: any = { status };

        if (status === 'IN_PROGRESS') {
            updateData.assignedToId = session.user.id;
        }

        if (status === 'COMPLETED') {
            updateData.completedAt = new Date();
            updateData.assignedToId = existing.assignedToId || session.user.id;
        }

        const updated = await prisma.cleaningRequest.update({
            where: { id: requestId },
            data: updateData,
            include: {
                requestedBy: { select: { id: true, name: true, role: true } },
                assignedTo: { select: { id: true, name: true } },
                area: { select: { id: true, name: true, category: true } },
            },
        });

        return NextResponse.json({ success: true, request: updated });
    } catch (error) {
        console.error('Cleaning Requests PATCH Error:', error);
        return NextResponse.json({ success: false, error: 'Error actualizando solicitud' }, { status: 500 });
    }
}
