import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';

// HIPAA: solo personal clínico puede leer/escribir prescripciones.
// CRUD de PatientMedication afecta órdenes médicas — requiere auth real.
const READ_ROLES  = ['CAREGIVER', 'NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN'];
const WRITE_ROLES = ['NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN'];

export async function GET(req: Request) {
    try {
        const auth = await requireRole(READ_ROLES);
        if (auth instanceof NextResponse) return auth;
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
        // Auth + rol clínico con permisos de escritura (NURSE+).
        const auth = await requireRole(WRITE_ROLES);
        if (auth instanceof NextResponse) return auth;
        const { id: invokerId, headquartersId: invokerHqId } = auth;

        const { action, patientId, medicationId, scheduleTimes, prepDuration, reason, patientMedicationId } = await req.json();

        // authorId SIEMPRE viene de la sesión, no del body (auditoría HIPAA).
        const authorId = invokerId;

        if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
            return NextResponse.json({ success: false, error: "Justificación obligatoria (mínimo 5 caracteres) — registro HIPAA." }, { status: 400 });
        }

        let updatedMed;

        if (action === 'ADDED') {
            if (!patientId || !medicationId || !scheduleTimes) {
                return NextResponse.json({ success: false, error: "Faltan campos: patientId, medicationId, scheduleTimes." }, { status: 400 });
            }
            // Tenant check: el paciente debe estar en la sede del invocador.
            const patient = await prisma.patient.findFirst({
                where: { id: patientId, headquartersId: invokerHqId },
                select: { id: true },
            });
            if (!patient) {
                return NextResponse.json({ success: false, error: "Residente no encontrado en tu sede." }, { status: 404 });
            }
            updatedMed = await prisma.patientMedication.create({
                data: { patientId, medicationId, scheduleTimes, prepDuration: prepDuration || "1_SEMANA" }
            });
            await prisma.medicationAuditLog.create({
                data: { action: 'ADDED', patientMedicationId: updatedMed.id, authorId, reason }
            });
        }
        else if (action === 'MODIFIED') {
            if (!patientMedicationId) {
                return NextResponse.json({ success: false, error: "patientMedicationId requerido." }, { status: 400 });
            }
            // Tenant check via patient → headquartersId.
            const existing = await prisma.patientMedication.findFirst({
                where: { id: patientMedicationId, patient: { headquartersId: invokerHqId } },
                select: { id: true },
            });
            if (!existing) {
                return NextResponse.json({ success: false, error: "Prescripción no encontrada en tu sede." }, { status: 404 });
            }
            updatedMed = await prisma.patientMedication.update({
                where: { id: patientMedicationId },
                data: {
                    scheduleTimes,
                    prepDuration: prepDuration || "1_SEMANA",
                    isActive: true,
                    status: "ACTIVE"
                }
            });
            await prisma.medicationAuditLog.create({
                data: { action: 'MODIFIED', patientMedicationId: updatedMed.id, authorId, reason }
            });
        }
        else if (action === 'DISCONTINUED') {
            if (!patientMedicationId) {
                return NextResponse.json({ success: false, error: "patientMedicationId requerido." }, { status: 400 });
            }
            const existing = await prisma.patientMedication.findFirst({
                where: { id: patientMedicationId, patient: { headquartersId: invokerHqId } },
                select: { id: true },
            });
            if (!existing) {
                return NextResponse.json({ success: false, error: "Prescripción no encontrada en tu sede." }, { status: 404 });
            }
            updatedMed = await prisma.patientMedication.update({
                where: { id: patientMedicationId },
                data: { isActive: false, scheduleTimes: "DESCONTINUADO" }
            });
            await prisma.medicationAuditLog.create({
                data: { action: 'DISCONTINUED', patientMedicationId: patientMedicationId, authorId, reason }
            });
        } else {
            return NextResponse.json({ success: false, error: "Acción inválida (use ADDED, MODIFIED o DISCONTINUED)." }, { status: 400 });
        }

        return NextResponse.json({ success: true, record: updatedMed });
    } catch (error) {
        console.error("MED CRUD Error:", error);
        return NextResponse.json({ success: false, error: "Fallo en Auditoría de Medicamentos" }, { status: 500 });
    }
}
