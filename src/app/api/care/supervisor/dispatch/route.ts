import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { notifyUser } from '@/lib/notifications';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ALLOWED_ROLES = ['SUPERVISOR', 'DIRECTOR', 'ADMIN'];

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }
        if (!ALLOWED_ROLES.includes((session.user as any).role)) {
            return NextResponse.json({ error: "Rol no autorizado" }, { status: 403 });
        }
        const invokerId = (session.user as any).id;
        const invokerHqId = (session.user as any).headquartersId;

        const body = await req.json();
        const { headquartersId, caregiverId, description, sourceType, sourceId, expirationMins } = body;

        if (!caregiverId || !description) {
            return NextResponse.json({ error: "Missing required fields for dispatch" }, { status: 400 });
        }
        // hqId siempre desde sesión. Si viene del body debe coincidir.
        if (headquartersId && headquartersId !== invokerHqId) {
            return NextResponse.json({ error: "Sede fuera de tu alcance" }, { status: 403 });
        }
        const hqId = invokerHqId;

        // Tenant check del cuidador receptor
        const caregiverCheck = await prisma.user.findUnique({
            where: { id: caregiverId },
            select: { headquartersId: true },
        });
        if (!caregiverCheck || caregiverCheck.headquartersId !== hqId) {
            return NextResponse.json({ error: "Cuidador fuera de tu sede" }, { status: 403 });
        }

        // FIX 1 — Ventana de 60 min (antes 15 min). Reduce tasa de auto-fallo.
        const expiresAt = new Date(Date.now() + (expirationMins || 60) * 60000);

        // 1. Create the FastActionAssignment. supervisorId SIEMPRE session.user.id
        // (antes venía del body — permitía falsificar el supervisor).
        const assignment = await prisma.fastActionAssignment.create({
            data: {
                headquartersId: hqId,
                supervisorId: invokerId,
                caregiverId,
                description,
                expiresAt,
                status: 'PENDING'
            }
        });

        // FIX 4 — Notificar al cuidador en el momento del despacho
        await notifyUser(caregiverId, {
            type: 'SHIFT_ALERT',
            title: '⚡ Nueva tarea asignada',
            message: `${description} — Tienes 1 hora para completarla.`,
        });

        // 2. Mark the source as handled if possible — con tenant check
        if (sourceType === 'COMPLAINT' && sourceId) {
            const c = await prisma.complaint.findUnique({
                where: { id: sourceId },
                select: { headquartersId: true },
            });
            if (c && c.headquartersId === hqId) {
                await prisma.complaint.update({
                    where: { id: sourceId },
                    data: { status: 'ROUTED_NURSING' }
                });
            }
        }

        // ZENDI GROUP handling: if sourceId is an array of IDs
        if (sourceType === 'ZENDI_GROUP' && Array.isArray(sourceId)) {
            const cleanIds = sourceId
                .filter(id => typeof id === 'string' && id.startsWith('cmp_'))
                .map(id => id.replace('cmp_', ''));

            if (cleanIds.length > 0) {
                await prisma.complaint.updateMany({
                    where: { id: { in: cleanIds }, headquartersId: hqId },
                    data: { status: 'RESOLVED' }
                });
            }
        }

        return NextResponse.json({ success: true, assignment });
    } catch (error: unknown) {
        console.error("Error creating fast action assignment:", error);
        return NextResponse.json({ error: (error as Error).message || "Internal server error" }, { status: 500 });
    }
}
