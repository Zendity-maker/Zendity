import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';

// HIPAA — zonificación de residentes: personal clínico + scoping por sede.
const ALLOWED_ROLES = ['CAREGIVER', 'NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN'];

export async function GET() {
    try {
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;

        const patients = await prisma.patient.findMany({
            where: {
                status: { notIn: ['DISCHARGED', 'DECEASED'] },
                headquartersId: auth.headquartersId
            },
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
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;

        const { patientId, newColor } = await req.json();

        if (!patientId || !newColor) {
            return NextResponse.json({ success: false, error: "Faltan parámetros" }, { status: 400 });
        }

        // Tenant check HIPAA — no reasignar residentes de otra sede
        const owner = await prisma.patient.findUnique({ where: { id: patientId }, select: { headquartersId: true } });
        if (!owner || owner.headquartersId !== auth.headquartersId) {
            return NextResponse.json({ success: false, error: "Residente fuera de tu sede" }, { status: 403 });
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
