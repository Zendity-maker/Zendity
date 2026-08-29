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
// SOCIAL_WORKER lee el historial del residente para contextualizar su
// trabajo (notas, beneficios, familia). Es solo lectura — este archivo
// no tiene handler de escritura.
const ALLOWED_ROLES = ['SUPERVISOR', 'DIRECTOR', 'ADMIN', 'NURSE', 'SOCIAL_WORKER', 'COORDINATOR'];

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

        /**
         * ESTA es la consulta que abre el expediente. La otra —/patients/[id]—
         * la usa la auditoria eMAR.
         *
         * Medido el 28-ago-2026 sobre Milagros J. Ortiz, el peor de la sede:
         * 6 329 ms y **19.31 MB de JSON** en una sola apertura. Andres lo
         * reportaba como "5 segundos".
         *
         * 18 de esos 19 MB eran FIRMAS: cada MedicationAdministration guarda un
         * signatureBase64 de ~10 KB, y se traian las 1 843. El perfil no dibuja
         * ni una — la unica pantalla que las usa es la auditoria eMAR, que va
         * por el otro endpoint. Se descargaban para nada.
         *
         * Ademas se traian enteros bathLogs (100), mealLogs (296),
         * wellnessNotes (60) y auditLogs (31): 487 filas que NINGUNA pantalla
         * de /corporate lee. Verificado buscando cada nombre en src/app/corporate
         * y src/components antes de tocarlo.
         *
         * De los tres consumidores de este endpoint, uno usa TriageTicket y los
         * otros dos el paciente base. Ninguno toca lo recortado.
         */
        const desde30 = new Date(Date.now() - 30 * 86400000);

        const patientHistory = await prisma.patient.findUnique({
            where: { id: patientId },
            include: {
                headquarters: true,
                medications: {
                    include: {
                        medication: true,
                        // select explicito, no include: Prisma 5.22 no tiene
                        // omit, y la firma NO puede viajar aqui. Estos cuatro
                        // campos son exactamente los que dibuja PatientEMARTab.
                        administrations: {
                            where: { createdAt: { gte: desde30 } },
                            orderBy: { administeredAt: 'desc' },
                            select: {
                                id: true,
                                administeredAt: true,
                                status: true,
                                notes: true,
                            },
                        },
                    }
                },
                incidents: true,
                fallIncidents: true,
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
