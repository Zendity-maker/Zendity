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
import { logWarn } from '@/lib/logger';

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
): Promise<{ borrador: BorradorClinico; nombre: string; aviso: string | null } | null> {
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

    const opciones = await pedirOpciones(patient.name, contexto);
    if (!opciones) {
        // La redaccion se bloqueo incluso sin las notas. No se inventa un
        // mensaje: se devuelve el caso para que la enfermera escriba.
        return {
            nombre: patient.name,
            borrador: { opcion1: '', opcion2: '', contexto },
            aviso: BLOQUEADO_TOTAL,
        };
    }

    return {
        nombre: patient.name,
        borrador: { opcion1: opciones.a, opcion2: opciones.b, contexto },
        aviso: opciones.sinNotas ? BLOQUEADO_NOTAS : null,
    };
}

export const BLOQUEADO_NOTAS =
    'Zendi no pudo redactar a partir de las notas de turno de este residente — '
    + 'hay contenido clínico delicado que no debe salir en un mensaje a la familia. '
    + 'El borrador de abajo se armó solo con los datos objetivos (vitales y medicación). '
    + 'Revisa el expediente antes de enviarlo.';

export const BLOQUEADO_TOTAL =
    'Zendi no redactó este mensaje: el cuadro clínico de este residente esta semana '
    + 'no es material para una redacción automática. La caja de abajo está vacía a '
    + 'propósito — escríbelo tú, o valora si esto amerita una llamada a la familia '
    + 'en vez de un mensaje.';

/**
 * Pide las dos opciones a Zendi, con una segunda pasada sin las notas de turno.
 *
 * POR QUE EXISTE ESTA SEGUNDA PASADA: el 28-ago-2026 el borrador de una
 * residente fallo con "no se pudo generar el borrador" mientras los otros 11 de
 * esa misma tanda salieron bien. Diez de esos once llevaban alertas clinicas
 * fuertes —sangrado, alucinaciones, dolor intenso, rechazo a medicamento— y
 * pasaron sin problema. La unica diferencia de la que fallo era una nota de
 * autoagresion, que el filtro de seguridad del modelo trata aparte de todo lo
 * demas y bloquea.
 *
 * Asi que NO se filtran las alertas por adelantado: son justo el contenido
 * clinico que hace util el mensaje, y quitarlas empobreceria los diez casos que
 * funcionan para arreglar uno. Se intenta con todo; si el modelo se planta, se
 * reintenta con vitales y medicacion —datos objetivos que nunca se bloquean— y
 * se le dice a la enfermera por que el borrador viene mas pobre.
 *
 * Si tambien se bloquea sin notas, se devuelve null: eso ya no es un fallo
 * tecnico que haya que sortear, es una señal de que el caso no es material para
 * un mensaje automatico.
 */
async function pedirOpciones(
    nombre: string,
    contexto: string,
): Promise<{ a: string; b: string; sinNotas: boolean } | null> {
    const sinNotas = contexto
        .split('\n')
        .filter(l => !l.startsWith('Notas de turno:') && !l.startsWith('Estado clínico:'))
        .join('\n');

    for (const [ctx, esFallback] of [[contexto, false], [sinNotas, true]] as const) {
        try {
            const r = await generar(nombre, ctx);
            if (r) return { ...r, sinNotas: esFallback };
        } catch (e: any) {
            // Un bloqueo de seguridad no es un error del sistema: es una
            // respuesta. Se registra sin el texto clinico —eso es PHI y no va
            // a los logs— y se pasa al intento siguiente.
            logWarn('[nursing-update] redaccion bloqueada o invalida', {
                intento: esFallback ? 'sin-notas' : 'completo',
                motivo: e?.message?.slice(0, 120),
            });
        }
    }
    return null;
}

async function generar(nombre: string, contexto: string): Promise<{ a: string; b: string } | null> {
    const prompt = `Eres Zendi, asistente clínico de un hogar de envejecientes.
Genera 2 opciones de mensaje corto, cálido y positivo para que la enfermera del hogar envíe a la familia de ${nombre}.

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
        // Notas de enfermeria de un hogar de envejecientes: sangrado,
        // alucinaciones, agitacion, autoagresion. Es material clinico
        // legitimo, no contenido dañino, y con el umbral por defecto el
        // modelo se planta en casos que la enfermera necesita comunicar.
        // BLOCK_ONLY_HIGH es lo mas permisivo que ofrece la API; no
        // desactiva nada, asi que el fallback de abajo sigue haciendo falta.
        safetySettings: [
            'HARM_CATEGORY_HARASSMENT',
            'HARM_CATEGORY_HATE_SPEECH',
            'HARM_CATEGORY_SEXUALLY_EXPLICIT',
            'HARM_CATEGORY_DANGEROUS_CONTENT',
        ].map(category => ({ category, threshold: 'BLOCK_ONLY_HIGH' })),
    });

    const result = await model.generateContent(prompt);

    // .text() LANZA cuando el candidato viene con finishReason SAFETY, y el
    // prompt entero puede venir bloqueado en promptFeedback. Antes ambos casos
    // subian como excepcion hasta el endpoint y salian como "no se pudo generar
    // el borrador", sin decir nada de por que.
    const bloqueo = result.response?.promptFeedback?.blockReason;
    if (bloqueo) throw new Error(`prompt bloqueado: ${bloqueo}`);

    const raw = (result.response.text() || '{}').replace(/```json/g, '').replace(/```/g, '').trim();
    const ai = JSON.parse(raw);
    if (!ai.optionGen1 || !ai.optionGen2) throw new Error('respuesta sin las dos opciones');

    return { a: ai.optionGen1, b: ai.optionGen2 };
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
