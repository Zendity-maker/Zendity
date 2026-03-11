import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: patientId } = await params;

        if (!patientId) {
            return NextResponse.json({ success: false, error: "Missing patient ID" }, { status: 400 });
        }

        const patientHistory = await prisma.patient.findUnique({
            where: { id: patientId },
            include: {
                headquarters: true,
                medications: {
                    include: {
                        medication: true,
                        administrations: true,
                        auditLogs: true
                    }
                },
                incidents: true,
                wellnessNotes: true,
                fallIncidents: true,
                bathLogs: true,
                mealLogs: true,
                serviceVisits: true,
                intakeData: true,
                lifePlan: true
            }
        });

        if (!patientHistory) {
            return NextResponse.json({ success: false, error: "Patient not found" }, { status: 404 });
        }

        // Opcional: Podríamos enviar esto a Zendi AI para que devuelva una narrativa,
        // pero por ahora devolvemos el JSON raw para que el Frontend lo compile o lo imprima.

        return NextResponse.json({ success: true, history: patientHistory });

    } catch (error: any) {
        console.error("History Report Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
