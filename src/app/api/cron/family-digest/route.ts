import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { todayStartAST } from '@/lib/dates';
import { isCleanNote, computeFoodBand } from '@/lib/family/disclosure';
import {
    PATIENT_CONGRUENCE_SELECT,
    getFamilyContentPolicy,
    filterCongruentNotes,
    buildCongruentPromptRules,
    verifyCongruentOutput,
} from '@/lib/family/congruence';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
// Pro plan permite hasta 300s. Con loop por lotes de 6, soportamos ~200 residentes.
export const maxDuration = 300;

/**
 * CRON — Resumen familiar diario ("El día de…")
 * Programado a las 23:00 UTC (= 7:00 PM AST) — después de cena y actividades
 * vespertinas, antes de hora de dormir familiar. Ver vercel.json.
 *
 * Para cada residente ACTIVO con al menos un familiar REGISTRADO:
 *   1. Reúne SOLO actividad de estilo de vida del día clínico
 *      (ingesta, baño, notas de bienestar/momentos). NUNCA consulta
 *      vitales ni medicamentos — el guardarraíl clínico vive en la capa
 *      de data, no en el prompt: lo clínico jamás entra al generador.
 *   2. Calcula medsOnTrack desde MedicationAdministration (no hardcoded).
 *   3. Genera prosa cálida en español con Gemini.
 *   4. Hace upsert de DailyDigest por (patientId, digestDate).
 *
 * Procesamiento en LOTES de 6 paralelos con Promise.allSettled para:
 *   - Aislamiento de fallos (1 error no bloquea los demás)
 *   - Respetar timeout de 300s (loop secuencial podía exceder con >150 residentes)
 *   - Protección contra rate limit de Gemini
 *
 * TODO (fast-follow cuando Mayagüez llene): dispatcher por sede vía
 *   ?hqId=XXX para correr N invocaciones paralelas, una por sede.
 *
 * El digest NO dispara notificación push (canal ambiental). Solo aparece
 * en el portal. Los pushes son del canal humano (ZendiFamilyMoment, incidentes).
 */

const BATCH_SIZE = 6;

