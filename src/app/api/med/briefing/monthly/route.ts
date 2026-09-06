/**
 * EL DOSSIER QUE SE LE ENTREGA AL MÉDICO QUE VISITA
 *
 * QUIÉN PUEDE PEDIRLO. Antes: cualquiera con sesión — bastaba `if (!session)`.
 * Medido el 06-sep-2026, eso eran las 21 cuentas activas de Cupey: cocina,
 * mantenimiento, un inversionista y diez cuidadoras podían sacar el expediente
 * clínico de 30 días de cualquier residente. Ahora es el mismo grupo que puede
 * ver el eMAR.
 *
 * QUEDA RASTRO. Antes no lo había: ni PhiAccessLog ni el documento guardado.
 * Un papel clínico salía hacia un médico de fuera y el sistema no sabía quién
 * lo pidió, para quién, ni cuándo. Eso es un hueco de auditoría HIPAA, y
 * además hacía imposible responder "¿esto se usa?".
 *
 * LA SEDE SE COMPRUEBA SIEMPRE. El chequeo era `if (userHqId && ...)`: si la
 * sesión no traía sede, no se comprobaba nada. Hoy el schema no permite un
 * usuario sin sede, así que no era explotable — pero una condición que solo
 * protege cuando un campo viene lleno no es una frontera. Ahora la sede va
 * dentro del `where`, así que un residente de otra sede simplemente no existe.
 *
 * OJO — PHI A UN TERCERO. El prompt lleva el nombre real del residente, sus
 * vitales fuera de rango con fecha, incidentes y caídas a OpenAI. Eso exige un
 * BAA con OpenAI. Es decisión de dirección, está señalado, y no se puede
 * quitar sin quitar el análisis.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { logPhiAccess } from '@/lib/phi-audit';
import { textoDeAlergias, alergiasSinDocumentar } from '@/lib/alergias';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "dummy" });

/** El mismo grupo que puede leer el eMAR. Ver src/app/api/med/crud/route.ts. */
const ROLES = ['CAREGIVER', 'NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN'];

