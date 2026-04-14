import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

// GET — Obtener rondas de inspección del día actual
export async function GET(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const hqId = searchParams.get('hqId') || session.user.headquartersId;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    try {
        const inspections = await prisma.zoneInspection.findMany({
            where: {
                headquartersId: hqId,
                createdAt: { gte: todayStart },
            },
            include: {
                supervisor: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        return NextResponse.json({ success: true, inspections });
    } catch (error: any) {
        console.error('ZoneInspection GET error:', error);
        return NextResponse.json({ success: false, inspections: [] });
    }
}

// POST — Guardar inspección de zona
export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await req.json();
        const {
            headquartersId,
            supervisorId,
            roundType,
            floor,
            zoneName,
            checklistData,
            observations,
        } = body;

        if (!headquartersId || !supervisorId || !roundType || !floor || !zoneName || !checklistData) {
            return NextResponse.json(
                { success: false, error: 'Faltan campos requeridos.' },
                { status: 400 }
            );
        }

        const inspection = await prisma.zoneInspection.create({
            data: {
                headquartersId,
                supervisorId,
                roundType,
                floor,
                zoneName,
                checklistData,
                observations: observations || null,
                completedAt: new Date(),
            },
        });

        return NextResponse.json({ success: true, inspection });
    } catch (error: any) {
        console.error('ZoneInspection POST error:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Error guardando inspección.' },
            { status: 500 }
        );
    }
}
