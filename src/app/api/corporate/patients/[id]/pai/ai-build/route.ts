import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { esCuidadoDeFinal, lineaModalidad, etiquetaModalidad } from '@/lib/cuidado-final';
import { generateObject, generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { requireRole } from '@/lib/api-auth';

/**
 * HIPAA — Zendi AI PAI Builder v2
 * Genera PAI con datos clínicos reales: vitales, adherencia meds, UPPs, caídas,
 * alertas clínicas, PAI anterior aprobado + versión familiar en lenguaje cálido.
 */
const ALLOWED_ROLES = ['NURSE', 'DIRECTOR', 'ADMIN'];
export const maxDuration = 60;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;
        const invokerHqId = auth.headquartersId;

        const resolvedParams = await params;
        const patientId = resolvedParams.id;
        if (!patientId) return NextResponse.json({ success: false, error: 'ID de paciente requerido.' }, { status: 400 });

        // ── 1. Datos base del residente ──────────────────────────────────────────
        const patient = await prisma.patient.findUnique({
            where: { id: patientId },
            include: {
                intakeData: true,
                medications: { include: { medication: true } }
            }
        });

        if (!patient) return NextResponse.json({ success: false, error: 'Paciente no encontrado.' }, { status: 404 });
        if (patient.headquartersId !== invokerHqId) return NextResponse.json({ success: false, error: 'Residente fuera de tu sede' }, { status: 403 });

        // ── 2. Signos vitales — últimas 4 semanas ─────────────────────────────
        const fourWeeksAgo = new Date();
        fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

        const vitals = await prisma.vitalSigns.findMany({
            where: { patientId, createdAt: { gte: fourWeeksAgo } },
            orderBy: { createdAt: 'desc' },
            take: 20,
            select: {
                systolic: true, diastolic: true, heartRate: true,
                temperature: true, spo2: true,
                createdAt: true
            }
        });

        // ── 3. Adherencia a medicamentos (últimos 30 días) ────────────────────
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const patientMeds = await prisma.patientMedication.findMany({
            where: { patientId, isActive: true },
            include: {
                medication: { select: { name: true } },
                administrations: {
                    where: { administeredAt: { gte: thirtyDaysAgo } },
                    select: { status: true }
                }
            }
        });

        const adherenceLines = patientMeds.map(pm => {
            const total = pm.administrations.length;
            const administered = pm.administrations.filter((a: any) => a.status === 'ADMINISTERED').length;
            const pct = total > 0 ? Math.round((administered / total) * 100) : null;
            return `${pm.medication.name}: ${pct !== null ? `${pct}% adherencia (${administered}/${total})` : 'sin registros'}`;
        });

        // ── 4. UPPs activas ───────────────────────────────────────────────────
        const upps = await prisma.pressureUlcer.findMany({
            where: { patientId, status: { not: 'RESOLVED' } },
            select: { bodyLocation: true, stage: true, status: true }
        });

        // ── 5. Caídas — últimos 90 días ───────────────────────────────────────
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

        const falls = await prisma.fallIncident.findMany({
            where: { patientId, incidentDate: { gte: ninetyDaysAgo } },
            select: { notes: true, severity: true, location: true, incidentDate: true },
            orderBy: { incidentDate: 'desc' },
            take: 10
        });

        // ── 6. Alertas clínicas del DailyLog (30 días) ────────────────────────
        const clinicalAlerts = await prisma.dailyLog.findMany({
            where: { patientId, isClinicalAlert: true, createdAt: { gte: thirtyDaysAgo } },
            select: { notes: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
            take: 10
        });

        // ── 7. PAI anterior aprobado (si existe) ─────────────────────────────
        const previousPai = await prisma.lifePlan.findFirst({
            where: { patientId, status: 'APPROVED' },
            orderBy: { approvedAt: 'desc' },
            select: { clinicalSummary: true, risks: true, goals: true, approvedAt: true, type: true }
        });

        // ── 8. Construir contexto clínico completo ────────────────────────────
        const vitalsText = vitals.length > 0
            ? vitals.slice(0, 5).map(v =>
                `${new Date(v.createdAt).toLocaleDateString('es-PR')}: TA ${v.systolic || '?'}/${v.diastolic || '?'}, FC ${v.heartRate || '?'}, SpO2 ${v.spo2 || '?'}%, T° ${v.temperature || '?'}°F`
            ).join(' | ')
            : 'Sin vitales recientes';

        const uppText = upps.length > 0
            ? upps.map(u => `${u.bodyLocation} Estadio ${u.stage} (${u.status})`).join('; ')
            : 'Sin UPPs activas';

        const fallsText = falls.length > 0
            ? `${falls.length} caída(s) en 90 días. Última: ${falls[0].location} — ${falls[0].notes?.slice(0, 80) || ''} — Severidad: ${falls[0].severity}`
            : 'Sin caídas registradas en 90 días';

        const alertsText = clinicalAlerts.length > 0
            ? clinicalAlerts.slice(0, 5).map(a => `• ${a.notes?.slice(0, 100)}`).join('\n')
            : 'Sin alertas clínicas recientes';

        // ── ESTADO FUNCIONAL ──────────────────────────────────────────────────
        // Esto NO se le enviaba al modelo, y sin embargo el schema le exigia
        // producir `mobility`, `continence` y `dietDetails`. Sin dato y con la
        // obligacion de rellenar, invento: a Rosa M. Solis De Arce —encamada,
        // con tubo PEG, Norton positivo y Braden 12— le escribio "Movilidad
        // independiente, sin restricciones aparentes" y "Dieta equilibrada".
        // Los datos correctos estaban en la base y ya venian en esta consulta.
        const GLOSARIO: Record<string, string> = {
            BEDRIDDEN: 'ENCAMADO/A — no se moviliza por si mismo/a',
            WHEELCHAIR: 'En silla de ruedas',
            ASSISTED: 'Deambula con asistencia',
            INDEPENDENT: 'Deambula de forma independiente',
            CONTINENT: 'Continente',
            INCONTINENT: 'Incontinente',
            PARTIAL: 'Continencia parcial',
        };
        const glosa = (v?: string | null) =>
            !v ? 'No registrado' : (GLOSARIO[v.toUpperCase()] ?? v);

        const estadoFuncional = [
            `Movilidad: ${glosa(patient.intakeData?.mobilityLevel)}`,
            `Continencia: ${glosa(patient.intakeData?.continenceLevel)}`,
            `Dieta / via de alimentacion: ${patient.diet || patient.intakeData?.dietSpecifics || 'No registrada'}`,
            `Requiere cambios posturales: ${patient.requiresPosturalChanges ? 'SI' : 'No'}`,
            `Riesgo Norton de ulceras: ${patient.nortonRisk ? 'SI — positivo' : 'No'}`,
            `Escala Braden: ${patient.intakeData?.bradenScore ?? 'No registrada'}${
                typeof patient.intakeData?.bradenScore === 'number' && patient.intakeData.bradenScore <= 14
                    ? ' (ALTO RIESGO de ulceras por presion)' : ''}`,
            `Escala Downton (caidas): ${patient.intakeData?.downtonScore ?? 'No registrada'}`,
            `Modalidad de cuido: ${
                esCuidadoDeFinal(patient.careModality)
                    ? `${lineaModalidad(patient.careModality, patient.hospiceProvider)} — el objetivo del plan es CONFORT, no recuperacion${
                        patient.hospiceStartDate ? ` (desde ${patient.hospiceStartDate.toLocaleDateString('es-PR')})` : ''}`
                    : 'Cuido regular'
            }`,
            `Dialisis: ${
                patient.needsDialysis
                    ? 'SI — sale del hogar periodicamente a tratamiento'
                    : 'No'
            }`,
        ].join('\n');

        const clinicalContext = `
Nombre: ${patient.name}
Habitación: ${patient.roomNumber || 'No asignada'}
Edad: ${patient.dateOfBirth ? Math.floor((Date.now() - new Date(patient.dateOfBirth).getTime()) / 3.15576e10) + ' años' : 'No registrada'}
Diagnósticos: ${patient.intakeData?.diagnoses || 'No registrados'}
Historial Médico: ${patient.intakeData?.medicalHistory || 'No registrado'}
Alergias: ${patient.intakeData?.allergies || 'Ninguna'}
Medicamentos activos: ${patient.medications.map(m => m.medication.name).join(', ') || 'Ninguno'}

── ESTADO FUNCIONAL (dato del expediente — NO lo contradigas) ──
${estadoFuncional}

── DATOS CLÍNICOS RECIENTES ──
Adherencia medicamentos (30d): ${adherenceLines.length > 0 ? adherenceLines.join(' | ') : 'Sin datos'}
Signos vitales recientes: ${vitalsText}
Úlceras por presión activas: ${uppText}
Caídas recientes (90d): ${fallsText}
Alertas clínicas DailyLog (30d):
${alertsText}

── PAI ANTERIOR APROBADO ──
${previousPai
    ? `Tipo: ${previousPai.type} | Aprobado: ${new Date(previousPai.approvedAt!).toLocaleDateString('es-PR')}\nResumen previo: ${previousPai.clinicalSummary?.slice(0, 200)}`
    : 'No existe PAI previo aprobado — este es el INICIAL'}
        `.trim();

        // La carta a la familia la firma el hogar, con su nombre. Antes cerraba
        // con "[Su Nombre] / Trabajador Social / Residencia Geriatrica" — un
        // marcador sin rellenar y un cargo generico en un mensaje que la familia
        // recibe del sitio donde vive su ser querido.
        const sede = await prisma.headquarters.findUnique({
            where: { id: invokerHqId },
            select: { name: true },
        });
        const hqName = sede?.name || 'Zéndity';

        // ── 8b. QUIEN EXISTE DE VERDAD EN ESTA SEDE ──────────────────────────
        // Sin esto la IA repartia trabajo a fisioterapeutas, nutricionistas y
        // farmaceuticos que no existen: 8 objetivos a "Terapeuta ocupacional",
        // 6 a "Fisioterapeuta", 4 a "Nutricionista" en una sede que solo tiene
        // cuidadoras, supervisoras, trabajo social y UNA enfermera. Un plan
        // firmado que asigna un servicio inexistente no defiende al hogar en
        // una inspeccion: lo acusa.
        //
        // Se resuelve dinamicamente — nunca hardcodear roles por sede.
        const personal = await prisma.user.findMany({
            where: { headquartersId: invokerHqId, isActive: true },
            select: { role: true, secondaryRoles: true },
        });
        const ROLES_LEGIBLES: Record<string, string> = {
            CAREGIVER: 'Cuidadora', NURSE: 'Enfermera', SUPERVISOR: 'Supervisora',
            DIRECTOR: 'Directora', SOCIAL_WORKER: 'Trabajo Social',
            KITCHEN: 'Cocina', MAINTENANCE: 'Mantenimiento', ADMIN: 'Administracion',
        };
        const rolesPresentes = new Set<string>();
        personal.forEach(u => {
            [u.role, ...(u.secondaryRoles || [])].forEach(r => {
                const legible = ROLES_LEGIBLES[r as string];
                if (legible) rolesPresentes.add(legible);
            });
        });
        const equipoDisponible = [...rolesPresentes].sort().join(', ') || 'Cuidadora';

        // ── 9. Generar PAI clínico estructurado con Zendi AI ─────────────────
        const { object } = await generateObject({
            model: openai('gpt-4o-mini'),
            system: `Eres el Director Médico de una residencia geriátrica. Redactas Planes Asistenciales Individualizados (PAI) de altísima calidad clínica y compasiva. Analiza todos los datos clínicos proporcionados — incluyendo signos vitales, adherencia, UPPs, caídas y alertas — para generar un PAI preciso y actualizado. Sé específico y basa CADA riesgo y objetivo en los datos reales provistos.

REGLA INVIOLABLE SOBRE HOSPICIO Y PALIATIVO.
Si el ESTADO FUNCIONAL dice que la modalidad es Hospicio o Paliativo, el plan
cambia de proposito: se busca CONFORT, dignidad y acompañamiento, no recuperar
funcion. Prohibidos los objetivos de rehabilitacion —"mejorar la fuerza",
"aumentar la movilidad", "recuperar"— y prohibido el tono celebratorio o de
progreso. Los objetivos correctos son manejo del dolor, higiene y piel,
posicionamiento cómodo, alimentación segun tolerancia y no segun metas
nutricionales, y acompañamiento a la persona y a su familia. En Puerto Rico y
en este hogar, paliativo se comunica como hospicio: no los diferencies en el
lenguaje a la familia.

REGLA INVIOLABLE SOBRE DIALISIS.
Si el residente sale a dialisis, el plan tiene que contemplarlo: los dias de
tratamiento sale del hogar y vuelve cansado, hay restriccion de liquidos y de
sal, hay que cuidar el acceso vascular (fistula o cateter) y vigilar la presion
y el peso alrededor de la sesion. Un plan que no menciona la dialisis de alguien
que va tres veces por semana no describe su vida.

REGLA INVIOLABLE SOBRE LO QUE NO SABES.
El bloque ESTADO FUNCIONAL es el expediente. NUNCA lo contradigas: si dice
ENCAMADO/A, la persona no deambula y no puede tener "movilidad independiente".
Si dice tubo PEG, no se alimenta por boca y su dieta NO es "equilibrada" ni
"blanda": es alimentación enteral por sonda, y eso manda en dieta, en riesgo de
broncoaspiración y en la posición de la cama.
Cuando un dato diga "No registrado", escribe exactamente "No registrado —
verificar con enfermería". Está prohibido rellenar por completar el formulario:
un PAI que afirma algo que nadie midió es peor que uno incompleto, porque se
firma y se archiva como si fuera cierto.
Braden ≤ 14, Norton positivo o "requiere cambios posturales: SI" obligan a un
riesgo dermatológico de prevención de úlceras en la matriz.

REGLA INVIOLABLE SOBRE QUIÉN HACE EL TRABAJO.
El personal que existe en esta residencia es EXACTAMENTE: ${equipoDisponible}.
El campo "responsible" de cada objetivo debe ser uno de esos, y ninguno más.
Nunca asignes trabajo a fisioterapeuta, terapeuta ocupacional, nutricionista,
farmacéutico, psicólogo ni médico de cabecera: no trabajan aquí, y un plan
firmado que les asigna tareas documenta un servicio que no se presta.

Si el residente clínicamente se beneficiaría de algo que este equipo NO puede
dar, NO lo escondas ni lo conviertas en un objetivo imposible: ponlo en
"recommendedServices" como una sugerencia para la familia. Ahí sí puedes
nombrar terapia física, terapia ocupacional, nutrición, podología o
acompañamiento. Es una posibilidad de mejorar su calidad de vida, no una
tarea asignada al hogar.`,
            prompt: `Analiza el siguiente historial clínico COMPLETO con datos reales recientes y genera un PAI estructurado. Basa cada riesgo y objetivo en los datos reales provistos (vitales, caídas, UPPs, adherencia, alertas).\n\nEquipo disponible en esta sede para el campo "responsible": ${equipoDisponible}. Lo que haga falta y no esté en esa lista va en recommendedServices como sugerencia, no como objetivo.\n\n${clinicalContext}`,
            schema: z.object({
                clinicalSummary: z.string().describe("Párrafo resumen compasivo de su condición actual, incluyendo datos clínicos recientes relevantes."),
                cognitiveLevel: z.string().describe("Estado cognitivo actual (Ej: 'Orientado en 3 esferas', 'Demencia moderada con desorientación temporal')."),
                mobility: z.string().describe("Estado de movilidad funcional actual."),
                continence: z.string().describe("Estado de continencia urinaria y fecal."),
                dietDetails: z.string().describe("Dieta específica requerida según condición."),
                interdisciplinarySummary: z.string().describe("Directrices de soporte global para el equipo interdisciplinario."),
                familyEducation: z.string().describe("Puntos clave que Trabajo Social debe educar a los familiares."),
                revisionCriteria: z.string().describe("Criterios clínicos de alerta que obligarían a revisar este PAI (hospitalización, caída con trauma, cambio de condición)."),
                risks: z.array(z.object({
                    area: z.string(),
                    finding: z.string(),
                    priority: z.enum(['Alta', 'Media', 'Baja'])
                })).min(3).max(6).describe("Matriz de riesgos identificados basados en datos reales. Priority: 'Alta', 'Media' o 'Baja'."),
                goals: z.array(z.object({
                    objective: z.string(),
                    action: z.string(),
                    responsible: z.string(),
                    frequency: z.string(),
                    indicator: z.string()
                })).min(3).max(6).describe("Matriz de objetivos/intervenciones para mitigar los riesgos identificados. El campo 'responsible' SOLO puede ser uno del equipo que existe en la sede."),
                recommendedServices: z.array(z.object({
                    serviceName: z.string(),
                    description: z.string(),
                    price: z.string(),
                    category: z.string(),
                })).max(4).describe("Servicios que este residente se beneficiaría de recibir pero que el hogar NO presta con su personal actual (terapia física, terapia ocupacional, nutrición, podología, acompañamiento). Se redactan como SUGERENCIA para la familia — 'se sugiere evaluación de terapia física' — nunca como tarea asignada al hogar. Explica en 'description' qué mejoraría en su calidad de vida y por qué, basado en sus datos reales. En 'price' pon 'A Convenir'. Vacío si no aplica ninguno.")
            })
        });

        // ── 10. Generar versión familiar (lenguaje cálido, máx 400 palabras) ──
        const { text: familyVersion } = await generateText({
            model: openai('gpt-4o-mini'),
            system: `Escribes en nombre de ${hqName} a la familia de un residente. Traduces un Plan Asistencial clínico a un mensaje cálido, humano y comprensible. NUNCA uses jerga médica sin explicarla. Máximo 400 palabras.

CÓMO SE FIRMA. La carta la firma el hogar, no una persona. Cierra exactamente con:

Con cariño,
El equipo de ${hqName}

Está PROHIBIDO firmar con un nombre propio, con "[Su Nombre]", con un cargo
como "Trabajador Social", o con "Residencia Geriátrica". La familia recibe esto
del hogar donde vive su ser querido, y ese hogar tiene nombre.

EL TONO SE AJUSTA A LA SITUACIÓN. El tono cálido no significa optimista a la
fuerza. Si el residente está en hospicio o cuidado paliativo, esta carta NO
habla de mejorar, progresar ni recuperar: habla de acompañar, de que no le
falte nada, de cuidar su comodidad y su dignidad, y de que la familia no está
sola. Escribir "un gran avance" a la familia de alguien que está en sus últimos
meses hiere y además no es cierto.`,
            prompt: `Traduce este Plan Asistencial al lenguaje familiar cálido y comprensible:

Residente: ${patient.name}
Resumen clínico: ${object.clinicalSummary}
Nivel cognitivo: ${object.cognitiveLevel}
Movilidad: ${object.mobility}
Dieta: ${object.dietDetails}
Riesgos principales: ${object.risks.map(r => `${r.area} (${r.priority}): ${r.finding}`).join('; ')}
Objetivos principales: ${object.goals.map(g => `${g.objective}: ${g.action}`).join('; ')}
Educación familiar: ${object.familyEducation}

Situación de cuido: ${esCuidadoDeFinal(patient.careModality) ? `${etiquetaModalidad(patient.careModality)} — el propósito es confort y acompañamiento, NO recuperación. Ajusta el tono.` : 'Cuido regular'}
Sale a diálisis: ${patient.needsDialysis ? 'Sí — menciónalo, la familia debe saber cómo se maneja ese día' : 'No'}

Escribe una carta a la familia explicando el plan de cuidado de su ser querido de forma cálida. Incluye: cómo está hoy, qué prioridades tiene el equipo, y cómo la familia puede apoyar. Cierra con "Con cariño," y "El equipo de ${hqName}" — nunca con un nombre propio ni un cargo.`
        });

        return NextResponse.json({
            success: true,
            aiGeneratedPai: object,
            familyVersion
        });

    } catch (error) {
        console.error("Zendi AI PAI Builder v2 Error:", error);
        return NextResponse.json({ success: false, error: 'Hubo un fallo generando la inteligencia clínica del PAI.' }, { status: 500 });
    }
}
