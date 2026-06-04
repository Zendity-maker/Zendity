import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';

const ALLOWED_ROLES = ['CAREGIVER', 'NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN'];

export async function POST(req: Request) {
    try {
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;

        const body = await req.json();
        const { colorGroup } = body;
        // HIPAA — firmante y sede salen de la sesión (antes hqId/authorId del body).
        const authorId = auth.id;
        const hqId = auth.headquartersId;

        if (!colorGroup) {
            return NextResponse.json({ success: false, error: "Datos insuficientes (Color)" }, { status: 400 });
        }

        // Buscar todos los residentes de este grupo
        const patients = await prisma.patient.findMany({
            where: { colorGroup, headquartersId: hqId },
            include: { medications: true }
        });

        const numMeds = patients.reduce((acc, p) => acc + p.medications.length, 0);

        if (numMeds === 0) {
            return NextResponse.json({ success: false, error: "No hay medicamentos pendientes para firmar en este grupo." }, { status: 400 });
        }

        // Crear logs de auditoría por residente
        for (const p of patients) {
            if (p.medications.length > 0) {
                for (const med of p.medications) {
                    await prisma.medicationAuditLog.create({
                        data: {
                            patientMedicationId: med.id,
                            authorId: authorId,
                            action: 'VERIFIED_BY_NURSE',
                            reason: 'Validación de Carrito por Grupo',
                        }
                    });
                }
            }
        }

        return NextResponse.json({ success: true, message: `Carrito ${colorGroup} validado (Doble Chequeo) para ${numMeds} dosis.` });

    } catch (error) {
        console.error("Cart Sign Error:", error);
        return NextResponse.json({ success: false, error: "Fallo al firmar el carrito." }, { status: 500 });
    }
}
