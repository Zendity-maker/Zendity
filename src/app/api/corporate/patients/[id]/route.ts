import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';



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
            allergies, diagnoses, diet, colorGroup,
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

        if (colorGroup) updateData.colorGroup = colorGroup;

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

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !['DIRECTOR', 'ADMIN', 'NURSE'].includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: "No autorizado para cambiar el grupo de color." }, { status: 403 });
        }

        const { id } = await params;
        const { colorGroup } = await req.json();

        const validGroups = ['RED', 'YELLOW', 'GREEN', 'BLUE', 'UNASSIGNED'];
        if (!colorGroup || !validGroups.includes(colorGroup)) {
            return NextResponse.json({ success: false, error: "Grupo de color invalido." }, { status: 400 });
        }

        const updated = await prisma.patient.update({
            where: { id },
            data: { colorGroup }
        });

        return NextResponse.json({ success: true, patient: updated });
    } catch (error: any) {
        console.error("Patch ColorGroup Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
