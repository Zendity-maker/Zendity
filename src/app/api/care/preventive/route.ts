import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { applyScoreEvent } from '@/lib/score-event';

const ALLOWED_ROLES = ['CAREGIVER', 'NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN'];

export async function POST(req: Request) {
    try {
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;

        const { patientId, symptom, aiNote } = await req.json();
        // HIPAA — el actor sale de la sesión (antes caregiverId del body → impersonación + puntos a cualquiera).
        const caregiverId = auth.id;

        if (!patientId || !symptom) {
            return NextResponse.json({ success: false, error: "Faltan parámetros obligatorios." }, { status: 400 });
        }

        // Tenant check — el paciente debe ser de tu sede
        const patient = await prisma.patient.findUnique({ where: { id: patientId }, select: { headquartersId: true } });
        if (!patient || patient.headquartersId !== auth.headquartersId) {
            return NextResponse.json({ success: false, error: "Residente fuera de tu sede" }, { status: 403 });
        }

        // 1. Guardar o inyectar reporte clínico en el Handover (DailyLog con isClinicalAlert = true)
        const logContext = `[ACCIÓN PREVENTIVA: ${symptom.toUpperCase()}] ${aiNote || "Sin detalles adicionales proporcionados."}`;

        const diagnosticLog = await prisma.dailyLog.create({
            data: {
                patientId,
                authorId: caregiverId,
                bathCompleted: false,
                // null, no 0: este evento no dice nada sobre la comida, y un 0
                // se lee como "no comió nada".
                foodIntake: null,
                notes: logContext,
                isClinicalAlert: true, // Esto envía el registro autónomo al Mando de Enfermería
                isResolved: false
            }
        });

        // 2. Sistema de Recompensa de Empleado (+5 Puntos) — actor = sesión
        await applyScoreEvent(caregiverId, auth.headquartersId, 5,
            'Acción preventiva clínica registrada', 'PREVENTIVE');

        return NextResponse.json({ success: true, log: diagnosticLog, pointsDelta: 5 });

    } catch (error) {
        console.error("Preventive Hub Error:", error);
        return NextResponse.json({ success: false, error: "Error interno procesando acción preventiva." }, { status: 500 });
    }
}
