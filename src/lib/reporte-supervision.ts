/**
 * EL REPORTE SEMANAL DE SUPERVISIÓN
 * ─────────────────────────────────
 * El piso y las cuidadoras. Todo lo clínico va en el de enfermería.
 *
 * POR QUÉ SON DOS Y NO UNO. El panel del supervisor se decidió que fuera piso:
 * lo resoluble en una o dos horas. Mandarle a una supervisora el conteo de
 * planes de cuido sin firmar es darle un número sobre el que no puede hacer
 * nada, y un reporte con cosas ajenas se lee una vez y se archiva. La primera
 * versión de esto iba a las cuatro personas con todo mezclado; esto lo corrige.
 *
 * ORDENADO POR LO QUE PASA SI NADIE LO MIRA:
 *
 *   1. Lo que dejó un hueco en el expediente  — turnos y relevos sin cerrar
 *   2. Lo que no se hizo a tiempo             — rotaciones tarde, vitales vencidos
 *   3. Lo que espera tu decisión              — observaciones de personal, alertas
 *   4. Lo que se movió esta semana            — el trabajo registrado
 *   5. Cobertura                              — quién cubrió, cuánto se registró
 *
 * EL BLOQUE 5 NO ES UNA NOTA. Enseña volumen —baños, comidas, rotaciones,
 * vitales— sin puntuar a nadie. Un supervisor necesita saber si el turno del
 * jueves registró la mitad que el resto; lo que hace con eso es suyo. Convertir
 * ese número en un ranking es lo que produce datos falsos: la regla del hogar
 * es hacer el dato veraz, no crear una métrica que castigue la conducta.
 */
import { prisma } from '@/lib/prisma';
import type { ReporteSemanal, BloqueReporte } from '@/lib/reporte-enfermeria';

/** Desde aquí, una sesión abierta dejó de ser "todavía en turno". */
const DIAS_SESION_ABIERTA = 14;

