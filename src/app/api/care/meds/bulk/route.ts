import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import {  MedStatus } from '@prisma/client';



export async function POST(req: Request) {
    try {
        const { action, medicationIds, administeredById, notes, signatureBase64 } = await req.json();

        // action can be 'ADMINISTER_ALL', 'PRN', 'OMISSION'
        if (!action || !medicationIds || !Array.isArray(medicationIds) || medicationIds.length === 0 || !administeredById) {
            return NextResponse.json({ success: false, error: "Datos incompletos para la acción masiva" }, { status: 400 });
        }

        let adminStatus: MedStatus = 'ADMINISTERED';
        if (action === 'OMISSION') adminStatus = 'OMITTED';
        if (action === 'REFUSED') adminStatus = 'REFUSED';

        // Múltiples registros en una sola transacción
        const dataToInsert = medicationIds.map((medId: string) => ({
            patientMedicationId: medId,
            administeredById,
            status: adminStatus,
            notes: notes || (action === 'PRN' ? 'Administración PRN de emergencia' : undefined),
            signatureBase64: signatureBase64 || null // Guardar Trazo Físico
        }));

        const result = await prisma.medicationAdministration.createMany({
            data: dataToInsert
        });

        return NextResponse.json({ success: true, count: result.count, statusApplied: adminStatus });

    } catch (error) {
        console.error("Bulk Meds Error:", error);
        return NextResponse.json({ success: false, error: "Error procesando medicamentos en bloque" }, { status: 500 });
    }
}
