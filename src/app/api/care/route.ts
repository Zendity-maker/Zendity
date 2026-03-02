import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

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

        return NextResponse.json({ success: true, patients });
    } catch (error) {
        console.error("Care Fetch Error:", error);
        return NextResponse.json({ success: false, error: "Error cargando residentes zonificados" }, { status: 500 });
    }
}
