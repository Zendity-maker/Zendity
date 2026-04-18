import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { MedStatus } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

// NOTA: CAREGIVER NO está autorizado a bulk-administer medicamentos.
const ALLOWED_ROLES = ['NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN'];

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }
        const invokerId = (session.user as any).id;
        const invokerRole = (session.user as any).role;
        const hqId = (session.user as any).headquartersId;
        if (!ALLOWED_ROLES.includes(invokerRole)) {
            return NextResponse.json({ error: 'Rol no autorizado para administración masiva de medicamentos' }, { status: 403 });
        }

        const { action, medicationIds, notes, signatureBase64 } = await req.json();

        // action can be 'ADMINISTER_ALL', 'PRN', 'OMISSION'
        if (!action || !medicationIds || !Array.isArray(medicationIds) || medicationIds.length === 0) {
            return NextResponse.json({ success: false, error: "Datos incompletos para la acción masiva" }, { status: 400 });
        }

        // Tenant check: todas las patientMedication deben pertenecer a residentes
        // de la sede del invocador.
        const validMeds = await prisma.patientMedication.findMany({
            where: {
                id: { in: medicationIds },
                patient: { headquartersId: hqId }
            },
            select: { id: true }
        });
        if (validMeds.length !== medicationIds.length) {
            // No revelamos qué IDs fallaron — 404 opaco.
            return NextResponse.json({ success: false, error: 'Medicamentos no encontrados' }, { status: 404 });
        }

        let adminStatus: MedStatus = 'ADMINISTERED';
        if (action === 'OMISSION') adminStatus = 'OMITTED';
        if (action === 'REFUSED') adminStatus = 'REFUSED';

        // administeredById SIEMPRE del session — nunca del body
        const dataToInsert = medicationIds.map((medId: string) => ({
            patientMedicationId: medId,
            administeredById: invokerId,
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
