import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await req.json();

        // Validate required fields
        if (!body.assignedToId || !body.description) {
            return NextResponse.json(
                { success: false, error: 'assignedToId y description son requeridos.' },
                { status: 400 }
            );
        }

        const headquartersId = body.headquartersId || session.user.headquartersId;
        const slaMinutes = body.slaMinutes || 15;

        // Use existing FastActionAssignment model (matches the SLA task workflow)
        const task = await prisma.fastActionAssignment.create({
            data: {
                headquartersId,
                supervisorId: body.assignedById || session.user.id,
                caregiverId: body.assignedToId,
                description: body.description,
                status: 'PENDING',
                expiresAt: new Date(Date.now() + slaMinutes * 60 * 1000),
            },
        });

        return NextResponse.json({ success: true, task });
    } catch (error: any) {
        console.error('Care Tasks POST Error:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Error creando tarea.' },
            { status: 500 }
        );
    }
}
