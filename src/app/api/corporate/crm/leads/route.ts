import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { PrismaClient, LeadStage } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user || !['ADMIN', 'DIRECTOR'].includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const hqId = (session.user as any).headquartersId;
        const leads = await prisma.cRMLead.findMany({
            where: { headquartersId: hqId },
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json({ success: true, leads });
    } catch (error) {
        return NextResponse.json({ success: false, error: 'Failed to fetch leads' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user || !['ADMIN', 'DIRECTOR'].includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const hqId = (session.user as any).headquartersId;
        const body = await request.json();

        const { firstName, lastName, phone, email, notes } = body;

        if (!firstName || !lastName || !email) {
            return NextResponse.json({ success: false, error: 'Missing required fields (First Name, Last Name, Email are mandatory)' }, { status: 400 });
        }

        const newLead = await prisma.cRMLead.create({
            data: {
                headquartersId: hqId,
                stage: LeadStage.PROSPECT,
                firstName,
                lastName,
                phone,
                email,
                notes
            }
        });

        return NextResponse.json({ success: true, lead: newLead });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ success: false, error: 'Failed to create lead' }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user || !['ADMIN', 'DIRECTOR'].includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const hqId = (session.user as any).headquartersId;
        const body = await request.json();
        const { id, stage } = body;

        if (!id || !stage) {
            return NextResponse.json({ success: false, error: 'Missing ID or stage' }, { status: 400 });
        }

        // Validate the stage
        if (!Object.values(LeadStage).includes(stage as LeadStage)) {
            return NextResponse.json({ success: false, error: 'Invalid stage' }, { status: 400 });
        }

        // If stage is NOT ADMISSION, simply update the lead
        if (stage !== 'ADMISSION') {
            const updatedLead = await prisma.cRMLead.update({
                where: { id },
                data: { stage: stage as LeadStage }
            });
            return NextResponse.json({ success: true, lead: updatedLead });
        }

        // --- AUTOMATED ADMISSION TRANSACTION ---
        // When moved to ADMISSION, create Patient + IntakeData + LifePlan + FamilyMember

        const lead = await prisma.cRMLead.findUnique({ where: { id } });
        if (!lead || lead.headquartersId !== hqId) {
            return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 });
        }

        const result = await prisma.$transaction(async (tx) => {
            // 1. Update Lead Status
            const updatedLead = await tx.cRMLead.update({
                where: { id },
                data: { stage: 'ADMISSION' }
            });

            // 2. Create the Patient
            const fullName = `${lead.firstName} ${lead.lastName}`;
            const newPatient = await tx.patient.create({
                data: {
                    headquartersId: hqId,
                    name: fullName,
                    colorGroup: 'UNASSIGNED', // Awaiting formal assessment
                }
            });

            // 3. Create Draft LifePlan
            await tx.lifePlan.create({
                data: {
                    patientId: newPatient.id,
                    status: 'DRAFT'
                }
            });

            // 4. Create empty IntakeData for Nursing to process
            await tx.intakeData.create({
                data: {
                    patientId: newPatient.id,
                    medicalHistory: "Pending admission evaluation",
                    diagnoses: "Pending admission evaluation",
                    rawMedications: "[]",
                    status: 'PENDING'
                }
            });

            // 5. Autogenerate Family Account using the Lead's Email
            if (lead.email) {
                // Check if email already exists to avoid unique constraint error
                const existingFamily = await tx.familyMember.findUnique({ where: { email: lead.email } });
                if (!existingFamily) {
                    await tx.familyMember.create({
                        data: {
                            headquartersId: hqId,
                            patientId: newPatient.id,
                            name: "Representante General (CRM)",
                            email: lead.email,
                            passcode: "123456", // Default pin code for initial setup
                            accessLevel: "Full"
                        }
                    });
                }
            }

            return updatedLead;
        });

        return NextResponse.json({ success: true, lead: result, automated: true });

    } catch (error) {
        console.error("Admission Error:", error);
        return NextResponse.json({ success: false, error: 'Failed to update lead status' }, { status: 500 });
    }
}
