/**
 * ZENDI LEE LA SEMANA — lunes 7:45 AM AST ("45 11 * * 1" en UTC).
 *
 * Cuarenta y cinco minutos antes de los reportes, para que lo que encuentre
 * llegue en el de enfermería del mismo lunes.
 *
 * QUÉ HACE. Junta el texto libre de los últimos siete días —notas de turno,
 * curaciones, cambios del piso— le pega a cada uno el contexto estructurado del
 * residente, y le pide a Gemini que señale tres cosas: lo que no tiene dónde
 * guardarse, lo que contradice al expediente, y lo que debió avisar y no avisó.
 *
 * QUÉ NO HACE. No cambia nada. No avisa a familias. No toca un expediente. Cada
 * hallazgo es una pregunta con su frase al lado, esperando que una persona diga
 * sí o no. El porqué completo está en src/lib/hallazgos-zendi.ts.
 *
 * LA GUARDA QUE IMPORTA: un hallazgo cuya cita no aparece LITERALMENTE en el
 * texto original no se guarda. La alucinación más común de un modelo al que se
 * le pide citar es inventar una cita plausible; aquí eso no llega a la lista.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verificarCron } from '@/lib/enviar-reporte';
import {
    construirPrompt, filtrarPropuestas, guardarHallazgos,
    TEXTOS_POR_TANDA, type TextoParaLeer,
} from '@/lib/hallazgos-zendi';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Cuántas tandas por sede. Un tope duro: esto lee, no tiene que leerlo todo. */
const MAX_TANDAS = 6;

/** El contexto que hace posible detectar una contradicción. */
function contextoDe(p: {
    dietTexture: string | null; dietDiabetic: boolean; dietRenal: boolean;
    careModality: string | null; needsDialysis: boolean; requiresPosturalChanges: boolean;
    intakeData: { mobilityLevel: string | null; allergies: string | null } | null;
}): string {
    const partes = [
        p.dietTexture ? `dieta ${p.dietTexture}` : null,
        p.dietDiabetic ? 'dieta diabética' : null,
        p.dietRenal ? 'dieta renal' : null,
        p.intakeData?.mobilityLevel ? `movilidad ${p.intakeData.mobilityLevel}` : null,
        p.requiresPosturalChanges ? 'requiere rotación postural' : null,
        p.needsDialysis ? 'recibe diálisis' : null,
        p.careModality && p.careModality !== 'NONE' ? `cuidado ${p.careModality}` : null,
        p.intakeData?.allergies ? `alergias: ${p.intakeData.allergies}` : 'alergias no documentadas',
    ].filter(Boolean);
    return partes.length ? partes.join(' · ') : 'sin datos estructurados';
}

export async function GET(req: Request) {
    const denegado = verificarCron(req);
    if (denegado) return denegado;

    if (!process.env.GEMINI_API_KEY) {
        return NextResponse.json({ success: false, error: 'GEMINI_API_KEY no configurado' }, { status: 500 });
    }

    try {
        const desde = new Date(Date.now() - 7 * 86400000);
        const sedes = await prisma.headquarters.findMany({
            where: { isActive: true }, select: { id: true, name: true },
        });
        const resultados: Record<string, unknown>[] = [];

        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash',
            generationConfig: { responseMimeType: 'application/json' },
        });

        for (const sede of sedes) {
            const [notas, curaciones, cambios] = await Promise.all([
                prisma.dailyLog.findMany({
                    where: {
                        patient: { headquartersId: sede.id },
                        createdAt: { gte: desde },
                        notes: { not: null },
                    },
                    select: {
                        id: true, notes: true,
                        patient: {
                            select: {
                                id: true, dietTexture: true, dietDiabetic: true, dietRenal: true,
                                careModality: true, needsDialysis: true, requiresPosturalChanges: true,
                                intakeData: { select: { mobilityLevel: true, allergies: true } },
                            },
                        },
                    },
                    orderBy: { createdAt: 'desc' },
                    take: TEXTOS_POR_TANDA * MAX_TANDAS,
                }),
                prisma.ulcerLog.findMany({
                    where: { ulcer: { patient: { headquartersId: sede.id } }, createdAt: { gte: desde } },
                    select: { id: true, notes: true, ulcer: { select: { patientId: true, bodyLocation: true, stage: true } } },
                    take: 30,
                }),
                prisma.cambioDeCondicion.findMany({
                    where: { headquartersId: sede.id, reportadoAt: { gte: desde } },
                    select: { id: true, descripcion: true, area: true, patientId: true },
                    take: 30,
                }),
            ]);

            const textos: TextoParaLeer[] = [
                ...notas
                    .filter(n => (n.notes ?? '').trim().length > 40)
                    .map(n => ({
                        fuente: `DailyLog:${n.id}`,
                        patientId: n.patient.id,
                        contexto: contextoDe(n.patient),
                        texto: (n.notes ?? '').trim(),
                    })),
                ...curaciones
                    .filter(c => (c.notes ?? '').trim().length > 40)
                    .map(c => ({
                        fuente: `UlcerLog:${c.id}`,
                        patientId: c.ulcer.patientId,
                        contexto: `úlcera en ${c.ulcer.bodyLocation}, estadio ${c.ulcer.stage}`,
                        texto: c.notes.trim(),
                    })),
                ...cambios
                    .filter(c => c.descripcion.trim().length > 40)
                    .map(c => ({
                        fuente: `CambioDeCondicion:${c.id}`,
                        patientId: c.patientId,
                        contexto: `cambio reportado en ${c.area.toLowerCase()}`,
                        texto: c.descripcion.trim(),
                    })),
            ];

            if (textos.length === 0) {
                resultados.push({ sede: sede.name, saltada: 'sin texto libre esta semana' });
                continue;
            }

            let nuevos = 0, repetidos = 0, descartados = 0, leidos = 0;
            const razones: Record<string, number> = {};

            for (let i = 0; i < textos.length && i / TEXTOS_POR_TANDA < MAX_TANDAS; i += TEXTOS_POR_TANDA) {
                const tanda = textos.slice(i, i + TEXTOS_POR_TANDA);
                try {
                    const salida = await model.generateContent(construirPrompt(tanda));
                    const crudo = (salida.response.text() || '{}')
                        .replace(/```json/g, '').replace(/```/g, '').trim();
                    const parsed = JSON.parse(crudo);
                    const { validos, descartados: fuera } = filtrarPropuestas(parsed, tanda);
                    for (const d of fuera) razones[d.razon] = (razones[d.razon] ?? 0) + 1;
                    descartados += fuera.length;
                    const g = await guardarHallazgos(sede.id, validos, tanda);
                    nuevos += g.nuevos; repetidos += g.repetidos;
                    leidos += tanda.length;
                } catch (e) {
                    // Una tanda que falla no tumba las demás.
                    console.error(`[hallazgos-zendi] tanda de ${sede.name}:`, e);
                }
            }

            resultados.push({ sede: sede.name, leidos, nuevos, repetidos, descartados, razones });
        }

        return NextResponse.json({ success: true, sedes: resultados });
    } catch (e) {
        console.error('[cron/hallazgos-zendi]', e);
        return NextResponse.json({ success: false, error: (e as Error).message }, { status: 500 });
    }
}
