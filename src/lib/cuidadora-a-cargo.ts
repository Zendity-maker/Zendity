/**
 * ¿QUIÉN ESTÁ A CARGO DE ESTE RESIDENTE AHORA MISMO?
 * ─────────────────────────────────────────────────
 * Lo pidió Andrés el 04-sep-2026: al registrarse una visita en recepción, que
 * le llegue el aviso a la cuidadora del residente, no solo a supervisión.
 *
 * La cadena ya existía entera y no hubo que inventar nada:
 *
 *     Patient.colorGroup          (poblado en los 34 residentes de Cupey)
 *        → computeShiftCoverage   (turno actual en hora de Puerto Rico)
 *        → activeCaregivers       quien REALMENTE inició turno en la tablet
 *        + activeOverrides        residentes reasignados a otra cuidadora
 *
 * SE PREFIERE QUIEN ESTÁ, NO QUIEN DEBERÍA ESTAR. Una cuidadora con sesión
 * abierta está físicamente en el piso; una del horario publicado puede haber
 * faltado. Por eso el orden es: reasignación explícita → sesión activa →
 * horario publicado → nadie.
 *
 * Y CUANDO NO SE RESUELVE, NO SE CALLA. Devolver una lista vacía y no avisar a
 * nadie sería lo peor: la visita entra y el piso no se entera. Quien llama
 * sigue notificando a supervisión, que es quien lo recibe hoy — el aviso baja
 * de precisión, no desaparece.
 */
import { prisma } from '@/lib/prisma';
import { computeShiftCoverage, inferShiftTypeFromAST } from '@/lib/shift-coverage';
import { clinicalDayCalendarUTCRange } from '@/lib/dates';

export interface CuidadoraACargo {
    userId: string;
    name: string;
    /** Cómo se resolvió, para poder explicarlo en un log o en pantalla. */
    via: 'REASIGNACION' | 'SESION_ACTIVA' | 'HORARIO';
}

export async function cuidadorasDeResidente(
    hqId: string,
    patientId: string,
): Promise<CuidadoraACargo[]> {
    const paciente = await prisma.patient.findFirst({
        where: { id: patientId, headquartersId: hqId },
        select: { colorGroup: true },
    });
    if (!paciente || !paciente.colorGroup || paciente.colorGroup === 'UNASSIGNED') return [];

    const color = paciente.colorGroup;
    const shiftType = inferShiftTypeFromAST();
    const cobertura = await computeShiftCoverage({ hqId, shiftType });

    // 1. Reasignación explícita de ESTE residente. Manda sobre todo lo demás:
    //    alguien decidió a mano que hoy lo lleva otra persona.
    const reasignado = cobertura.activeOverrides.filter(o => o.patientId === patientId);
    if (reasignado.length > 0) {
        return reasignado.map(o => ({ userId: o.caregiverId, name: o.caregiverName, via: 'REASIGNACION' as const }));
    }

    // 2. Quien tiene sesión abierta cubriendo ese color.
    const enPiso = cobertura.activeCaregivers.filter(c => c.color === color);
    if (enPiso.length > 0) {
        return enPiso.map(c => ({ userId: c.userId, name: c.name, via: 'SESION_ACTIVA' as const }));
    }

    // 3. Nadie ha iniciado turno todavía: el horario publicado de hoy.
    const { start, end } = clinicalDayCalendarUTCRange();
    const programadas = await prisma.scheduledShift.findMany({
        where: {
            date: { gte: start, lte: end },
            shiftType: shiftType as never,
            colorGroup: color,
            isAbsent: false,
            schedule: { headquartersId: hqId, status: 'PUBLISHED' },
        },
        select: { userId: true, user: { select: { name: true } } },
    });
    return programadas.map(s => ({ userId: s.userId, name: s.user?.name ?? '', via: 'HORARIO' as const }));
}
