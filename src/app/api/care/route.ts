import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { startOfDay, endOfDay } from 'date-fns';

const prisma = new PrismaClient();

// GET: Obtiene residentes filtrados por el Color seleccionado en el turno
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const color = searchParams.get('color') || 'UNASSIGNED';
        const hqId = searchParams.get('hqId');

        if (!hqId) {
            return NextResponse.json({ success: false, error: "Headquarters ID requerido" }, { status: 400 });
        }

        const patients = await prisma.patient.findMany({
            where: { colorGroup: color as any, headquartersId: hqId },
            include: {
                medications: { include: { medication: true } },
                lifePlan: true
            },
            orderBy: { name: 'asc' }
        });

        const todayStart = startOfDay(new Date());
        const todayEnd = endOfDay(new Date());

        const events = await prisma.headquartersEvent.findMany({
            where: {
                headquartersId: hqId,
                startTime: { gte: todayStart, lte: todayEnd }
            },
            include: {
                patient: { select: { id: true, name: true } }
            },
            orderBy: { startTime: 'asc' }
        });

        return NextResponse.json({ success: true, patients, events });
    } catch (error) {
        console.error("Care Fetch Error:", error);
        return NextResponse.json({ success: false, error: "Error cargando residentes zonificados" }, { status: 500 });
    }
}
