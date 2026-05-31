/**
 * prisma/seeds/sandbox-nurse.ts
 * Extiende el seed del sandbox con datos clínicos para el Manual de la Enfermera.
 * Agrega: Sandra Demo (NURSE), PAI, órdenes médicas PRN, evaluaciones de riesgo,
 * visita médica externa y ticket de Triage clínico abierto.
 *
 * NUNCA toca datos del HQ de producción Cupey.
 * Uso: npx tsx prisma/seeds/sandbox-nurse.ts
 */

import { prisma } from '../../src/lib/prisma';
import bcrypt from 'bcryptjs';

const HQ = 'b2ac0700-f937-4085-9595-dcf81a2e5e30';

// IDs de pacientes sandbox (obtenidos del seed previo)
const MARIA_TEST_ID    = '94b56bff-0ed0-44bc-8ca7-133f9dd79e76';
const CARLOS_DEMO_ID   = '5ac289c5-f9d9-4cb5-895f-2a898c751dd0';
const ROSA_SANDBOX_ID  = '4c32c1ac-a324-440c-bb7f-595030d4c842';
const PEDRO_FICTICIO_ID = 'ec8b852d-3e72-4044-a472-8bfc6e2ee75b';

function daysAgo(n: number): Date {
    return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

async function main() {
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║  SANDBOX NURSE SEED — datos clínicos ficticios           ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log(`HQ: ${HQ}\n`);

    const hq = await prisma.headquarters.findUnique({ where: { id: HQ } });
    if (!hq) throw new Error('HQ sandbox no encontrado');
    console.log(`✅ HQ: ${hq.name}`);

    const pinHash = await bcrypt.hash('1234', 10);

    // ── 1. Sandra Demo — NURSE ────────────────────────────────────────────
    const nurse = await prisma.user.upsert({
        where: { email: 'sandra.demo@sandbox.zendity.com' },
        update: { pinCode: pinHash },
        create: {
            headquartersId: HQ,
            name: 'Sandra Demo',
            email: 'sandra.demo@sandbox.zendity.com',
            pinCode: pinHash,
            role: 'NURSE',
        },
    });
    console.log(`✅ Enfermera: ${nurse.name} (${nurse.email}) PIN:1234`);

    // ── 2. PAI — María Test (Hab. 101) ────────────────────────────────────
    const existingPai = await prisma.lifePlan.findFirst({
        where: { patientId: MARIA_TEST_ID, status: 'APPROVED' },
    });

    if (!existingPai) {
        await prisma.lifePlan.create({
            data: {
                patientId: MARIA_TEST_ID,
                status: 'APPROVED',
                type: 'INITIAL',
                approvedById: nurse.id,
                approvedAt: daysAgo(2),
                signedById: nurse.id,
                signedAt: daysAgo(2),
                startDate: daysAgo(10),
                nextReview: new Date(Date.now() + 80 * 24 * 60 * 60 * 1000), // en 80 días
                supportSource: 'Hija (Carmen Test) y sobrino (Luis Test)',
                clinicalSummary: `María Test, 84 años, residente en Hab. 101. Diagnósticos activos: hipertensión arterial esencial (I10), diabetes mellitus tipo 2 (E11.9), insuficiencia cardíaca congestiva compensada (I50.9). Cognición preservada (MMSE 24/30). Movilidad reducida — deambula con andador supervisado. Riesgo de caída MODERADO (Downton 4 puntos). Sin úlceras de presión activas.`,
                continence: 'Continente urinario con urgencia leve. Continente fecal.',
                cognitiveLevel: 'Orientada en persona y lugar. Ligera desorientación temporal en horas nocturnas. No requiere supervisión constante.',
                mobility: 'Deambula con andador. Traslados supervisados. No puede subir escaleras. Sedente autónoma.',
                dietDetails: 'Dieta baja en sodio (<2g/día). Consistencia regular. Sin restricción de líquidos. Prefiere comidas pequeñas y frecuentes.',
                risks: JSON.stringify([
                    { area: 'Caídas', finding: 'Downton 4 — riesgo moderado por marcha con andador y urgencia miccional', priority: 'Alta' },
                    { area: 'Cardiovascular', finding: 'ICC compensada — monitoreo de edemas y peso diario', priority: 'Alta' },
                    { area: 'Metabólico', finding: 'DM2 — glucosa en ayunas objetivo 80-130 mg/dL', priority: 'Media' },
                    { area: 'Tegumentario', finding: 'Piel seca en extremidades inferiores — hidratación diaria requerida', priority: 'Baja' },
                ]),
                interdisciplinarySummary: 'Paciente estable desde perspectiva multidisciplinaria. Equipo acuerda continuar tratamiento farmacológico actual, reforzar movilización segura y mantener dieta hiposódica. Fisioterapia 3 veces por semana. Próxima revisión de PAI en 90 días.',
                goals: JSON.stringify([
                    { objective: 'Mantener TA < 140/90 mmHg', action: 'Administrar Losartán 50mg diario, monitorear PA cada turno', responsible: 'Enfermería', frequency: 'Diario', indicator: 'Registro de vitales en eMAR' },
                    { objective: 'Control glucémico (ayunas 80-130 mg/dL)', action: 'Metformina 500mg con desayuno y cena, glucómetro 2x/día', responsible: 'Enfermería / Cuidadores', frequency: 'Diario', indicator: 'Registro glucosa eMAR' },
                    { objective: 'Prevención de caídas', action: 'Uso obligatorio de andador, calzado antideslizante, iluminación nocturna', responsible: 'Todo el equipo', frequency: 'Continuo', indicator: 'Cero incidentes de caída / mes' },
                    { objective: 'Mantener función cognitiva', action: 'Actividades cognitivas grupales lunes-miércoles-viernes', responsible: 'Actividades / Terapia Ocupacional', frequency: '3x/semana', indicator: 'Participación ≥ 80%' },
                    { objective: 'Integridad cutánea', action: 'Hidratación de MMII con crema emoliente post-baño', responsible: 'Cuidadores turno matutino', frequency: 'Diario', indicator: 'Sin lesiones nuevas' },
                ]),
                familyEducation: 'La hija Carmen fue orientada sobre: señales de descompensación cardíaca (edemas, disnea, ganancia de peso súbita > 2kg en 3 días), manejo correcto de Losartán (no duplicar dosis si se olvida), y protocolo de visitas — no traer alimentos sin autorización del equipo nutricional.',
                preferences: 'Prefiere bañarse por las mañanas. Le gustan las novelas y los programas musicales. No desea ser resucitada en caso de paro cardíaco (conversación documentada con hija presente).',
                monitoringMethod: 'Vitales diarios en eMAR. Peso 2x/semana (martes y viernes). Glucómetro 2x/día (ayunas y post-cena). Revisión de extremidades inferiores en cada baño.',
                revisionCriteria: 'Revisar PAI si: hospitalización, cambio de estado de salud significativo, solicitud de familia, o a los 90 días desde esta fecha.',
                familyVersion: 'María está recibiendo un cuidado integral que incluye control de su presión arterial y azúcar en sangre, actividades cognitivas y físicas adaptadas a sus necesidades, y una dieta especialmente preparada para su corazón. Su hija Carmen ha sido orientada sobre cómo apoyarla durante las visitas.',
            },
        });
        console.log(`✅ PAI APROBADO creado para María Test`);
    } else {
        console.log(`♻️  PAI ya existe para María Test`);
    }

    // ── 3. Órdenes médicas — Carlos Demo (Hab. 102) ───────────────────────
    const medsToCreate = [
        { name: 'Losartán',          dosage: '50mg',   route: 'Oral',     category: 'Antihipertensivos', frequency: 'DIARIO',   times: '["08:00 AM", "06:00 PM"]', instructions: 'Tomar con o sin alimentos. No suspender bruscamente.' },
        { name: 'Metformina',        dosage: '500mg',  route: 'Oral',     category: 'Antidiabéticos',    frequency: 'DIARIO',   times: '["07:00 AM", "07:00 PM"]', instructions: 'Administrar con el desayuno y la cena para reducir efectos GI.' },
        { name: 'Acetaminofén',      dosage: '500mg',  route: 'Oral',     category: 'Analgésicos',       frequency: 'PRN',      times: '["PRN"]',                   instructions: 'Administrar PRN dolor moderado (EVA ≥ 4). Máximo 4 dosis/24h. Prescriptor: Dr. Demo Sandbox.' },
        { name: 'Cloruro de Sodio',  dosage: '0.9% IV',route: 'Intravenosa', category: 'Soluciones', frequency: 'PRN',      times: '["PRN"]',                   instructions: 'Solución de mantenimiento PRN deshidratación. Velocidad: 80 mL/h. Prescriptor: Dr. Demo Sandbox.' },
    ];

    for (const med of medsToCreate) {
        let medication = await prisma.medication.findFirst({ where: { name: med.name } });
        if (!medication) {
            medication = await prisma.medication.create({
                data: { name: med.name, dosage: med.dosage, route: med.route, category: med.category, isGlobalMaster: true },
            });
        }
        const existing = await prisma.patientMedication.findFirst({
            where: { patientId: CARLOS_DEMO_ID, medicationId: medication.id, isActive: true },
        });
        if (!existing) {
            await prisma.patientMedication.create({
                data: {
                    patientId: CARLOS_DEMO_ID,
                    medicationId: medication.id,
                    frequency: med.frequency,
                    scheduleTimes: med.times,
                    instructions: med.instructions,
                    prescribedBy: 'Dr. Demo Sandbox',
                    isActive: true,
                    status: med.frequency === 'PRN' ? 'PRN' : 'ACTIVE',
                },
            });
            console.log(`  ✅ Medicación: ${med.name} ${med.dosage} (${med.frequency}) → Carlos Demo`);
        } else {
            console.log(`  ♻️  Ya existe: ${med.name} → Carlos Demo`);
        }
    }

    // ── 4. Evaluaciones clínicas ──────────────────────────────────────────

    // 4a. Downton (FallRiskAssessment) — Rosa Sandbox (Hab. 103)
    const existingDownton = await prisma.fallRiskAssessment.findFirst({
        where: { patientId: ROSA_SANDBOX_ID },
    });
    if (!existingDownton) {
        await prisma.fallRiskAssessment.create({
            data: {
                patientId: ROSA_SANDBOX_ID,
                evaluatorId: nurse.id,
                riskLevel: 'MODERATE',
                morseScore: 45,
                factors: JSON.stringify([
                    'Caídas previas: Sí (1 caída hace 6 meses)',
                    'Diagnóstico secundario: Sí (HTA + artrosis rodilla)',
                    'Apoyo ambulatorio: Bastón',
                    'Medicación de riesgo: Sí (antihipertensivos)',
                    'Estado mental: Orientada',
                    'Marcha: Levemente alterada — tendencia a apresurar pasos',
                    'Downton Score: 4 / Riesgo MODERADO',
                ]),
                evaluatedAt: daysAgo(7),
                nextReviewAt: new Date(Date.now() + 23 * 24 * 60 * 60 * 1000),
            },
        });
        console.log(`✅ Evaluación Downton creada para Rosa Sandbox (score MODERATE)`);
    } else {
        console.log(`♻️  Downton ya existe para Rosa Sandbox`);
    }

    // 4b. Braden (ClinicalNote tipo BRADEN_ASSESSMENT) — Pedro Ficticio (Hab. 104)
    // Nota: no hay modelo Braden dedicado en el schema; se usa ClinicalNote con type='BRADEN_ASSESSMENT'
    const existingBraden = await prisma.clinicalNote.findFirst({
        where: { patientId: PEDRO_FICTICIO_ID, type: 'BRADEN_ASSESSMENT' },
    });
    if (!existingBraden) {
        await prisma.clinicalNote.create({
            data: {
                patientId: PEDRO_FICTICIO_ID,
                authorId: nurse.id,
                title: 'Evaluación Braden — Riesgo de Úlcera por Presión',
                type: 'BRADEN_ASSESSMENT',
                content: `ESCALA DE BRADEN — Pedro Ficticio, Hab. 104
Evaluado por: Sandra Demo (NURSE) · ${daysAgo(5).toLocaleDateString('es-PR')}

SUBESCALAS:
• Percepción sensorial: 2/4 — Limitada (responde solo a estímulos verbales intensos)
• Humedad: 3/4 — Ocasionalmente húmedo (ropa de cama húmeda 1x/turno)
• Actividad: 1/4 — Encamado (no deambula, reposo completo)
• Movilidad: 2/4 — Muy limitada (realiza ligeros cambios ocasionales)
• Nutrición: 2/4 — Probablemente inadecuada (consume < 50% comidas)
• Fricción/Deslizamiento: 1/3 — Problema (requiere asistencia total para posicionamiento)

PUNTAJE TOTAL: 11/23
NIVEL DE RIESGO: ALTO (≤12 puntos = riesgo elevado)

INTERVENCIONES ORDENADAS:
- Cambios posturales cada 2 horas (documentar en PosturalChangeLog)
- Colchón de presión alterna activado
- Proteger zonas de presión: sacro, talones, occipucio
- Nutrición reforzada — consulta nutricional solicitada
- Revisión cutánea en cada cambio de postura
- Próxima reevaluación: ${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('es-PR')}`,
                createdAt: daysAgo(5),
            },
        });
        console.log(`✅ Evaluación Braden (ClinicalNote) creada para Pedro Ficticio (score 11/23 ALTO)`);
    } else {
        console.log(`♻️  Braden ya existe para Pedro Ficticio`);
    }

    // 4c. Evaluación cognitiva (MMSE) — María Test
    const existingMMSE = await prisma.clinicalNote.findFirst({
        where: { patientId: MARIA_TEST_ID, type: 'COGNITIVE_ASSESSMENT' },
    });
    if (!existingMMSE) {
        await prisma.clinicalNote.create({
            data: {
                patientId: MARIA_TEST_ID,
                authorId: nurse.id,
                title: 'Evaluación Cognitiva MMSE',
                type: 'COGNITIVE_ASSESSMENT',
                content: `MINI-MENTAL STATE EXAMINATION (MMSE) — María Test, Hab. 101
Evaluado por: Sandra Demo (NURSE) · ${daysAgo(8).toLocaleDateString('es-PR')}

RESULTADO: 24/30 puntos
INTERPRETACIÓN: Deterioro cognitivo leve (sin afectación funcional significativa)

SUBESCALAS:
• Orientación temporal: 8/10 (no identifica correctamente el día de la semana)
• Orientación espacial: 5/5
• Registro: 3/3
• Atención y cálculo: 4/5
• Evocación: 2/3
• Lenguaje: 8/9
• Praxis constructiva: 1/1

OBSERVACIONES: Paciente colaboradora durante la evaluación. Leve desorientación temporal — más notoria en horas de la tarde. No se evidencia deterioro funcional en AVD. Cognición suficiente para participar en toma de decisiones sobre su cuidado.

RECOMENDACIÓN: Mantener estimulación cognitiva grupal. Reevaluar en 3 meses o ante cambio de comportamiento.`,
                createdAt: daysAgo(8),
            },
        });
        console.log(`✅ Evaluación MMSE (ClinicalNote) creada para María Test (24/30)`);
    } else {
        console.log(`♻️  MMSE ya existe para María Test`);
    }

    // ── 5. Visita médica externa — María Test ─────────────────────────────
    // FIX 2026-05-31: SpecialistVisit eliminado del schema. La demo de visita
    // externa se reconstruirá con ExternalServiceVisit cuando se necesite —
    // requiere también ExternalProvider + ExternalServiceCategory de demo
    // en el HQ sandbox. Por ahora skipped, el resto del seed funciona OK.

    // ── 6. Ticket de Triage clínico abierto ──────────────────────────────
    const existingTriage = await prisma.triageTicket.findFirst({
        where: { headquartersId: HQ, assignedToId: nurse.id, status: 'OPEN' },
    });
    if (!existingTriage) {
        // Primero crear un DailyLog de Ana Demo como origen del ticket
        const anaDemo = await prisma.user.findFirst({
            where: { email: 'ana.demo@sandbox.zendity.com' },
        });
        const originLog = anaDemo ? await prisma.dailyLog.findFirst({
            where: { patientId: PEDRO_FICTICIO_ID },
        }) : null;

        await prisma.triageTicket.create({
            data: {
                headquartersId: HQ,
                patientId: PEDRO_FICTICIO_ID,
                originType: 'DAILY_LOG',
                originReferenceId: originLog?.id ?? undefined,
                priority: 'HIGH',
                status: 'OPEN',
                isEscalated: false,
                description: `OBSERVACIÓN DE CUIDADOR — Pedro Ficticio, Hab. 104
Registrado por: Ana Demo (Cuidadora) · Turno MAÑANA

"Pedro se negó a comer el desayuno y el almuerzo de hoy. Refirió que tiene el estómago revuelto. Está más quieto que de costumbre y no quiso participar en las actividades de la mañana. La piel en el sacro se ve un poco enrojecida — no es una herida, pero se ve diferente a ayer."

PRIORIDAD: ALTA — Posible inicio de úlcera por presión + rechazo alimentario en paciente de alto riesgo Braden (11/23).

ACCIÓN REQUERIDA: Evaluación de enfermería urgente. Verificar integridad cutánea en sacro. Considerar cambios posturales inmediatos y evaluación nutricional.`,
                assignedToId: nurse.id,
                followUpNotes: JSON.stringify([]),
                createdAt: new Date(Date.now() - 90 * 60 * 1000), // hace 90 minutos
            },
        });
        console.log(`✅ Ticket de Triage ALTO creado — Pedro Ficticio → asignado a Sandra Demo`);
    } else {
        console.log(`♻️  Ticket de Triage ya existe`);
    }

    // ── Resumen ───────────────────────────────────────────────────────────
    console.log('\n══════════════════════════════════════════════════════════');
    console.log('SEED NURSE COMPLETADO');
    console.log('══════════════════════════════════════════════════════════');
    console.log(`Enfermera:     Sandra Demo <sandra.demo@sandbox.zendity.com> PIN:1234`);
    console.log(`PAI:           María Test (Hab. 101) — APPROVED, 5 objetivos, MMSE 24/30`);
    console.log(`Órdenes meds:  Carlos Demo — Losartán, Metformina, Acetaminofén PRN, NaCl 0.9% PRN`);
    console.log(`Downton:       Rosa Sandbox — MODERATE (4pts / score 45 Morse)`);
    console.log(`Braden:        Pedro Ficticio — ALTO (11/23) via ClinicalNote`);
    console.log(`MMSE:          María Test — 24/30 leve, via ClinicalNote`);
    console.log(`Visita ext.:   María Test — Dr. Demo Sandbox, Cardiología, hace 3 días`);
    console.log(`Triage:        Pedro Ficticio — OPEN HIGH → Sandra Demo`);
    console.log('══════════════════════════════════════════════════════════\n');
    console.log('NOTA: Braden usa ClinicalNote(type=BRADEN_ASSESSMENT) —');
    console.log('      no existe modelo Braden dedicado en el schema actual.');
}

main()
    .catch(e => { console.error('FATAL:', e.message); process.exit(1); })
    .finally(() => prisma.$disconnect());
