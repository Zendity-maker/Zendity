import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(req: Request) {
    try {
        const { action, patientId, medicationId, scheduleTime, authorId, reason, patientMedicationId } = await req.json();

        let updatedMed;

        if (action === 'ADDED') {
            updatedMed = await prisma.patientMedication.create({
                data: { patientId, medicationId, scheduleTime }
            });
            await prisma.medicationAuditLog.create({
                data: { action: 'ADDED', patientMedicationId: updatedMed.id, authorId, reason }
            });
        }
        else if (action === 'MODIFIED') {
            updatedMed = await prisma.patientMedication.update({
                where: { id: patientMedicationId },
                data: { scheduleTime }
            });
            await prisma.medicationAuditLog.create({
                data: { action: 'MODIFIED', patientMedicationId: updatedMed.id, authorId, reason }
            });
        }
        else if (action === 'DISCONTINUED') {
            updatedMed = await prisma.patientMedication.update({
                where: { id: patientMedicationId },
                data: { alertsEnabled: false, scheduleTime: "DESCONTINUADO" }
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