export async function POST(req: Request) {
    try {
        const auth = await requireRole(ROLES);
        if (auth instanceof NextResponse) return auth;

        const { patientId } = await req.json();
        if (!patientId) return NextResponse.json({ success: false, error: "Falta patientId" }, { status: 400 });

        const date30DaysAgo = new Date();
        date30DaysAgo.setDate(date30DaysAgo.getDate() - 30);

        // La sede va DENTRO del where: un residente de otra sede no existe.
        const patient: any = await prisma.patient.findFirst({
            where: { id: patientId, headquartersId: auth.headquartersId },
            include: {
                headquarters: { select: { id: true, name: true, logoUrl: true, billingAddress: true, phone: true } },
                vitalSigns: { where: { createdAt: { gte: date30DaysAgo } }, orderBy: { createdAt: 'asc' }, include: { measuredBy: { select: { name: true } } } },
                incidents: { where: { reportedAt: { gte: date30DaysAgo } }, orderBy: { reportedAt: 'asc' } },
                dailyLogs: { where: { createdAt: { gte: date30DaysAgo }, isClinicalAlert: true }, orderBy: { createdAt: 'asc' }, include: { author: { select: { name: true } } } },
                fallIncidents: { where: { reportedAt: { gte: date30DaysAgo } }, orderBy: { reportedAt: 'asc' } },
                medications: { where: { isActive: true }, include: { medication: true } },
                intakeData: true,
            }
        });

        if (!patient) return NextResponse.json({ success: false, error: "Paciente no encontrado" }, { status: 404 });

        // ── 1. Math Engine: Vitals Averages ──
        // systolic/diastolic/heartRate/temperature son NULLABLE en el schema, y
        // `acc + null` da NaN: un solo registro incompleto imprimia "NaN/NaN"
        // como promedio del mes. Hoy en produccion no hay ninguno (0 de 1.790
        // en 30 dias), asi que esto es un cerrojo, no un arreglo de algo roto.
        const vitals = (patient.vitalSigns as any[]).filter(
            (v) => v.systolic != null && v.diastolic != null && v.heartRate != null && v.temperature != null,
        );
        let avgSys = 0, avgDia = 0, avgHr = 0, avgTemp = 0;
        const abnormalVitals: string[] = [];
        const redFlags: string[] = [];

        if (vitals.length > 0) {
            avgSys = Math.round(vitals.reduce((acc: number, v: any) => acc + v.systolic, 0) / vitals.length);
            avgDia = Math.round(vitals.reduce((acc: number, v: any) => acc + v.diastolic, 0) / vitals.length);
            avgHr = Math.round(vitals.reduce((acc: number, v: any) => acc + v.heartRate, 0) / vitals.length);
            avgTemp = Number((vitals.reduce((acc: number, v: any) => acc + v.temperature, 0) / vitals.length).toFixed(1));

            vitals.forEach((v: any) => {
                const dateStr = v.createdAt.toLocaleDateString('es-ES', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                const isAbnormal = v.systolic > 140 || v.systolic < 90 || v.diastolic > 90 || v.diastolic < 60 || v.heartRate > 100 || v.heartRate < 55 || v.temperature >= 99.5;
                if (isAbnormal) {
                    abnormalVitals.push(`[${dateStr}] BP: ${v.systolic}/${v.diastolic}, HR: ${v.heartRate}, Temp: ${v.temperature}F`);
                }
            });

            // Red flags: persistent hypertension, tachycardia, fever
            if (avgSys > 140 || avgDia > 90) redFlags.push(`Hipertension promedio: ${avgSys}/${avgDia} mmHg`);
            if (avgHr > 100) redFlags.push(`Taquicardia promedio: ${avgHr} bpm`);
            if (avgTemp >= 99.5) redFlags.push(`Temperatura elevada promedio: ${avgTemp}°F`);
            if (abnormalVitals.length >= 5) redFlags.push(`${abnormalVitals.length} lecturas anormales en 30 dias`);
        }

        // ── 2. Incident & Preventive Summaries ──
        const clinicalLogs = patient.dailyLogs.map((l: any) => `[${l.createdAt.toLocaleDateString()}] Accion Preventiva: ${l.notes}`);
        const incidentLogs = patient.incidents.map((i: any) => `[${i.reportedAt.toLocaleDateString()}] Incidente (${i.type}): ${i.description}`);
        const fallLogs = patient.fallIncidents.map((f: any) => `[${f.reportedAt.toLocaleDateString()}] Caida: ${f.notes || f.interventions}`);

        if (patient.fallIncidents.length > 0) redFlags.push(`${patient.fallIncidents.length} caida(s) en 30 dias`);
        if (patient.dailyLogs.length >= 3) redFlags.push(`${patient.dailyLogs.length} alertas clinicas en 30 dias`);

        // ── 3. GPT Narrative ──
        const systemPrompt = `Eres Zendi, la Inteligencia Clinica de Zendity. Actua como el Director Medico Geriatrico.
El Doctor o Psiquiatra visitara el centro manana. Debes redactar el "Dossier Medico Mensual" de los ultimos 30 dias para el paciente: ${patient.name}.

FORMATO REQUERIDO:
Usa un formato profesional en Markdown. Nada de saludos largos.
1. Resumen Ejecutivo (1 parrafo sobre el estado general del mes).
2. Patron de Signos Vitales Anormales: Extrae las fechas exactas de las vitals anormales proveidas para que el medico detecte patrones con medicamentos. Si no hubo, indicalo.
3. Alertas Preventivas y Comportamiento: Resume las acciones preventivas, caidas e incidentes.
4. Recomendaciones para el medico visitante.

NO incluyas tablas de vitales ni promedios, ni listes las caidas o alertas una por una: todo eso ya va en tablas aparte del documento. Se breve — el dossier completo son DOS paginas y este texto comparte la segunda con las tablas. Maximo 280 palabras.

DATOS CRUDOS (Ultimos 30 dias):
Promedios: ${vitals.length > 0 ? `BP: ${avgSys}/${avgDia}, HR: ${avgHr}, Temp: ${avgTemp}F` : 'Sin registros'}
Vitales Anormales (Fuera de Rango):
${abnormalVitals.length > 0 ? abnormalVitals.join('\n') : 'Ninguna lectura fuera de rango.'}

Acciones Preventivas Reportadas:
${clinicalLogs.length > 0 ? clinicalLogs.join('\n') : 'Ninguna'}

Incidentes/Comportamiento:
${incidentLogs.length > 0 ? incidentLogs.join('\n') : 'Ninguno'}

Caidas Reportadas:
${fallLogs.length > 0 ? fallLogs.join('\n') : 'Ninguna'}`;

        const gptResponse = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [{ role: "system", content: systemPrompt }],
            temperature: 0.2,
            // 800 daba un texto que no cabia en la pagina 2. Las tablas del PDF
            // ya llevan los numeros; esto es la lectura, no el dato.
            max_tokens: 520,
        });

        const dossierMarkdown = gptResponse.choices[0].message?.content || "No se pudo generar el dossier tecnico.";

        // El dossier sale del sistema hacia un medico de fuera: es una
        // exportacion de PHI y tiene que quedar registrada.
        logPhiAccess({
            action: 'EXPORT',
            resourceType: 'DossierMedico',
            resourceId: patient.id,
            patientId: patient.id,
            hqId: auth.headquartersId,
            userId: auth.id,
            routePath: '/api/med/briefing/monthly',
            context: { vitales: vitals.length, caidas: patient.fallIncidents.length, alertas: patient.dailyLogs.length },
        });

        // ── Response ──
        return NextResponse.json({
            success: true,
            patientId: patient.id,
            patientName: patient.name,

            dossierMarkdown,
            hasRedFlags: redFlags.length > 0,
            redFlags,
            rawData: {
                roomNumber: patient.roomNumber,
                colorGroup: patient.colorGroup,
                diet: patient.diet,
                // Nunca null: o la alergia, o el aviso de que nadie preguntó.
                // Un campo vacio pintaba una caja roja de "ALERGIAS CRITICAS"
                // con "N/A" dentro — 27 de 33 residentes de Cupey el 06-sep.
                allergies: textoDeAlergias(patient.intakeData?.allergies),
                allergiesUndocumented: alergiasSinDocumentar(patient.intakeData?.allergies),
                diagnoses: patient.intakeData?.diagnoses || null,
                hqId: patient.headquarters?.id || null,
                hqName: patient.headquarters?.name || null,
                // Vuelve al payload: ahora SÍ se pinta — es el membrete del
                // hogar en el PDF. Es un data-URI guardado en la sede, así que
                // entra en el documento sin depender de una descarga.
                hqLogoUrl: patient.headquarters?.logoUrl || null,

                hqAddress: patient.headquarters?.billingAddress || null,
                hqPhone: patient.headquarters?.phone || null,
                vitals: vitals.map((v: any) => ({
                    date: v.createdAt.toISOString(),
                    systolic: v.systolic,
                    diastolic: v.diastolic,
                    heartRate: v.heartRate,
                    temperature: v.temperature,
                    measuredBy: v.measuredBy?.name || null,
                    isAbnormal: v.systolic > 140 || v.systolic < 90 || v.diastolic > 90 || v.diastolic < 60 || v.heartRate > 100 || v.heartRate < 55 || v.temperature >= 99.5,
                })),
                avgVitals: vitals.length > 0 ? { sys: avgSys, dia: avgDia, hr: avgHr, temp: avgTemp } : null,
                medications: patient.medications.map((pm: any) => ({
                    name: pm.medication.name,
                    dosage: pm.medication.dosage,
                    route: pm.medication.route,
                    frequency: pm.frequency,
                    scheduleTimes: pm.scheduleTimes,
                })),
                clinicalAlerts: patient.dailyLogs.map((l: any) => ({
                    date: l.createdAt.toISOString(),
                    notes: l.notes,
                    author: l.author?.name || null,
                })),
                falls: patient.fallIncidents.map((f: any) => ({
                    date: f.reportedAt.toISOString(),
                    severity: f.severity,
                    notes: f.notes,
                    interventions: f.interventions,
                })),
            }
        });

    } catch (error) {
        console.error("Monthly Briefing API Error:", error);
        return NextResponse.json({ success: false, error: "Error interno al generar el dossier medico." }, { status: 500 });
    }
}
