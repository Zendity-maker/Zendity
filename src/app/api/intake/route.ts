import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

/**
 * DEPRECATED — Sprint P.4
 *
 * Endpoint legacy de intake single-shot. Reemplazado por el wizard
 * maestro en /corporate/patients/intake (server actions saveIntakeDraft
 * + submitIntake + POST /api/corporate/intake/analyze-document).
 *
 * Este endpoint sigue activo por retrocompatibilidad con cualquier
 * cliente externo o script de migración, pero ahora:
 *  - requiere sesión autenticada
 *  - requiere rol DIRECTOR/ADMIN/NURSE
 *  - usa session.user.headquartersId (ignora body.headquartersId)
 *  - emite warning a consola en cada uso
 *
 * Nuevos flujos clínicos DEBEN usar /corporate/patients/intake.
 */
const ALLOWED_ROLES = ['DIRECTOR', 'ADMIN', 'NURSE'];

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }
        if (!ALLOWED_ROLES.includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: 'Rol no autorizado' }, { status: 403 });
        }

        console.warn(`[DEPRECATED /api/intake] Invocado por ${(session.user as any).email}. Migrar a /corporate/patients/intake (wizard maestro + /api/corporate/intake/analyze-document).`);

        const body = await req.json();
        const { name, diagnoses, medicalHistory, allergies, rawMedications, colorGroup } = body;

        // Sprint P.4 — hqId siempre de la sesión, nunca del body.
        // Antes el endpoint aceptaba body.headquartersId y caía a first HQ
        // si no venía — eso permitía que cualquier request sin auth creara
        // pacientes en cualquier sede.
        const finalHqId = (session.user as any).headquartersId;
        if (!finalHqId) {
            return NextResponse.json({ success: false, error: 'Sesión sin sede asignada' }, { status: 400 });
        }

        // 1. Crear el Perfil Demográfico base del Residente
        const patient = await prisma.patient.create({
            data: {
                name,
                headquartersId: finalHqId,
                colorGroup: colorGroup || 'UNASSIGNED',
            }
        });

        // 2. Almacenar la fuente de la verdad inmutable (Zendity Intake)
        await prisma.intakeData.create({
            data: {
                patientId: patient.id,
                diagnoses,
                medicalHistory,
                allergies,
                rawMedications,
                status: 'PROCESSED'
            }
        });

        // 3. Traductor Clínico-a-Operativo IA (Business Logic Engine MVP)
        let feeding = "Dieta Regular por boca. Proveer hidratación constante.";
        let mobility = "Ambulatorio. Estimular caminar en áreas comunes.";
        let customs = "Rutina Estándar de la facilidad.";
        let criticalAlerts = "";

        const textToAnalyze = (diagnoses + " " + medicalHistory).toLowerCase();

        if (textToAnalyze.includes("disfagia") || textToAnalyze.includes("atraganta")) {
            feeding = "Dieta Puré/Triturada estricta. Líquidos espesados (Néctar/Miel).";
            criticalAlerts += " Alto Riesgo de Aspiración (Atragantamiento). 45 grados sentado al comer. ";
        }
        if (textToAnalyze.includes("diabetes") || textToAnalyze.includes("diabetico")) {
            feeding = "Dieta Diabética (Zero Sugar / Low Carb). Merienda Nocturna requerida.";
        }
        if (textToAnalyze.includes("alzheimer") || textToAnalyze.includes("demencia")) {
            customs = "Redirección verbal constante, validar emociones. Puede presentar agitación nocturna (Sundowning).";
            criticalAlerts += " Riesgo de Fuga inminente (Wandering). No dejar cerca de salidas. ";
        }
        if (textToAnalyze.includes("postrado") || textToAnalyze.includes("silla de ruedas")) {
            mobility = "Dependencia casi total. Cambios posturales q2h riguroso. Transferencia entre 2 personas mínimo.";
            criticalAlerts += " Riesgo Piel: Desarrollo de Úlceras Activo. ";
        }
        if (!criticalAlerts) {
            criticalAlerts = "Ninguna alerta aguda extraída del Intake inicial.";
        }

        // 4. Instanciar el Zendity Life Plan (PAI Draft)
        // Requerirá firma de Enfermería antes de ser OFFICIAL.
        await prisma.lifePlan.create({
            data: {
                patientId: patient.id,
                dietDetails: feeding,
                mobility,
                cognitiveLevel: customs,
                clinicalSummary: diagnoses,
                risks: criticalAlerts ? [{ area: 'Admisión', finding: criticalAlerts, priority: 'Alta' }] : [],
                status: 'DRAFT'
            }
        });

        // 5. Motor Cascada: Poblar el eMAR leyendo `rawMedications`
        const medsArray = rawMedications.split(',').map((m: string) => m.trim()).filter(Boolean);
        for (const medName of medsArray) {
            let coreMed = await prisma.medication.findFirst({ where: { name: { equals: medName, mode: 'insensitive' } } });

            if (!coreMed) {
                coreMed = await prisma.medication.create({
                    data: { name: medName, dosage: "1 Tablet PO" }
                });
            }

            await prisma.patientMedication.create({
                data: {
                    patientId: patient.id,
                    medicationId: coreMed.id,
                    scheduleTimes: "08:00 AM", // default asamblea
                }
            });
        }

        return NextResponse.json({ success: true, patientId: patient.id, message: "Cascade Flow Initiated" });

    } catch (error) {
        console.error("Intake Error:", error);
        return NextResponse.json({ success: false, error: "Fallo orquestando Flujo en Cascada" }, { status: 500 });
    }
}
