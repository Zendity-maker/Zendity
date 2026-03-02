import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
    try {
        const patients = await prisma.patient.findMany({
            include: {
                headquarters: true,
                medications: {
                    include: {
                        medication: true
                    }
                }
            },
            orderBy: { name: 'asc' }
        });

        // Agrupar por colores
        const zoning: Record<string, any[]> = {
            RED: [],
            YELLOW: [],
            GREEN: [],
            BLUE: [],
            UNASSIGNED: []
        };

        patients.forEach(p => {
            const color = p.colorGroup || 'UNASSIGNED';
            if (zoning[color]) {
                zoning[color].push(p);
            }
        });

        return NextResponse.json({ success: true, zoning, total: patients.length });
    } catch (error) {
        console.error("Zoning GET Error:", error);
        return NextResponse.json({ success: false, error: "Error de lectura de zonificación" }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const { patientId, newColor } = await req.json();

        if (!patientId || !newColor) {
            return NextResponse.json({ success: false, error: "Faltan parámetros" }, { status: 400 });
        }

        const updatedPatient = await prisma.patient.update({
            where: { id: patientId },
            data: { colorGroup: newColor }
        });

        return NextResponse.json({ success: true, patient: updatedPatient });
    } catch (error) {
        console.error("Zoning PUT Error:", error);
        return NextResponse.json({ success: false, error: "Error reasignando zona" }, { status: 500 });
    }
}
