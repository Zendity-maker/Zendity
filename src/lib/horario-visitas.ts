/**
 * HORARIO DE VISITAS
 * ──────────────────
 * Vivid: martes a domingo de 10:00 a 18:00. Lunes cerrado.
 *
 * Fuera de ese horario NO se bloquea. Una emergencia no espera al martes, y un
 * kiosco que le cierra la puerta a un hijo que llega de madrugada porque su
 * madre empeoró sería peor que no tener kiosco. Lo que se exige es que un
 * miembro del personal lo autorice con su PIN, y su nombre queda en el asiento.
 *
 * El horario vive en `Headquarters.horarioVisitas` para que cada sede tenga el
 * suyo. Cuando está vacío se usa el de aquí abajo, que es el de Vivid — así una
 * sede recién creada no queda sin regla ninguna.
 *
 * Todo se calcula en hora de Puerto Rico, no en la del servidor: el visitante
 * está parado en el lobby a las 6 de la tarde de PR, no en UTC.
 */
import { prisma } from '@/lib/prisma';

export interface HorarioVisitas {
    /** 0 = domingo … 6 = sábado. */
    dias: number[];
    /** "HH:MM" en hora de Puerto Rico. */
    desde: string;
    hasta: string;
}

/** Martes(2) a domingo(0). Lunes(1) fuera. */
export const HORARIO_POR_DEFECTO: HorarioVisitas = {
    dias: [2, 3, 4, 5, 6, 0],
    desde: '10:00',
    hasta: '18:00',
};

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

function esHorarioValido(x: unknown): x is HorarioVisitas {
    const h = x as HorarioVisitas;
    return !!h && Array.isArray(h.dias) && h.dias.every(d => Number.isInteger(d) && d >= 0 && d <= 6)
        && typeof h.desde === 'string' && /^\d{2}:\d{2}$/.test(h.desde)
        && typeof h.hasta === 'string' && /^\d{2}:\d{2}$/.test(h.hasta);
}

export async function horarioDeSede(hqId: string): Promise<HorarioVisitas> {
    const hq = await prisma.headquarters.findUnique({
        where: { id: hqId },
        select: { horarioVisitas: true },
    });
    return esHorarioValido(hq?.horarioVisitas) ? hq!.horarioVisitas as unknown as HorarioVisitas : HORARIO_POR_DEFECTO;
}

/** Día de la semana y minutos desde medianoche, en hora de Puerto Rico. */
function ahoraEnPR(at: Date): { dia: number; minutos: number } {
    const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Puerto_Rico',
        weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
    });
    const partes = Object.fromEntries(fmt.formatToParts(at).map(p => [p.type, p.value]));
    const dia = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(partes.weekday);
    // A medianoche, `hour` puede venir como "24" en algunas plataformas.
    const hora = parseInt(partes.hour, 10) % 24;
    return { dia, minutos: hora * 60 + parseInt(partes.minute, 10) };
}

function aMinutos(hhmm: string): number {
    const [h, m] = hhmm.split(':').map(n => parseInt(n, 10));
    return h * 60 + m;
}

export interface EstadoHorario {
    dentro: boolean;
    horario: HorarioVisitas;
    /** Frase para la pantalla, ya redactada. */
    explicacion: string;
}

export function evaluarHorario(horario: HorarioVisitas, at: Date = new Date()): EstadoHorario {
    const { dia, minutos } = ahoraEnPR(at);
    const desde = aMinutos(horario.desde);
    const hasta = aMinutos(horario.hasta);

    const diaAbierto = horario.dias.includes(dia);
    const dentro = diaAbierto && minutos >= desde && minutos < hasta;

    const rango = `${horario.desde} a ${horario.hasta}`;
    const explicacion = dentro
        ? ''
        : !diaAbierto
            ? `Hoy ${DIAS[dia]} no hay horario de visitas.`
            : `El horario de visitas es de ${rango}.`;

    return { dentro, horario, explicacion };
}

export async function estadoHorarioDeSede(hqId: string, at?: Date): Promise<EstadoHorario> {
    return evaluarHorario(await horarioDeSede(hqId), at);
}
