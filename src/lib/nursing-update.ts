/**
 * Borradores de actualización clínica a la familia.
 *
 * Antes esto vivía dentro del endpoint de rotación: Zendi elegía un residente
 * por turno y le empujaba la tarjeta a quien abriera /care. Celia —la enfermera
 * del hogar— tiene CERO turnos abiertos en /care en 96 dias: trabaja desde el
 * expediente del residente, donde entra 116 veces y saca el historial 372. Por
 * eso solo llegaron a existir 2 actualizaciones en toda la historia, ambas sin
 * enviar.
 *
 * El modelo se invierte: ya no se elige por rotacion, sino que la enfermera
 * pide el borrador para el residente que TIENE DELANTE, en el momento en que
 * acaba de revisar su expediente y sabe qué decirle a la familia.
 *
 * El borrador se apoya en datos clinicos reales de la semana. Se generan dos
 * opciones como punto de partida, pero quien envia puede editarlas: el texto
 * final se guarda aparte de lo que propuso Zendi, asi que siempre se puede
 * saber si una persona lo cambió.
 */
import { prisma } from '@/lib/prisma';

export interface BorradorClinico {
    opcion1: string;
    opcion2: string;
    contexto: string;
}

/** Reúne el cuadro clínico de la semana en texto legible para el prompt. */
async function contextoClinico(patientId: string) {
    const tresDias = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const semana = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const patient = await prisma.patient.findUnique({
        where: { id: patientId },
        select: {
            id: true,
            name: true,
            status: true,
            headquartersId: true,
            vitalSigns: {
                orderBy: { createdAt: 'desc' },
                take: 1,
                where: { createdAt: { gte: tresDias } },
            },
            dailyLogs: { orderBy: { createdAt: 'desc' }, take: 2, select: { notes: true } },
            medications: {
                where: { status: 'ACTIVE', isActive: true },
                take: 10,
                select: {
                    administrations: {
                        where: { administeredAt: { gte: semana } },
                        select: { status: true },
                    },
                },
            },
            pressureUlcers: { where: { resolvedAt: null }, take: 1, select: { id: true } },
        },
    });
    return patient;
}

/**
 * Genera dos borradores para un residente concreto.
 *
 * Devuelve null si el residente no existe, no es de esta sede, ya no está en
 * el hogar, o no tiene ningún familiar a quien escribirle. Ese último caso es
 * el mas comun en Cupey: 19 de 33 residentes activos no tienen familiar
 * registrado, asi que no es un error sino el estado normal de la mayoria.
 */
export async function generarBorrador(
    patientId: string,
    hqId: string,
): Promise<{ borrador: BorradorClinico; nombre: string } | null> {
    const patient = await contextoClinico(patientId);
    if (!patient || patient.headquartersId !== hqId) return null;
    if (!['ACTIVE', 'TEMPORARY_LEAVE'].includes(patient.status)) return null;

    const familia = await prisma.familyMember.count({ where: { patientId } });
    if (familia === 0) return null;

    const v = patient.vitalSigns[0];
    const vitalsText = v
        ? `PA ${v.systolic}/${v.diastolic} mmHg, FC ${v.heartRate} bpm, Temp ${v.temperature}°C, SpO₂ ${v.spo2 ?? 'N/D'}%`
        : 'Sin vitales recientes en el sistema';

    const totalMeds = patient.medications.length;
    const administrados = patient.medications.filter(m =>
        m.administrations.some(a => a.status === 'ADMINISTERED')).length;
    const medsText = totalMeds > 0
        ? `${Math.round((administrados / totalMeds) * 100)}% de los medicamentos administrados esta semana (${administrados}/${totalMeds})`
        : 'Sin datos de medicación esta semana';

    const notesText = patient.dailyLogs
        .map(l => l.notes?.trim()).filter(Boolean).slice(0, 2).join('. ')
        || 'Sin notas de turno recientes';

    const uppText = patient.pressureUlcers.length > 0
        ? 'Úlcera bajo control y seguimiento activo del equipo de enfermería'
        : '';

    const contexto = [
        `Vitales: ${vitalsText}`,
        `Medicamentos: ${medsText}`,
        `Notas de turno: ${notesText}`,
        uppText ? `Estado clínico: ${uppText}` : '',
    ].filter(Boolean).join('\n');

    const prompt = `Eres Zendi, asistente clínico de un hogar de envejecientes.
Genera 2 opciones de mensaje corto, cálido y positivo para que la enfermera del hogar envíe a la familia de ${patient.name}.

Datos clínicos reales de esta semana:
${contexto}

REGLAS IMPORTANTES:
- Siempre positivo y tranquilizador
- Incluir UN dato real específico de los datos anteriores
- Máximo 3 oraciones por opción
- Tono cálido, como una enfermera que conoce al residente de hace tiempo
- NO mencionar alertas, problemas ni datos preocupantes
- NO inventar datos que no estén arriba
- Dirigirse a "la familia" o "ustedes" de forma cercana
- En español

Responde SOLO en JSON sin markdown:
{ "optionGen1": "...", "optionGen2": "..." }`;

    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: { responseMimeType: 'application/json' },
    });

    const result = await model.generateContent(prompt);
    const raw = (result.response.text() || '{}').replace(/```json/g, '').replace(/```/g, '').trim();
    const ai = JSON.parse(raw);
    if (!ai.optionGen1 || !ai.optionGen2) throw new Error('Zendi no devolvió opciones válidas.');

    return {
        nombre: patient.name,
        borrador: { opcion1: ai.optionGen1, opcion2: ai.optionGen2, contexto },
    };
}

/** Días desde la última actualización enviada. null si nunca hubo una. */
export async function diasDesdeUltimaActualizacion(patientId: string): Promise<number | null> {
    const ultima = await prisma.zendiNursingUpdate.findFirst({
        where: { patientId, status: 'SENT' },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
    });
    if (!ultima) return null;
    return Math.floor((Date.now() - ultima.createdAt.getTime()) / 86400000);
}

/** Umbrales de la cadencia pedida por Celia: ideal 15 dias, minimo 30. */
export const CADENCIA_IDEAL_DIAS = 15;
export const CADENCIA_MINIMA_DIAS = 30;
