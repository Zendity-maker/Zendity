import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';



export async function POST(req: Request) {
    try {
        const { patientMedicationId, administeredById, status, notes } = await req.json();

        // Validaciones básicas preventivas
        if (!patientMedicationId || !administeredById) {
            return NextResponse.json({ success: false, error: "Datos incompletos" }, { status: 400 });
        }

        const adminStatus = status || 'ADMINISTERED';

        const admin = await prisma.medicationAdministration.create({
            data: {
                patientMedicationId,
                administeredById,
                status: adminStatus,
                notes
            }
        });

        // FASE 45: Gamification & Trust Score Penalty
        if (adminStatus === 'OMITTED') {
            await prisma.user.update({
                where: { id: administeredById },
                data: {
                    complianceScore: {
                        decrement: 5
                    }
                }
            });
        }

        return NextResponse.json({ success: true, administration: admin });

    } catch (error) {
        console.error("Meds POST Error:", error);
        return NextResponse.json({ success: false, error: "Error registrando medicamento" }, { status: 500 });
    }
}