export async function GET(req: Request) {
    // Protección CRON_SECRET (mismo patrón que el resto de los crons)
    const authHeader = req.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new Response('Unauthorized', { status: 401 });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // PAUSA AÚN ACTIVA — Fase A live, re-habilitación es paso aparte.
    //
    // El código de abajo YA tiene la capa de congruencia (chokepoint, filter,
    // reglas duras, verify, regla "o nada"). La pausa se mantiene hasta que
    // enfermería marque los perfiles reales (PEG, encamados, hospicio) en
    // /corporate/medical/patients/[id]. Sin esos datos, los defaults
    // conservadores (ORAL/AMBULATORY/NONE) NO protegen a quien no tiene
    // perfil real.
    //
    // Para re-habilitar:
    //   1. Verificar distribución en DB: que los PEG, BEDRIDDEN, HOSPICE
    //      conocidos aparezcan marcados.
    //   2. Setear FAMILY_DIGEST_ENABLED=true en Vercel env Production.
    //   3. Restaurar la entrada cron en vercel.json (schedule "0 23 * * *").
    //
    // Defensa en profundidad: aún si alguien restaura el schedule sin setear
    // la env, este gate devuelve 503.
    // ──────────────────────────────────────────────────────────────────────────
    if (process.env.FAMILY_DIGEST_ENABLED !== 'true') {
        return NextResponse.json({
            success: false,
            paused: true,
            reason: 'family-digest paused: congruence layer in place, awaiting nursing to mark patient profiles (feedingMethod/mobilityStatus/careModality) before re-enable. Set FAMILY_DIGEST_ENABLED=true and restore cron schedule to resume.',
        }, { status: 503 });
    }

    try {
        const digestDate = todayStartAST();

        // Residentes activos con al menos un familiar REGISTRADO (isRegistered:true).
        // Sin esto, gastamos Gemini en residentes cuya familia nunca lo va a ver.
        // Nota: el chokepoint de congruencia (getFamilyContentPolicy) re-evalúa
        // estado/modalidad por residente — HOSPITAL/HOSPICE/AWAY se saltan abajo
        // aun cuando el status base sea ACTIVE (ej. HOSPICE) o llegue a este loop.
        const patients = await prisma.patient.findMany({
            where: {
                status: 'ACTIVE',
                familyMembers: { some: { isRegistered: true } },
            },
            select: {
                id: true,
                name: true,
                headquartersId: true,
                familyShareLevel: true,
                // Capa de congruencia: campos propios de Patient + relaciones
                // (IntakeData.mobilityLevel y LifePlan.mobility más reciente).
                // Los helpers derivan feeding/mobility de fuentes existentes.
                ...PATIENT_CONGRUENCE_SELECT,
                intakeData: { select: { mobilityLevel: true } },
                lifePlans: {
                    orderBy: { updatedAt: 'desc' as const },
                    take: 1,
                    select: { mobility: true, updatedAt: true, status: true },
                },
                dailyLogs: {
                    where: { createdAt: { gte: digestDate } },
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    select: { foodIntake: true, notes: true, isClinicalAlert: true },
                },
                wellnessNotes: {
                    where: { createdAt: { gte: digestDate } },
                    orderBy: { createdAt: 'desc' },
                    take: 3,
                    select: { note: true },
                },
            },
        });

        const { GoogleGenerativeAI } = require('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash',
            generationConfig: { responseMimeType: 'application/json' },
        });

        // Procesa UN residente — usado dentro del lote paralelo.
        async function processOne(p: typeof patients[0]): Promise<{ ok: boolean; patientId: string; error?: string }> {
            try {
                // ─── Capa de congruencia ─────────────────────────────────
                // 1. Política: ¿este residente recibe digest hoy?
                const policy = getFamilyContentPolicy(p);
                if (!policy.allowAutoDigest) {
                    return { ok: true, patientId: p.id, error: `skipped:${policy.state}` };
                }

                const log = p.dailyLogs[0];
                const foodPctRaw = log?.foodIntake ?? null;
                const foodBandRaw = computeFoodBand(foodPctRaw);

                // 2. Filtrado de inputs antes del prompt — PEG/NPO → cero foodBand;
                //    BEDRIDDEN → cero activityNote; notas wellness filtradas por keyword.
                const foodBand = policy.constraints.allowOralFood ? foodBandRaw : null;

                const notasLimpiasRaw: string[] = [
                    log?.notes && !log.isClinicalAlert && isCleanNote(log.notes) ? log.notes : null,
                    ...p.wellnessNotes.map((n) => n.note).filter((n) => isCleanNote(n)),
                ]
                    .filter((n): n is string => !!n)
                    .slice(0, 3);

                const notasLimpias = filterCongruentNotes(p, notasLimpiasRaw);
                const activityNote = policy.constraints.allowActivityMention
                    ? notasLimpias[0]?.replace(/^\[Zendi Update\]\s*/i, '').trim() || null
                    : null;

                // 3. Regla "o nada": si tras filtrar no queda contexto concreto, NO generes.
                const tieneFood = !!foodBand;
                const tieneNotas = notasLimpias.length > 0;
                if (!tieneFood && !tieneNotas) {
                    return { ok: true, patientId: p.id, error: 'skipped:no-congruent-context' };
                }

                const contexto = [
                    tieneFood ? `Ingesta del día: ${foodBand}.` : null,
                    tieneNotas ? `Notas del equipo: ${notasLimpias.join('. ')}.` : null,
                ].filter(Boolean).join(' ');

                // 4. Prompt con reglas duras de congruencia inyectadas
                const congruenceRules = buildCongruentPromptRules(p);

                const prompt = `
Eres Zendi, la voz cálida del equipo de cuidado de una residencia de adultos mayores.
Escribe un resumen del día para la familia del residente "${p.name}", en español, en tono cariñoso y tranquilizador.

Contexto de estilo de vida del día (lo único que conoces): "${contexto}"

${congruenceRules}

Reglas de forma:
- 2 a 3 oraciones, en primera persona del equipo ("Hoy ${p.name}...").
- Enfócate en bienestar, ánimo y vida diaria. NO menciones signos vitales, medicamentos, diagnósticos ni números clínicos.
- Nada de promesas médicas. Nada alarmante.
- Solo menciona hechos del contexto recibido. NO inventes ni uses plantillas alegres genéricas.

Devuelve SOLO este JSON (sin markdown, sin backticks):
{ "narrative": "el resumen del día" }
                `.trim();

                const result = await model.generateContent(prompt);
                let textResponse = (result.response.text() || '{}')
                    .replace(/```json/g, '')
                    .replace(/```/g, '')
                    .trim();

                const parsed = JSON.parse(textResponse);
                const narrativeRaw = (parsed.narrative || '').trim();
                if (!narrativeRaw) {
                    // El modelo respetó "devuelve vacío" — regla "o nada" satisfecha.
                    return { ok: true, patientId: p.id, error: 'skipped:gemini-empty' };
                }

                // 5. Red final post-generación: si el modelo igual mencionó algo prohibido,
                //    descartamos. NO persistimos contenido incongruente.
                const narrative = verifyCongruentOutput(p, narrativeRaw);
                if (!narrative) {
                    console.warn('[family-digest] descartado por verifyCongruentOutput', { patientId: p.id, reasons: policy.constraints.reasons, narrativeRaw });
                    return { ok: true, patientId: p.id, error: 'skipped:incongruent-output' };
                }

                // medsOnTrack derivado de MedicationAdministration del día clínico actual.
                // null si no hubo administraciones registradas; true si todas en regla;
                // false si hubo OMITTED/MISSED/REFUSED.
                const [totalAdmins, omits] = await Promise.all([
                    prisma.medicationAdministration.count({
                        where: {
                            patientMedication: { patientId: p.id },
                            scheduledTime: { gte: digestDate },
                        },
                    }),
                    prisma.medicationAdministration.count({
                        where: {
                            patientMedication: { patientId: p.id },
                            scheduledTime: { gte: digestDate },
                            status: { in: ['OMITTED', 'MISSED', 'REFUSED'] },
                        },
                    }),
                ]);
                const medsOnTrack: boolean | null = totalAdmins === 0 ? null : omits === 0;

                await prisma.dailyDigest.upsert({
                    where: { patientId_digestDate: { patientId: p.id, digestDate } },
                    update: { narrative, foodBand, activityNote, medsOnTrack, generatedAt: new Date() },
                    create: {
                        patientId: p.id,
                        headquartersId: p.headquartersId,
                        digestDate,
                        narrative,
                        foodBand,
                        activityNote,
                        medsOnTrack,
                    },
                });

                return { ok: true, patientId: p.id };
            } catch (e: any) {
                const msg = e?.message || 'error desconocido';
                // Log estructurado por residente — visible en Vercel logs sin parsear el response final
                console.error(`[family-digest] patient=${p.id} (${p.name}) failed: ${msg}`);
                return { ok: false, patientId: p.id, error: msg };
            }
        }

        let generados = 0;
        const errores: { patientId: string; error: string }[] = [];

        // Procesamiento en LOTES de 6 paralelos con Promise.allSettled.
        // Promise.allSettled garantiza que un fallo no aborta el lote.
        for (let i = 0; i < patients.length; i += BATCH_SIZE) {
            const batch = patients.slice(i, i + BATCH_SIZE);
            const results = await Promise.allSettled(batch.map(processOne));
            for (const r of results) {
                if (r.status === 'fulfilled') {
                    if (r.value.ok) generados++;
                    else errores.push({ patientId: r.value.patientId, error: r.value.error || 'unknown' });
                } else {
                    // Rejected — no debería pasar porque processOne captura su propio error
                    errores.push({ patientId: 'unknown', error: r.reason?.message || 'rejected' });
                }
            }
        }

        return NextResponse.json({
            success: true,
            generados,
            total: patients.length,
            errores: errores.length ? errores : undefined,
        });
    } catch (error: any) {
        console.error('Family Digest CRON Error:', error);
        return NextResponse.json(
            { success: false, error: error?.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}
