/**
 * CÓMO SE TOMA UN MEDICAMENTO
 * ───────────────────────────
 * Frecuencia y días, que hasta hoy no tenían dónde vivir.
 *
 * `PatientMedication.frequency` existe desde siempre y NINGÚN formulario lo
 * pide: el de /med pide residente, medicamento, horario y duración del pack. Así
 * que lo que no cabía —"semanal", "por razón necesaria"— se escribía dentro del
 * texto del horario:
 *
 *     scheduleTimes = "08:00 AM (Semanal)"
 *     scheduleTimes = "PRN"
 *
 * Y el agrupador de packs de la tableta parsea ese texto con un regex estricto
 * (`^HH:MM AM/PM$`). Lo que no encaja se descarta con un `return` silencioso.
 *
 * RESULTADO MEDIDO EL 05-sep-2026: 17 de 261 medicamentos activos de Cupey con
 * CERO administraciones desde que se recetaron. No es que no se dieran: es que
 * nunca llegaron a la pantalla de nadie. Entre ellos Warfarin 1mg —un
 * anticoagulante— y Alendronate semanal en dos residentes.
 *
 * Quien escribió "(Semanal)" hizo lo correcto con lo que tenía: avisar a un
 * humano. El precio fue que el sistema dejó de verlo. Otra vez lo mismo — el
 * dato existe, no tiene campo, se va al texto libre y deja de contar.
 */

export const FRECUENCIAS = [
    {
        codigo: 'DIARIO', etiqueta: 'Todos los días',
        ayuda: 'Aparece en el pack de su hora, todos los días.',
    },
    {
        codigo: 'SEMANAL', etiqueta: 'Solo ciertos días',
        ayuda: 'Aparece únicamente los días marcados. Para semanales y pautas alternas.',
    },
    {
        codigo: 'PRN', etiqueta: 'Por razón necesaria',
        ayuda: 'No aparece en ningún pack. Se registra cuando se da, con su motivo, y después se pregunta si hizo efecto.',
    },
] as const;

export type Frecuencia = typeof FRECUENCIAS[number]['codigo'];

const CODIGOS = new Set(FRECUENCIAS.map(f => f.codigo as string));

export function esFrecuenciaValida(f: string | null | undefined): boolean {
    return !!f && CODIGOS.has(f);
}

/** 0 = domingo … 6 = sábado, igual que Date.getDay(). */
export const DIAS = [
    { n: 0, corto: 'D', largo: 'Domingo' },
    { n: 1, corto: 'L', largo: 'Lunes' },
    { n: 2, corto: 'M', largo: 'Martes' },
    { n: 3, corto: 'X', largo: 'Miércoles' },
    { n: 4, corto: 'J', largo: 'Jueves' },
    { n: 5, corto: 'V', largo: 'Viernes' },
    { n: 6, corto: 'S', largo: 'Sábado' },
];

export function diasValidos(dias: unknown): number[] {
    if (!Array.isArray(dias)) return [];
    return [...new Set(dias.map(Number).filter(d => Number.isInteger(d) && d >= 0 && d <= 6))].sort();
}

export function etiquetaDias(dias: number[]): string {
    if (dias.length === 0 || dias.length === 7) return 'todos los días';
    return dias.map(d => DIAS[d]?.largo ?? '?').join(', ');
}

/**
 * ¿Toca hoy este medicamento?
 *
 * Un PRN no toca NUNCA por agenda: se da cuando hace falta y se registra por su
 * propio camino. Antes tampoco aparecía —porque su horario no parseaba— pero por
 * accidente y sin que nadie lo supiera; ahora es una decisión.
 */
export function tocaHoy(
    med: { frequency?: string | null; scheduleDays?: number[] | null },
    hoy: Date = new Date(),
): boolean {
    if ((med.frequency ?? '').toUpperCase().includes('PRN')) return false;
    const dias = med.scheduleDays ?? [];
    if (dias.length === 0) return true; // sin días marcados = todos
    return dias.includes(hoy.getDay());
}

/**
 * ¿Este medicamento llega de verdad a la pantalla de alguien?
 *
 * Replica la condición del agrupador de packs: al menos una hora que parsee.
 * Un PRN no necesita hora — tiene su propio flujo. Cualquier otro sin una sola
 * hora legible es un medicamento invisible.
 */
const HORA = /^(\d{1,2}):(\d{2})\s*(AM|PM)?$/;

export function tieneHoraLegible(scheduleTimes: string | null | undefined): boolean {
    if (!scheduleTimes) return false;
    return scheduleTimes.split(',').some(t => {
        const m = t.trim().toUpperCase().match(HORA);
        if (!m) return false;
        const h = parseInt(m[1], 10), min = parseInt(m[2], 10);
        return h >= 0 && h <= 23 && min >= 0 && min <= 59;
    });
}

export function llegaAlPiso(med: { frequency?: string | null; scheduleTimes?: string | null }): boolean {
    if ((med.frequency ?? '').toUpperCase().includes('PRN')) return true; // vive en el flujo PRN
    return tieneHoraLegible(med.scheduleTimes);
}