export async function construirReporteSupervision(sedeId: string, sedeNombre: string): Promise<ReporteSemanal> {
    const ahora = new Date();
    const desde = new Date(ahora.getTime() - 7 * 86400000);
    const desde14 = new Date(ahora.getTime() - DIAS_SESION_ABIERTA * 86400000);
    const hoy0 = new Date(ahora); hoy0.setHours(0, 0, 0, 0);

    const [
        activos,
        sesionesAbiertas, sesionesSinRelevo, relevosPendientes,
        rotacionesTarde, vitalesVencidos, tareasFallidas,
        obsBorrador, obsRespondidas, alertasSinResolver,
        relevosAceptados, banos, comidas, rotaciones, vitalesTomados,
        turnos,
    ] = await Promise.all([
        prisma.patient.count({ where: { headquartersId: sedeId, status: 'ACTIVE' } }),

        // ── 1 ──
        prisma.shiftSession.findMany({
            where: {
                caregiver: { headquartersId: sedeId },
                startTime: { gte: desde14, lt: hoy0 },
                actualEndTime: null,
            },
            select: { startTime: true, caregiver: { select: { name: true } } },
            orderBy: { startTime: 'asc' },
        }),
        prisma.shiftSession.findMany({
            where: {
                caregiver: { headquartersId: sedeId },
                startTime: { gte: desde14, lt: hoy0 },
                actualEndTime: { not: null },
                handoverCompleted: false,
            },
            select: { startTime: true, caregiver: { select: { name: true } } },
            orderBy: { startTime: 'asc' },
        }),
        prisma.shiftHandover.count({ where: { headquartersId: sedeId, status: 'PENDING' } }),

        // ── 2 ──
        prisma.posturalChangeLog.count({
            where: { patient: { headquartersId: sedeId }, isComplianceAlert: true, performedAt: { gte: desde } },
        }),
        prisma.vitalsOrder.count({
            where: { headquartersId: sedeId, status: 'EXPIRED', orderedAt: { gte: desde } },
        }),
        prisma.fastActionAssignment.count({
            where: {
                status: 'FAILED', createdAt: { gte: desde },
                NOT: { description: { startsWith: '[NOTA]' } },
            },
        }),

        // ── 3 ──
        prisma.incidentReport.findMany({
            where: { headquartersId: sedeId, status: 'DRAFT' },
            select: { createdAt: true, employee: { select: { name: true } } },
        }),
        prisma.incidentReport.findMany({
            where: { headquartersId: sedeId, status: 'EXPLANATION_RECEIVED' },
            select: { createdAt: true, employee: { select: { name: true } } },
        }),
        prisma.dailyLog.findMany({
            where: {
                patient: { headquartersId: sedeId, status: 'ACTIVE' },
                isClinicalAlert: true, isResolved: false, createdAt: { gte: desde },
            },
            select: { createdAt: true, patient: { select: { name: true } } },
            orderBy: { createdAt: 'asc' },
        }),

        // ── 4 ──
        prisma.shiftHandover.count({ where: { headquartersId: sedeId, acceptedAt: { gte: desde } } }),
        prisma.bathLog.count({ where: { patient: { headquartersId: sedeId }, timeLogged: { gte: desde } } }),
        prisma.mealLog.count({ where: { patient: { headquartersId: sedeId }, timeLogged: { gte: desde } } }),
        prisma.posturalChangeLog.count({ where: { patient: { headquartersId: sedeId }, performedAt: { gte: desde } } }),
        prisma.vitalSigns.count({ where: { patient: { headquartersId: sedeId }, createdAt: { gte: desde } } }),

        // ── 5 ──
        prisma.shiftSession.count({ where: { caregiver: { headquartersId: sedeId }, startTime: { gte: desde } } }),
    ]);

    const dias = (d: Date) => Math.floor((ahora.getTime() - d.getTime()) / 86400000);

    const bloque1: BloqueReporte = {
        numero: 1,
        titulo: 'Lo que dejó un hueco en el expediente',
        consecuencia: 'Un turno sin cerrar o un relevo sin firmar es cuidado que ocurrió y no consta.',
        lineas: [
            {
                texto: 'Turnos abiertos que nunca se cerraron',
                casos: sesionesAbiertas.map(s => `${s.caregiver.name.trim()} — turno del ${s.startTime.toLocaleDateString('es-PR', { day: '2-digit', month: 'short', timeZone: 'America/Puerto_Rico' })}, ${dias(s.startTime)} días abierto`),
                total: sesionesAbiertas.length,
            },
            {
                texto: 'Turnos cerrados sin dejar relevo',
                casos: sesionesSinRelevo.map(s => `${s.caregiver.name.trim()} — turno del ${s.startTime.toLocaleDateString('es-PR', { day: '2-digit', month: 'short', timeZone: 'America/Puerto_Rico' })}`),
                total: sesionesSinRelevo.length,
            },
            { texto: 'Relevos escritos que nadie aceptó', casos: [], total: relevosPendientes },
        ],
        total: 0,
    };

    const bloque2: BloqueReporte = {
        numero: 2,
        titulo: 'Lo que no se hizo a tiempo',
        consecuencia: 'No es falta de cuidado necesariamente; puede ser falta de manos. El número dice dónde mirar.',
        lineas: [
            { texto: 'Rotaciones posturales fuera de las 2 horas', casos: [], total: rotacionesTarde },
            { texto: 'Órdenes de vitales que vencieron sin tomarse', casos: [], total: vitalesVencidos },
            { texto: 'Tareas rápidas que vencieron sin hacerse', casos: [], total: tareasFallidas },
        ],
        total: 0,
    };

    const bloque3: BloqueReporte = {
        numero: 3,
        titulo: 'Lo que espera tu decisión',
        consecuencia: 'Está parado hasta que alguien decida. Nadie más lo va a mover.',
        lineas: [
            {
                texto: 'Observaciones escritas y sin decidir',
                casos: obsBorrador.map(o => `${o.employee?.name?.trim() ?? 'Empleado'} — ${dias(o.createdAt)} días en borrador`),
                total: obsBorrador.length,
            },
            {
                texto: 'Observaciones que el empleado ya contestó',
                casos: obsRespondidas.map(o => `${o.employee?.name?.trim() ?? 'Empleado'} — ${dias(o.createdAt)} días esperando tu decisión`),
                total: obsRespondidas.length,
            },
            {
                texto: 'Alertas clínicas del piso sin resolver',
                casos: alertasSinResolver.map(a => `${a.patient.name.trim()} — ${dias(a.createdAt)} días sin cerrar`),
                total: alertasSinResolver.length,
            },
        ],
        total: 0,
    };

    const bloque4: BloqueReporte = {
        numero: 4,
        titulo: 'Lo que se movió esta semana',
        consecuencia: 'Lo que sí quedó registrado en los últimos siete días.',
        lineas: [
            { texto: 'Relevos aceptados', casos: [], total: relevosAceptados },
            { texto: 'Baños registrados', casos: [], total: banos },
            { texto: 'Comidas registradas', casos: [], total: comidas },
            { texto: 'Rotaciones registradas', casos: [], total: rotaciones },
            { texto: 'Tomas de vitales', casos: [], total: vitalesTomados },
        ],
        total: 0,
    };

    /**
     * COBERTURA, SIN RANKING. Cuánto se registró por turno, para ver si un turno
     * quedó corto. A propósito NO lleva nombres ni compara personas: en cuanto
     * un número así se vuelve un ranking, deja de medir el cuidado y empieza a
     * medir quién teclea más.
     */
    const registrosPorTurno = turnos > 0
        ? Math.round((banos + comidas + rotaciones + vitalesTomados) / turnos)
        : 0;

    const bloque5: BloqueReporte = {
        numero: 5,
        titulo: 'Cobertura',
        consecuencia: 'Para ver si algún turno quedó corto. No es una nota a nadie.',
        lineas: [
            { texto: 'Turnos trabajados esta semana', casos: [], total: turnos },
            { texto: 'Registros de cuido por turno (promedio)', casos: [], total: registrosPorTurno },
            { texto: 'Residentes activos', casos: [], total: activos },
        ],
        total: 0,
    };

    const bloques = [bloque1, bloque2, bloque3, bloque4, bloque5];
    for (const b of bloques) {
        b.lineas = b.lineas.filter(l => l.total > 0);
        b.total = b.lineas.reduce((n, l) => n + l.total, 0);
    }

    return {
        titulo: 'Reporte semanal de supervisión',
        paraQuien: 'Supervisión y dirección',
        sedeId, sedeNombre,
        generadoAt: ahora, desde,
        residentesActivos: activos,
        bloques,
        // Solo los tres primeros son deuda. El 4 es trabajo hecho y el 5 contexto.
        totalPendiente: bloque1.total + bloque2.total + bloque3.total,
        frentesRevisados: 5,
    };
}
