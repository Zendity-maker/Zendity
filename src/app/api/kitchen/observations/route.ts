import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await request.json();
        const { headquartersId, supervisorId, satisfactionScore, comments, photoUrl, mealType, feedbackType, portionsAdequate } = body;

        if (!headquartersId || !supervisorId || !satisfactionScore || !comments) {
            return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 });
        }

        const obs = await prisma.kitchenObservation.create({
            data: {
                headquartersId,
                supervisorId,
                satisfactionScore,
                comments,
                photoUrl: photoUrl || null,
                mealType: mealType || 'GENERAL',
                feedbackType: feedbackType || 'NEUTRAL',
                portionsAdequate: portionsAdequate ?? true,
                isRead: false,
            }
        });

        return NextResponse.json({ success: true, observation: obs });
    } catch (error) {
        console.error('Kitchen obs error:', error);
        return NextResponse.json({ error: 'Error al guardar observación' }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

        const updated = await prisma.kitchenObservation.update({
            where: { id },
            data: { isRead: true }
        });

        return NextResponse.json({ success: true, observation: updated });
    } catch (error) {
        console.error('Kitchen obs PATCH error:', error);
        return NextResponse.json({ error: 'Error al marcar como leído' }, { status: 500 });
    }
}
