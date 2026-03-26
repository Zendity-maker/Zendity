import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';



export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;

        const patient = await prisma.patient.findUnique({
            where: { id },
            include: {
                headquarters: true,
                lifePlan: true,
                medications: {
                    include: {
                        medication: true,
                        administrations: {
                            orderBy: { administeredAt: 'desc' },
                            include: {
                                administeredBy: { select: { id: true, name: true } }
                            }
                        }
                    }
                }
            }
        });

        if (!patient) {
            return NextResponse.json({ success: false, error: "Paciente no encontrado" }, { status: 404 });
        }

        return NextResponse.json({ success: true, patient });

    } catch (error) {
        console.error("Fetch Patient Error:", error);
        return NextResponse.json({ success: false, error: "Error detallando paciente." }, { status: 500 });
    }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await req.json();
        const {
            name, roomNumber, dateOfBirth,
            allergies, diagnoses, diet,
            idCardUrl, medicalPlanUrl, medicareCardUrl
        } = body;

        const patient = await prisma.patient.findUnique({ where: { id }, include: { intakeData: true } });
        if (!patient) return NextResponse.json({ success: false, error: "No encontrado" }, { status: 404 });

        const updateData: any = {
            name,
            roomNumber,
            diet,
            dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        };

        // Only update photos if explicitly passed in to avoid overwriting with nulls if undefined
        if (idCardUrl !== undefined) updateData.idCardUrl = idCardUrl;
        if (medicalPlanUrl !== undefined) updateData.medicalPlanUrl = medicalPlanUrl;
        if (medicareCardUrl !== undefined) updateData.medicareCardUrl = medicareCardUrl;

        if (patient.intakeData) {
            updateData.intakeData = {
                update: {
                    allergies,
                    diagnoses
                }
            };
        } else {
            updateData.intakeData = {
                create: {
                    allergies: allergies || '',
                    diagnoses: diagnoses || '',
                    medicalHistory: '',
                    rawMedications: ''
                }
            };
        }

        const updated = await prisma.patient.update({
            where: { id },
            data: updateData
        });

        return NextResponse.json({ success: true, patient: updated });
    } catch (error: any) {
        console.error("Update Patient Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
