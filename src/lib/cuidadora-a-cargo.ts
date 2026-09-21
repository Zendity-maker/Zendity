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
import { compatibleShiftTypesAt } from '@/lib/ventanas-de-turno';

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

    /**
     * 3. Nadie ha iniciado turno todavía: el horario publicado de HOY.
     *
     * Dos arreglos del 21-sep-2026, y los dos importan más de lo que parece
     * porque esta lista APAGA UNA RED DE SEGURIDAD: en
     * `src/lib/family/appointment-effects.ts:380`, si sale NO vacía se avisa
     * solo a esas personas y se SALTA el escalado a SUPERVISOR/NURSE. Una lista
     * con la gente equivocada es peor que una lista vacía.
     *
     *   · `lt: end`, no `lte: end`. `end` es la medianoche UTC del día
     *     SIGUIENTE, que es exactamente la llave con que se guarda
     *     `ScheduledShift.date`. Con `lte` entraban las pautas de mañana:
     *     medido hoy, 2 de los 3 colores devolvían a alguien de mañana — BLUE
     *     daba a Herminia Mojica, que hoy está OFF, y YELLOW a Joselyn, que hoy
     *     lleva BLUE. Avisar a quien hoy no está es no avisar a nadie.
     *
     *   · `user: activo y no borrado`. Hoy no cambia nada, pero en los próximos
     *     siete días hay dos turnos (25 y 27-sep, MORNING YELLOW) donde sale
     *     Joaneliz Rosario, con la cuenta ya cerrada. Si la lista se compone
     *     SOLO de cuentas cerradas, el aviso no le llega a nadie y además se
     *     apaga el escalado — el peor de los dos mundos.
     */
    const { start, end } = clinicalDayCalendarUTCRange();
    const programadas = await prisma.scheduledShift.findMany({
        where: {
            date: { gte: start, lt: end },
            /**
             * Por VENTANA, no por igualdad. Una pauta FULL_DAY o FULL_NIGHT no
             * entraba nunca: esta consulta compara contra la franja del reloj y
             * los turnos de doce horas no son una franja. Medido el 21-sep: 12
             * de las 63 combinaciones (día × franja × color) de esta semana
             * están cubiertas ÚNICAMENTE por una pauta de doce, las 12 de ROJO.
             * En esas ventanas esto devolvía lista vacía.
             *
             * `compatibleShiftTypesAt()` y no `tiposQueCubren(franja)` porque
             * esta función deriva la franja del reloj: la pregunta que se hace
             * es "quién está EN PISO ahora mismo", y esa la contesta el
             * instante, no el solape de franjas.
             */
            shiftType: { in: compatibleShiftTypesAt() as never[] },
            colorGroup: color,
            isAbsent: false,
            user: { isActive: true, isDeleted: false },
            schedule: { headquartersId: hqId, status: 'PUBLISHED' },
        },
        select: { userId: true, user: { select: { name: true } } },
    });
    return programadas.map(s => ({ userId: s.userId, name: s.user?.name ?? '', via: 'HORARIO' as const }));
}
