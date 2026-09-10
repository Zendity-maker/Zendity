/**
 * EL REPORTE SEMANAL DE DIRECCIÓN
 * ───────────────────────────────
 * No repite los otros dos: los lee y dice qué haría con ellos.
 *
 * LO QUE LO HACE DISTINTO ES EL BLOQUE 1. Enfermería y supervisión reciben
 * listas de lo suyo; dirección recibe UN ORDEN. Nueve frentes abiertos a la vez
 * no se atienden por igual, y decidir cuál va primero es trabajo de dirección,
 * no de quien está en el pasillo.
 *
 * LAS RECOMENDACIONES NO LAS ESCRIBE UNA IA, Y ES A PROPÓSITO.
 *
 * Cada una sale de una regla sobre un número medido: "hay un anticoagulante que
 * el sistema nunca pide → esto va primero". Una regla se puede leer, discutir y
 * corregir; un párrafo generado suena igual de convincente esté bien o mal, y
 * eso es exactamente lo que produjo mensajes diciendo que una residente en
 * hospicio estaba activa y participando.
 *
 * Donde la IA sí ayudaría es en LEER —encontrar en el texto libre lo que ninguna
 * regla vigila todavía— no en escribir la conclusión. Ver el comentario al final
 * de este archivo.
 *
 * REGLA DE LA LISTA: cada recomendación tiene un número detrás y un responsable.
 * Sin el número es una opinión; sin el responsable no se mueve.
 */
import { prisma } from '@/lib/prisma';
import type { ReporteSemanal, BloqueReporte, LineaReporte } from '@/lib/reporte-enfermeria';
import { construirReporte } from '@/lib/reporte-enfermeria';
import { construirReporteSupervision } from '@/lib/reporte-supervision';
import { HORAS_PARA_REVISAR_CAMBIO, pasoElCompromiso, horasEsperando } from '@/lib/cambios-de-condicion';

/** Medicamentos cuyo hueco no admite espera. */
const ALTO_RIESGO = /warfarin|coumadin|heparin|apixaban|eliquis|rivaroxaban|xarelto|clopidogrel|plavix|insulin|lantus|humalog|humulin|novolog|levotiroxina|levothyroxine|synthroid|digoxin|litio|lithium|fenitoina|phenytoin/i;

interface Recomendacion {
    /** Qué hacer, en imperativo y en una línea. */
    que: string;
    /** El número que lo justifica. Sin esto sería una opinión. */
    porque: string;
    /** A quién le toca. Sin esto no se mueve. */
    quien: string;
    /** Menor va primero. */
    orden: number;
}

