import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const { employeeName, employeeRole, patientName, patientColor } = await req.json();

        // 1. Generate Life Plan (Simulated AI Output base on Intake Data)
        const lifePlan = `
**[Zendity AI] Perfil Inicial de Cuidado - ${patientName}**

- **Clasificación de Riesgo Clínico**: Estable (Zonificación asignada: ${patientColor}).
- **Movilidad Activa**: Requiere asistencia mínima (1 persona standby) para transferencias corporales. Fomentar caminatas circulares en el patio a las 10:00 AM.
- **Soporte Nutricional**: Dieta Blanda Mecánica. Supervisar episodios de disfagia esporádicos. Aportar suplemento vitamínico oral (ENSURE) en el horario PM.
- **Acomodo Conductual (Sundowning)**: Propensa a desorientación verbal al atardecer. Mantener iluminación perimetral y música de frecuencia theta a partir de las 5:00 PM.
- **Monitoreo de Vitales**: Estándar T.I.D. (Three times a day). Red flag si Presión Sistólica > 140.

*(Documento generado algorítmicamente por Zendity AI de acuerdo con la ingesta y transferido directamente a la matriz de permisos de ${employeeName} en su rol de ${employeeRole}).*
        `.trim();

        // 2. Generate Zendi Welcome Briefing (Simulated TTS Sound Payload for Shift Login)
        const firstName = employeeName.split(' ')[0] || "Staff";
        const roleName = employeeRole === "CAREGIVER" ? "Cuidador" : "Enfermero";

        const briefing = {
            ttsMessage: `¡Buen día, ${firstName}! Qué bueno verte. Bienvenido a tu turno como ${roleName}. Hoy has sido asignado para liderar el Grupo ${patientColor}. Quiero informarte que hemos admitido exitosamente a ${patientName}. He revisado sus signos vitales de ingreso y ya sincronicé su Life Plan oficial en tu dispositivo inteligente. Presta atención especial a su asistencia de caminata al mediodía. Confío en tu experiencia, que tengas un excelente turno.`,
            quickRead: {
                vitalsAlerts: 0,
                foodAlerts: 0,
                appointments: 1
            }
        };

        // Artificial delay para simular el procesamiento de base de datos
        await new Promise(r => setTimeout(r, 2000));

        return NextResponse.json({ success: true, lifePlan, briefing });
    } catch (e) {
        return NextResponse.json({ success: false, error: "Simulacro Fallido." }, { status: 500 });
    }
}
