import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';



export async function GET(req: Request) {
    try {
        const medications = await prisma.medication.findMany({
            orderBy: { name: 'asc' }
        });

        // FASE 9: Deduplicación Estricta por Nombre para el Catálogo Visual
        const uniqueMedsMap = new Map();
        medications.forEach(med => {
            const key = med.name.toUpperCase().trim();
            if (!uniqueMedsMap.has(key)) {
                uniqueMedsMap.set(key, med);
            }
        });

        const uniqueMeds = Array.from(uniqueMedsMap.values());

        return NextResponse.json({ success: true, medications: uniqueMeds });
    } catch (error) {
        console.error("Fetch Meds Error:", error);
        return NextResponse.json({ success: false, error: "Failed to fetch medications" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const { action, patientId, medicationId, scheduleTimes, prepDuration, authorId, reason, patientMedicationId } = await req.json();

        let updatedMed;

        if (action === 'ADDED') {
            updatedMed = await prisma.patientMedication.create({
                data: { patientId, medicationId, scheduleTimes, prepDuration: prepDuration || "1_SEMANA" }
            });
            await prisma.medicationAuditLog.create({
                data: { action: 'ADDED', patientMedicationId: updatedMed.id, authorId, reason }
            });
        }
        else if (action === 'MODIFIED') {
            updatedMed = await prisma.patientMedication.update({
                where: { id: patientMedicationId },
                data: { scheduleTimes, prepDuration: prepDuration || "1_SEMANA" }
            });
            await prisma.medicationAuditLog.create({
                data: { action: 'MODIFIED', patientMedicationId: updatedMed.id, authorId, reason }
            });
        }
        else if (action === 'DISCONTINUED') {
            updatedMed = await prisma.patientMedication.update({
                where: { id: patientMedicationId },
                data: { isActive: false, scheduleTimes: "DESCONTINUADO" }
            });
            await prisma.medicationAuditLog.create({
                // Mantener record auditando el ID
                data: { action: 'DISCONTINUED', patientMedicationId: patientMedicationId, authorId, reason }
            });
        }

        return NextResponse.json({ success: true, record: updatedMed });
    } catch (error) {
        console.error("MED CRUD Error:", error);
        return NextResponse.json({ success: false, error: "Fallo en Auditoría de Medicamentos" }, { status: 500 });
    }
}
