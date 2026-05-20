import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';

export async function GET(
    _req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await requireRole(['SUPERVISOR', 'NURSE', 'DIRECTOR', 'ADMIN']);
        if (auth instanceof NextResponse) return auth;

        const { id } = await params;

        const patient = await prisma.patient.findUnique({
            where: { id },
            include: {
                headquarters: { select: { name: true, phone: true } },
                medications: {
                    where: { status: 'ACTIVE' },
                    include: { medication: { select: { name: true, category: true, dosage: true, route: true } } },
                    orderBy: { startDate: 'asc' },
                },
                primaryFamilyMember: { select: { name: true, phone: true, relationship: true } },
                intakeData: { select: { allergies: true, diagnoses: true, medicalHistory: true } },
            },
        });

        if (!patient) {
            return NextResponse.json(
                { success: false, error: 'Paciente no encontrado' },
                { status: 404 }
            );
        }

        // Resolver texto de alergias: IntakeData es la fuente principal
        const allergiesText =
            (patient.intakeData?.allergies && patient.intakeData.allergies.trim().length > 0)
                ? patient.intakeData.allergies.trim()
                : 'Ninguna conocida';

        const diagnosesText =
            (patient.intakeData?.diagnoses && patient.intakeData.diagnoses.trim().length > 0)
                ? patient.intakeData.diagnoses.trim()
                : 'No especificado';

        const card = {
            id: patient.id,
            name: patient.name,
            roomNumber: patient.roomNumber,
            dateOfBirth: patient.dateOfBirth,
            photoUrl: patient.photoUrl,
            allergiesText,
            diagnoses: diagnosesText,
            diet: patient.diet,
            needsDialysis: patient.needsDialysis,
            preferredHospital: patient.preferredHospital,
            insurancePlanName: patient.insurancePlanName,
            insurancePolicyNumber: patient.insurancePolicyNumber,
            medicareNumber: patient.medicareNumber,
            medicaidNumber: patient.medicaidNumber,
            medications: patient.medications.map((pm) => ({
                name: pm.medication.name,
                category: pm.medication.category,
                dosage: pm.medication.dosage,
                route: pm.medication.route,
                frequency: pm.frequency,
                instructions: pm.instructions,
            })),
            primaryFamilyMember: patient.primaryFamilyMember,
            headquarters: patient.headquarters,
        };

        return NextResponse.json({ success: true, card });
    } catch (error) {
        console.error('Emergency Card GET Error:', error);
        return NextResponse.json(
            { success: false, error: 'Error al obtener la tarjeta de emergencia.' },
            { status: 500 }
        );
    }
}
