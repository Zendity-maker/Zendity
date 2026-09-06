import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { lineaModalidad } from '@/lib/cuidado-final';
import { requireRole } from '@/lib/api-auth';

export async function GET(
    _req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await requireRole(['SUPERVISOR', 'NURSE', 'DIRECTOR', 'ADMIN']);
        if (auth instanceof NextResponse) return auth;

        const { id } = await params;

        /**
         * LA SEDE, QUE FALTABA.
         *
         * Era `findUnique({ where: { id } })` a secas: comprobaba el ROL y no
         * el residente. Cualquier supervisora, enfermera o directora de
         * cualquier sede podia pedir la tarjeta de emergencia de un residente
         * de otra con solo su id — medicacion, alergias, diagnosticos, numero
         * de seguro y telefono del familiar.
         *
         * Pregunta 3 de la auditoria proactiva de CLAUDE.md: una operacion por
         * ID tiene que verificar que el invocador tenga acceso a ESE id, no
         * solo el rol.
         */
        const patient = await prisma.patient.findFirst({
            where: { id, headquartersId: auth.headquartersId },
            include: {
                headquarters: { select: { name: true, phone: true, address: true, billingAddress: true } },
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

        /**
         * UN CAMPO VACIO NO ES "NINGUNA CONOCIDA".
         *
         * Decia 'Ninguna conocida' cuando el campo estaba vacio. Eso no es un
         * dato que falta: es una AFIRMACION, y el hogar no puede sostenerla.
         * Medido el 06-sep-2026: 28 de 33 residentes activos de Cupey no tienen
         * alergias documentadas. Su papel de traslado le decia a la sala de
         * urgencias que no se le conocen alergias — como si alguien lo hubiera
         * comprobado.
         *
         * Cinco SI las tienen documentadas, y tres de esas cinco son a
         * penicilina. La diferencia entre "no tiene" y "no lo sabemos" es
         * exactamente la que importa cuando alguien va a medicar.
         *
         * Ahora el papel dice la verdad, y dice que hay que preguntar.
         */
        const allergiesText =
            (patient.intakeData?.allergies && patient.intakeData.allergies.trim().length > 0)
                ? patient.intakeData.allergies.trim()
                : 'NO DOCUMENTADO — confirmar con el hogar antes de medicar';

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
            // Objetivos de cuidado. Es lo que decide que le hacen a esta
            // persona en las primeras dos horas de una sala de emergencias, y
            // el papel que iba con ella no lo decia. Con el proveedor al lado:
            // en el hospital ese nombre es a quien llamar.
            modalidadCuidado: lineaModalidad(patient.careModality, patient.hospiceProvider),
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
