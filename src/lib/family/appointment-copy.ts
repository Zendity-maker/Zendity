/**
 * Copia operativa ramificada por tipo de cita familiar.
 *
 * Vivid coordina las videollamadas y llamadas vía WhatsApp desde el teléfono
 * del hogar. La familia necesita saber exactamente cómo va a recibir la cita:
 * notificación previa con link genérico ya no aplica — el modelo real es
 * "recibirás una llamada/videollamada de WhatsApp a la hora indicada".
 *
 * Usado en TRES superficies:
 *   - ICS DESCRIPTION + LOCATION (calendario nativo del familiar).
 *   - Email de aprobación (caja "Cómo conectar").
 *   - Notificación in-app.
 *
 * Mantener una sola fuente de verdad para que las tres siempre coincidan.
 */

import { AST_TZ_LABEL } from '@/lib/dates';

export interface AppointmentCopyInput {
    apptType: string;
    hqName: string;
    /** Dirección física del hogar — usada solo para LOCATION de visitas presenciales. */
    hqAddress?: string | null;
    /** Número de WhatsApp del hogar — usado solo para VIDEO_CALL/PHONE_CALL si existe. */
    whatsAppNumber?: string | null;
    /** Descripción libre que escribió el familiar al solicitar la cita (opcional). */
    description?: string | null;
}

export interface AppointmentCopy {
    /** Instrucción operativa principal: "cómo conectar". Una línea corta y clara. */
    connectionInstructions: string;
    /** Para LOCATION del ICS y del header del email. */
    location: string;
    /** Composición lista para DESCRIPTION del ICS (incluye nota libre del familiar). */
    icsDescription: string;
}

export function buildAppointmentCopy(input: AppointmentCopyInput): AppointmentCopy {
    const { apptType, hqName, hqAddress, whatsAppNumber, description } = input;
    let connectionInstructions: string;
    let location: string;

    // Sufijo opcional con el número del hogar — solo para canales de WhatsApp y
    // solo cuando la sede tiene el número configurado. Si la sede aún no lo tiene
    // (Mayagüez antes de setup), omitimos la frase entera para no dejar un
    // "Guarda este número:" colgando en blanco.
    const waNumber = whatsAppNumber?.trim();
    const waSuffix = waNumber
        ? ` Guarda este número para reconocer la llamada: ${waNumber}.`
        : '';

    switch (apptType) {
        case 'VIDEO_CALL':
            connectionInstructions =
                `Recibirás una videollamada de WhatsApp desde el teléfono de ${hqName} ` +
                `a la hora indicada (${AST_TZ_LABEL}). Ten WhatsApp listo y mantente disponible.` +
                waSuffix;
            location = 'Videollamada de WhatsApp';
            break;
        case 'PHONE_CALL':
            connectionInstructions =
                `Recibirás una llamada de WhatsApp desde el teléfono de ${hqName} ` +
                `a la hora indicada (${AST_TZ_LABEL}). Ten WhatsApp listo y mantente disponible.` +
                waSuffix;
            location = 'Llamada de WhatsApp';
            break;
        case 'VISIT':
        case 'DIRECTOR_MEETING':
        case 'SPECIAL_OCCASION':
        default:
            connectionInstructions =
                hqAddress
                    ? `Te esperamos en ${hqName} — ${hqAddress}.`
                    : `Te esperamos en ${hqName}.`;
            location = hqAddress || hqName;
            break;
    }

    const userDesc = description?.trim();
    const icsDescription = userDesc
        ? `${connectionInstructions}\n\n${userDesc}`
        : connectionInstructions;

    return { connectionInstructions, location, icsDescription };
}
