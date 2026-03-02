import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET all leads for a specific HQ
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const headquartersId = searchParams.get("headquartersId");

        if (!headquartersId) return NextResponse.json({ error: "headquartersId is required" }, { status: 400 });

        const leads = await prisma.cRMLead.findMany({
            where: { headquartersId },
            include: {
                transcripts: true,
                interactions: true
            },
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json(leads);
    } catch (e) {
        console.error("GET CRM Leads Error:", e);
        return NextResponse.json({ error: "Failed to fetch CRM leads" }, { status: 500 });
    }
}

// POST: Create a Lead, Update Stage (Kanban Drag), or Convert to Patient
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { action, headquartersId, ...data } = body;

        if (action === "CREATE") {
            const { firstName, lastName, phone, email, notes } = data;
            const newLead = await prisma.cRMLead.create({
                data: {
                    headquartersId,
                    firstName,
                    lastName,
                    phone,
                    email,
                    notes,
                    stage: "PROSPECT"
                }
            });
            return NextResponse.json(newLead);
        }

        if (action === "UPDATE_STAGE") {
            const { leadId, stage } = data;

            // "No-Code Error" Backend Validation
            if (stage === "ADMISSION") {
                const leadCheck = await prisma.cRMLead.findUnique({ where: { id: leadId } });
                if (!leadCheck?.medicalEvaluationCompleted || !leadCheck?.contractSigned) {
                    return NextResponse.json({
                        error: "Validación Fallida: No se puede migrar a 'Ingreso' sin Evaluación Médica y Contrato Firmado (DocuSign)."
                    }, { status: 403 });
                }
            }

            const updatedLead = await prisma.cRMLead.update({
                where: { id: leadId },
                data: { stage }
            });

            // Zero-Data-Entry: Migración a Historial Clínico
            if (stage === "ADMISSION") {
                const existingPatient = await prisma.patient.findFirst({
                    where: { headquartersId: updatedLead.headquartersId, name: `${updatedLead.firstName} ${updatedLead.lastName}` }
                });

                if (!existingPatient) {
                    await prisma.patient.create({
                        data: {
                            headquartersId: updatedLead.headquartersId,
                            name: `${updatedLead.firstName} ${updatedLead.lastName}`
                        }
                    });
                    console.log(`[Zero-Data-Entry] Prospecto ${updatedLead.firstName} promovido exitosamente a Residente Clínico.`);
                }
            }

            return NextResponse.json(updatedLead);
        }

        if (action === "UPDATE_REQUIREMENTS") {
            const { leadId, medicalEvaluationCompleted, contractSigned } = data;
            const updated = await prisma.cRMLead.update({
                where: { id: leadId },
                data: { medicalEvaluationCompleted, contractSigned }
            });
            return NextResponse.json(updated);
        }

        return NextResponse.json({ error: "Invalid action" }, { status: 400 });

    } catch (e) {
        console.error("POST CRM Leads Error:", e);
        return NextResponse.json({ error: "Failed to process CRM Lead" }, { status: 500 });
    }
}
