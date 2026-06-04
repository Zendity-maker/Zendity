import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { withPhiAccessLog } from "@/lib/phi-audit";

/**
 * HIPAA — Devuelve el historial clínico COMPLETO del residente (meds,
 * administraciones, incidentes, caídas, bath/meal logs, intake, life plan,
 * triage). Antes estaba SIN auth: cualquiera con un patientId bajaba todo.
 * Ahora restringido a personal clínico/administrativo + tenant check.
 */
const ALLOWED_ROLES = ['SUPERVISOR', 'DIRECTOR', 'ADMIN', 'NURSE'];

// PHI audit (Pilar 1) — lectura del expediente completo.
export const GET = withPhiAccessLog(getHistoryReportHandler, {
    resourceType: 'Patient',
    getPatientId: async ({ params }) => (await params).id,
});

async function getHistoryReportHandler(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;
        const invokerHqId = auth.headquartersId;

        const { id: patientId } = await params;

        if (!patientId) {
            return NextResponse.json({ success: false, error: "Missing patient ID" }, { status: 400 });
        }

        // Tenant check HIPAA — el invoker solo puede ver residentes de su sede
        const patientCheck = await prisma.patient.findUnique({
            where: { id: patientId },
            select: { headquartersId: true },
        });
        if (!patientCheck || patientCheck.headquartersId !== invokerHqId) {
            return NextResponse.json({ success: false, error: "Residente fuera de tu sede" }, { status: 403 });
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
                lifePlans: { orderBy: { createdAt: 'desc' }, take: 1 },
                TriageTicket: {
                    orderBy: { createdAt: 'desc' },
                    include: {
                        assignedTo: { select: { name: true, role: true } },
                        resolvedBy: { select: { name: true } }
                    }
                }
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
