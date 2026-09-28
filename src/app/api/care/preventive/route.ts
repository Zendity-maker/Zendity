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

        /**
         * EL DOBLE TOQUE — Y AQUÍ ADEMÁS SE PAGA DOS VECES.
         *
         * Este POST creaba fila sin mirar si ya existía la misma, y justo
         * después llama a `applyScoreEvent(+5)`. O sea que un doble toque no
         * solo dejaba dos alertas clínicas iguales delante de enfermería:
         * dejaba diez puntos donde correspondían cinco.
         *
         * MEDIDO el 27-sep-2026 sobre las 22 filas que hay (23-may → 21-sep):
         * CERO textos exactamente repetidos. No ha pasado todavía; esto es
         * prevención, no reparación.
         *
         * LA LLAVE ES EL TEXTO, no el residente y el rato. Los datos lo
         * exigen: el 09-jun hay tres pares a DIEZ SEGUNDOS del mismo residente
         * y la misma cuidadora, y son diarrea, vómito, poco apetito y mareos —
         * cuatro observaciones distintas. Una llave de «mismo residente + poco
         * rato» se habría tragado tres cosas que alguien vio de verdad.
         *
         * DIEZ MINUTOS. Con el texto exacto en la llave la ventana puede ser
         * generosa: nadie reporta el mismo síntoma con las mismas palabras dos
         * veces en diez minutos queriendo decir dos episodios. Y da de sobra
         * para el reintento de un envío que sí entró y cuya respuesta no llegó.
         *
         * Se devuelve ÉXITO con la que existe, con `pointsDelta: 0` — porque
         * los cinco puntos ya se pagaron con la primera.
         */
        const VENTANA_MS = 10 * 60 * 1000;
        const yaRegistrada = await prisma.dailyLog.findFirst({
            where: {
                patientId,
                authorId: caregiverId,
                notes: logContext,
                isClinicalAlert: true,
                createdAt: { gte: new Date(Date.now() - VENTANA_MS) },
            },
            orderBy: { createdAt: 'desc' },
        });
        if (yaRegistrada) {
            return NextResponse.json({
                success: true,
                duplicada: true,
                log: yaRegistrada,
                pointsDelta: 0,
                mensaje: 'Esta acción preventiva ya estaba registrada. No hizo falta hacer nada.',
            });
        }

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