export async function construirReporteDireccion(sedeId: string, sedeNombre: string): Promise<ReporteSemanal> {
    const ahora = new Date();
    const desde = new Date(ahora.getTime() - 7 * 86400000);

    const [enfermeria, supervision, sede, medsInvisibles, ulceras, obsParadas, acuerdos, quejasAbiertas, cambiosSinRevisar] = await Promise.all([
        construirReporte(sedeId, sedeNombre),
        construirReporteSupervision(sedeId, sedeNombre),
        prisma.headquarters.findUnique({
            where: { id: sedeId },
            select: { capacity: true, phone: true, address: true },
        }),
        // Para saber si alguno de los invisibles es de alto riesgo.
        prisma.patientMedication.findMany({
            where: { patient: { headquartersId: sedeId, status: 'ACTIVE' }, isActive: true },
            select: { scheduleTimes: true, frequency: true, medication: { select: { name: true } }, patient: { select: { name: true } } },
        }),
        prisma.pressureUlcer.findMany({
            where: { patient: { headquartersId: sedeId }, resolvedAt: null, status: { not: 'RESOLVED' } },
            select: { stage: true, patient: { select: { name: true } } },
        }),
        prisma.incidentReport.findMany({
            where: { headquartersId: sedeId, status: 'EXPLANATION_RECEIVED' },
            select: { createdAt: true, employee: { select: { name: true } } },
        }),
        prisma.acuerdoSede.findMany({ where: { headquartersId: sedeId }, select: { tipo: true, aceptadoEn: true } }),
        prisma.complaint.count({ where: { patient: { headquartersId: sedeId }, status: 'PENDING' } }),
        // Lo que el piso reporto y nadie ha mirado. Ver HORAS_PARA_REVISAR_CAMBIO.
        prisma.cambioDeCondicion.findMany({
            where: { headquartersId: sedeId, revisadoAt: null },
            select: { reportadoAt: true, area: true, patient: { select: { name: true } } },
            orderBy: { reportadoAt: 'asc' },
        }),
    ]);

    const activos = enfermeria.residentesActivos;
    const totalLinea = (r: ReporteSemanal, codigoTexto: string): number =>
        r.bloques.flatMap(b => b.lineas).find(l => l.texto === codigoTexto)?.total ?? 0;

    /* ── LAS RECOMENDACIONES ────────────────────────────────────────────── */
    const recs: Recomendacion[] = [];

    /**
     * 0. LO QUE EL PISO REPORTO Y NADIE MIRO.
     *
     * Va con orden -1, delante de todo. Medido el 10-sep-2026: de 22 cambios
     * reportados en 30 dias, ONCE seguian sin revisar, con una mediana de 123
     * horas. Y de los once resueltos, diez fueron accionables — cuatro
     * derivados al medico.
     *
     * El piso reporta bien. Lo que se rompe es la otra punta de la cadena, y
     * una cadena rota por el otro lado ensena lo mismo que no tener cadena:
     * quien escribe y no recibe respuesta deja de escribir.
     *
     * Este bloque es la consecuencia del compromiso de 48 horas. Sin algo que
     * llegue a direccion, un compromiso es una intencion.
     */
    const cambiosVencidos = cambiosSinRevisar.filter(c => pasoElCompromiso(c.reportadoAt));
    if (cambiosVencidos.length > 0) {
        const masViejo = Math.floor(horasEsperando(cambiosVencidos[0].reportadoAt) / 24);
        recs.push({
            que: `Revisar los ${cambiosVencidos.length} cambios del piso que pasaron las ${HORAS_PARA_REVISAR_CAMBIO} horas`,
            porque: `El más viejo lleva ${masViejo} día${masViejo === 1 ? '' : 's'} esperando. Es lo que alguien vio y todavía nadie ha decidido.`,
            quien: 'Enfermería, en Cambios del piso',
            orden: -1,
        });
    }

    // 1. Un medicamento de alto riesgo que el sistema nunca pide.
    const invisiblesRiesgo = medsInvisibles.filter(m => {
        const esPRN = (m.frequency ?? '').toUpperCase().includes('PRN');
        const legible = (m.scheduleTimes ?? '').split(',').some(t => /^\d{1,2}:\d{2}\s*(AM|PM)?$/i.test(t.trim()));
        return !esPRN && !legible && ALTO_RIESGO.test(m.medication.name);
    });
    if (invisiblesRiesgo.length > 0) {
        recs.push({
            que: 'Corregir hoy el horario de los medicamentos de alto riesgo que no llegan al piso',
            porque: `${invisiblesRiesgo.length}: ${invisiblesRiesgo.slice(0, 3).map(m => `${m.medication.name} de ${m.patient.name.trim()}`).join('; ')}`,
            quien: 'Enfermería, en Med & Zoning',
            orden: 0,
        });
    }

    // 2. Una úlcera de estadio alto sin seguimiento.
    const graves = ulceras.filter(u => u.stage >= 3);
    const ulcerasVencidas = totalLinea(enfermeria, 'Úlceras sin curación registrada');
    if (graves.length > 0 && ulcerasVencidas > 0) {
        recs.push({
            que: 'Registrar las curaciones de las úlceras de estadio 3 o 4',
            porque: `${graves.length} de estadio alto (${graves.map(u => u.patient.name.trim()).join(', ')}), y ${ulcerasVencidas} sin nota reciente`,
            quien: 'Enfermería, desde Rotación / UPP',
            orden: 1,
        });
    }

    // 3. Observaciones de personal paradas más de un mes.
    const paradas = obsParadas.filter(o => (ahora.getTime() - o.createdAt.getTime()) / 86400000 > 30);
    if (paradas.length > 0) {
        const mas = Math.max(...paradas.map(o => Math.floor((ahora.getTime() - o.createdAt.getTime()) / 86400000)));
        recs.push({
            que: 'Decidir las observaciones de personal que el empleado ya contestó',
            porque: `${paradas.length} parada(s), la más vieja lleva ${mas} días`,
            quien: 'Dirección o Recursos Humanos',
            orden: 2,
        });
    }

    // 4. La dieta que no refleja el diagnóstico. La cocina prepara desde ese campo.
    const dietas = totalLinea(enfermeria, 'La dieta prescrita no refleja el diagnóstico');
    if (dietas > 0) {
        recs.push({
            que: 'Revisar con enfermería las dietas que no coinciden con el diagnóstico',
            porque: `${dietas} residentes; la cocina arma las bandejas desde ese campo`,
            quien: 'Enfermería con cocina',
            orden: 3,
        });
    }

    // 5. Relevos sin aceptar: es continuidad de cuidado, no papeleo.
    const relevos = totalLinea(supervision, 'Relevos escritos que nadie aceptó');
    if (relevos >= 20) {
        recs.push({
            que: 'Averiguar por qué no se aceptan los relevos de turno',
            porque: `${relevos} sin aceptar — a este volumen no es olvido, es que algo del flujo no funciona`,
            quien: 'Supervisión',
            orden: 4,
        });
    }

    // 6. Órdenes de vitales que vencen en masa.
    const vitales = totalLinea(supervision, 'Órdenes de vitales que vencieron sin tomarse');
    if (vitales >= 100) {
        recs.push({
            que: 'Revisar cuántas órdenes de vitales se generan al día',
            porque: `${vitales} vencieron esta semana — cuando vence esa cantidad, o sobran órdenes o faltan manos`,
            quien: 'Dirección con supervisión',
            orden: 5,
        });
    }

    // 7. Lo que la sede debe de sí misma.
    const faltaSede = [!sede?.phone && 'teléfono', !sede?.address && 'dirección'].filter(Boolean) as string[];
    if (faltaSede.length > 0) {
        recs.push({
            que: `Completar los datos de la sede: ${faltaSede.join(' y ')}`,
            porque: 'Sin esto la puesta en marcha sigue marcando datos faltantes y no salen en los documentos',
            quien: 'Dirección, en Zéndity → Sedes',
            orden: 6,
        });
    }

    const sinBAA = !acuerdos.find(a => /baa/i.test(a.tipo) && a.aceptadoEn);
    if (sinBAA) {
        recs.push({
            que: 'Aceptar el acuerdo de socio comercial (BAA)',
            porque: 'Es requisito legal para procesar información clínica de residentes',
            quien: 'Dirección',
            orden: 7,
        });
    }

    if (quejasAbiertas > 0) {
        recs.push({
            que: 'Atender los señalamientos de familia sin resolver',
            porque: `${quejasAbiertas} abiertos`,
            quien: 'Dirección',
            orden: 8,
        });
    }

    recs.sort((a, b) => a.orden - b.orden);

    const bloque1: BloqueReporte = {
        numero: 1,
        titulo: 'Lo que decidiría esta semana',
        consecuencia: 'En orden. Cada línea lleva el número que la justifica y de quién es.',
        lineas: recs.map((r): LineaReporte => ({
            texto: r.que,
            casos: [`Por qué: ${r.porque}`, `Le toca a: ${r.quien}`],
            total: 1,
        })),
        total: 0,
    };

    /* ── Los otros dos, en titulares ────────────────────────────────────── */
    const titular = (r: ReporteSemanal, numero: number, titulo: string, consecuencia: string): BloqueReporte => ({
        numero, titulo, consecuencia,
        lineas: r.bloques
            .filter(b => b.numero <= 3 && b.total > 0)
            .map((b): LineaReporte => ({ texto: b.titulo, casos: [], total: b.total })),
        total: 0,
    });

    const bloque2 = titular(enfermeria, 2, 'Enfermería', 'El detalle va en su propio reporte, que sale el mismo lunes.');
    const bloque3 = titular(supervision, 3, 'Piso y personal', 'El detalle va en el reporte de supervisión.');

    /* ── La sede ───────────────────────────────────────────────────────── */
    const bloque4: BloqueReporte = {
        numero: 4,
        titulo: 'La sede',
        consecuencia: 'Lo que no depende del piso.',
        lineas: [
            { texto: 'Residentes activos', casos: sede?.capacity ? [`${Math.round((activos / sede.capacity) * 100)}% de una capacidad de ${sede.capacity}`] : [], total: activos },
            { texto: 'Señalamientos de familia sin resolver', casos: [], total: quejasAbiertas },
            { texto: 'Datos de la sede sin completar', casos: faltaSede, total: faltaSede.length },
            { texto: 'Acuerdos sin aceptar', casos: sinBAA ? ['BAA — acuerdo de socio comercial'] : [], total: sinBAA ? 1 : 0 },
        ],
        total: 0,
    };

    /* ── Lo que se movió, sumando los dos ──────────────────────────────── */
    const movEnf = enfermeria.bloques.find(b => b.numero === 4);
    const movSup = supervision.bloques.find(b => b.numero === 4);
    const bloque5: BloqueReporte = {
        numero: 5,
        titulo: 'Lo que se movió esta semana',
        consecuencia: 'Trabajo registrado en los últimos siete días, de los dos frentes.',
        // Los dos reportes cuentan "Relevos aceptados", que es la misma cosa
        // mirada desde dos sitios. Sumarla dos veces seria inventar trabajo.
        lineas: (() => {
            const vistas = new Map<string, LineaReporte>();
            for (const l of [...(movEnf?.lineas ?? []), ...(movSup?.lineas ?? [])]) {
                if (!vistas.has(l.texto)) vistas.set(l.texto, l);
            }
            return [...vistas.values()].sort((a, b) => b.total - a.total);
        })(),
        total: 0,
    };

    /* ── Lo que Zendi encontró que le falta al sistema ─────────────────── */
    /**
     * ESTO NO ES TRABAJO DEL HOGAR. Es el backlog de Zéndity.
     *
     * Zendi lee las notas de turno cada lunes y encuentra sitios donde alguien
     * escribió a mano algo que debería tener su campo. Cuando dirección lo
     * confirma, ese hueco pasa a ser una decisión de producto — y hasta hoy se
     * marcaba y desaparecía de la pantalla, así que la lista no vivía en ningún
     * sitio donde alguien fuera a leerla al decidir qué construir.
     *
     * Solo salen los CONFIRMADOS que todavía no se han construido: al marcarlos
     * CONSTRUIDO dejan de contar. Una lista que solo crece se ignora.
     *
     * Va en el reporte de dirección y no en los otros dos a propósito: una
     * enfermera no puede hacer nada con "falta un campo para la saturación de
     * oxígeno", y contárselo es gastar la media hora que va a prestar.
     */
    const huecos = await prisma.hallazgoZendi.findMany({
        where: { headquartersId: sedeId, estado: 'CONFIRMADO', tipo: 'SIN_CAMPO' },
        orderBy: { revisadoAt: 'asc' },
        select: { sugerencia: true, resumen: true, revisadoAt: true },
        take: 30,
    });
    const bloque6: BloqueReporte = {
        numero: 6,
        titulo: 'Huecos del sistema que confirmaste',
        consecuencia: 'Zéndity los tiene pendientes de construir. No es trabajo del hogar.',
        lineas: huecos.length ? [{
            texto: 'Confirmados y sin construir',
            casos: huecos.map(h => {
                const dias = h.revisadoAt ? Math.floor((ahora.getTime() - h.revisadoAt.getTime()) / 86400000) : null;
                return `${(h.sugerencia || h.resumen).trim()}${dias !== null ? ` — confirmado hace ${dias} día${dias === 1 ? '' : 's'}` : ''}`;
            }),
            total: huecos.length,
        }] : [],
        total: 0,
    };

    const bloques = [bloque1, bloque2, bloque3, bloque4, bloque5, bloque6];
    for (const b of bloques) {
        b.lineas = b.lineas.filter(l => l.total > 0);
        b.total = b.lineas.reduce((n, l) => n + l.total, 0);
    }

    return {
        titulo: 'Reporte semanal de dirección',
        paraQuien: 'Dirección',
        sedeId, sedeNombre,
        generadoAt: ahora, desde,
        residentesActivos: activos,
        bloques,
        // Para dirección lo pendiente es el número de DECISIONES, no la suma de
        // todo: sumar 114 y 368 daría un número que no significa nada.
        totalPendiente: recs.length,
        frentesRevisados: 6,
    };
}
