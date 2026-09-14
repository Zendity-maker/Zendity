/**
 * EL CALENDARIO SE LLENA SOLO.
 *
 * La pantalla existía, el sincronizador existía, y el calendario llevaba CERO
 * eventos en toda su historia. La causa era que nada llamaba al sincronizador:
 * ni un cron, ni un botón, ni la propia pantalla. Dos piezas correctas sin el
 * cable entre ellas.
 *
 * Cableado el 14-sep-2026 a petición de Andrés.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * TRES FUENTES, Y UNA QUE HASTA AYER NO PODÍA DAR NADA
 *
 *   1. Dosis MISSED de hoy. Esta fuente era estructuralmente imposible: el
 *      cron que materializa las dosis las firmaba con un usuario inexistente,
 *      así que no había ni una fila PENDING que pudiera llegar a MISSED, y
 *      `scheduledTime` estaba nulo en las 26.490 filas. Se arregló esta misma
 *      mañana (commit 23a7d37a), así que a partir de ahora esta fuente empieza
 *      a producir de verdad.
 *   2. Tickets de triage HIGH/CRITICAL abiertos.
 *   3. Revisiones de PAI vencidas o de los próximos siete días.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * UN CALENDARIO QUE SOLO ACUMULA SE CONVIERTE EN RUIDO
 *
 * Por eso esto también CIERRA. Un evento de triage cuyo ticket ya se resolvió
 * deja de estar programado. Sin esa parte, en tres meses el calendario sería
 * la alarma de limpieza otra vez: 280 avisos que nadie puede apagar trabajando.
 */
import { prisma } from '@/lib/prisma';
import { todayStartAST } from '@/lib/dates';

export interface ResultadoSync {
    creados: number;
    cerrados: number;
    detalle: string[];
}

export async function sincronizarCalendario(hqId: string): Promise<ResultadoSync> {
    const ahora = new Date();
    const detalle: string[] = [];
    let cerrados = 0;

    /**
     * El día, en hora de Puerto Rico.
     *
     * Antes era `new Date(now.getFullYear(), now.getMonth(), now.getDate())`,
     * que en Vercel se evalúa en UTC: la ventana de "hoy" empezaba a las 8 de
     * la noche de ayer, hora de aquí. Es el mismo fallo que ya se corrigió en
     * la materialización de dosis.
     */
    const inicioDeHoy = todayStartAST();
    const finDeHoy = new Date(inicioDeHoy.getTime() + 24 * 3600 * 1000);

    const crearSiNoExiste = async (
        title: string,
        originContext: string,
        data: Parameters<typeof prisma.calendarEvent.create>[0]['data'],
    ) => {
        const existe = await prisma.calendarEvent.findFirst({
            where: { headquartersId: hqId, title, originContext },
            select: { id: true },
        });
        if (existe) return false;
        await prisma.calendarEvent.create({ data });
        detalle.push(title);
        return true;
    };

    // ── 1. Dosis no administradas hoy ────────────────────────────────────
    const dosisPerdidas = await prisma.medicationAdministration.findMany({
        where: {
            status: { in: ['MISSED', 'OMITTED'] },
            scheduledTime: { gte: inicioDeHoy, lt: finDeHoy },
            patientMedication: { patient: { headquartersId: hqId } },
        },
        include: { patientMedication: { include: { patient: true, medication: true } } },
        take: 200,
    });
    for (const d of dosisPerdidas) {
        const title = `Dosis sin administrar: ${d.patientMedication.medication.name} — ${d.patientMedication.patient.name}`;
        await crearSiNoExiste(title, 'EMAR_SYNC', {
            headquartersId: hqId,
            patientId: d.patientMedication.patient.id,
            type: 'REEVALUATION_DUE',
            status: 'SCHEDULED',
            title,
            description: `La dosis de las ${d.scheduledFor ?? '—'} no se administró. Requiere atención clínica.`,
            originContext: 'EMAR_SYNC',
            startTime: d.scheduledTime ?? ahora,
        });
    }

    // ── 2. Triage abierto de prioridad alta ──────────────────────────────
    const tickets = await prisma.triageTicket.findMany({
        where: { headquartersId: hqId, status: 'OPEN', priority: { in: ['HIGH', 'CRITICAL'] } },
        include: { patient: true },
        take: 200,
    });
    for (const t of tickets) {
        const title = `Alerta de triage: ${t.description.substring(0, 60)}`;
        await crearSiNoExiste(title, 'TRIAGE_SYNC', {
            headquartersId: hqId,
            patientId: t.patientId,
            type: 'MEDICAL_APPOINTMENT',
            status: 'SCHEDULED',
            title,
            description: t.description,
            originContext: 'TRIAGE_SYNC',
            startTime: t.createdAt,
        });
    }

    /**
     * Y se cierran los de triage cuyo ticket ya no está abierto. Es la mitad
     * que faltaba: sin esto el calendario solo crece, y un calendario que solo
     * crece deja de mirarse — que es exactamente lo que le pasó a la alarma de
     * limpieza con sus 280 avisos idénticos.
     */
    const abiertos = new Set(tickets.map(t => `Alerta de triage: ${t.description.substring(0, 60)}`));
    const eventosTriage = await prisma.calendarEvent.findMany({
        where: { headquartersId: hqId, originContext: 'TRIAGE_SYNC', status: 'SCHEDULED' },
        select: { id: true, title: true },
        take: 500,
    });
    const aCerrar = eventosTriage.filter(e => !abiertos.has(e.title)).map(e => e.id);
    if (aCerrar.length > 0) {
        const r = await prisma.calendarEvent.updateMany({
            where: { id: { in: aCerrar } },
            data: { status: 'COMPLETED' },
        });
        cerrados += r.count;
    }

    // ── 3. Revisiones de PAI ─────────────────────────────────────────────
    const planes = await prisma.lifePlan.findMany({
        where: {
            patient: { headquartersId: hqId, status: 'ACTIVE' },
            nextReview: { lte: new Date(ahora.getTime() + 7 * 24 * 3600 * 1000) },
        },
        include: { patient: true },
        take: 200,
    });
    for (const p of planes) {
        if (!p.nextReview) continue;
        const title = `Revisión de PAI: ${p.patient.name}`;
        await crearSiNoExiste(title, 'PAI_SYNC', {
            headquartersId: hqId,
            patientId: p.patient.id,
            type: 'REEVALUATION_DUE',
            status: 'SCHEDULED',
            title,
            description: `Revisión del Plan de Atención Individualizado. Estado actual: ${p.status}.`,
            originContext: 'PAI_SYNC',
            startTime: p.nextReview,
        });
    }

    return { creados: detalle.length, cerrados, detalle };
}
