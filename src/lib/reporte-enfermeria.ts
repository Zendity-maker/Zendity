/**
 * EL REPORTE SEMANAL DE ENFERMERÍA
 * ────────────────────────────────
 * Lo que arma el correo de los lunes. Todo se calcula contra la realidad; nada
 * se marca a mano como hecho.
 *
 * ESTÁ ORDENADO POR LO QUE PASA SI NADIE LO MIRA, no por categoría:
 *
 *   1. Lo que lleva días esperando     — una úlcera sin curar, un PRN sin respuesta
 *   2. Lo que se salió de norma        — un medicamento invisible, una dieta que no cuadra
 *   3. Lo que espera una firma         — relevos, planes, cambios del piso
 *   4. Lo que se movió esta semana     — lo cerrado, lo nuevo, lo que se arrastra
 *   5. El expediente incompleto        — alergias, familiares, prescriptor
 *
 * LOS TRES PRIMEROS BLOQUES SON DEUDA; el cuarto es el único que puede dar
 * buenas noticias, y va después a propósito. Un reporte que abre con lo que se
 * hizo bien entrena a leer solo el principio.
 *
 * POR QUÉ UN SEMANAL Y NO LA PANTALLA. La pantalla —/care/enfermeria— es una
 * foto de ahora: dice qué hay pendiente, no qué lleva pendiente tres semanas ni
 * qué se resolvió. El bloque 4 es lo que justifica el correo; sin él esto sería
 * la misma foto, por correo, una vez por semana.
 *
 * SIN SNAPSHOTS. El movimiento se calcula con las marcas de tiempo que ya
 * existen —`resolvedAt`, `revisadoAt`, `prnEfectoAt`, `acceptedAt`,
 * `approvedAt`— así que no hay una tabla que mantener ni un estado que se pueda
 * desincronizar. Si el reporte falla un lunes, el siguiente sigue siendo cierto.
 */
import { prisma } from '@/lib/prisma';
import { verificarSede, type Hallazgo, type CodigoChequeo } from '@/lib/verificaciones';
import { HORAS_PARA_EXIGIR_EFECTO } from '@/lib/prn';

const DIAS_SIN_CURACION = 7;

export interface LineaReporte {
    /** Lo que se ve en la línea. Sin nombres cuando el bloque no los lleva. */
    texto: string;
    /** Detalle por caso. Va en el PDF, nunca en el cuerpo del correo. */
    casos: string[];
    total: number;
}

export interface BloqueReporte {
    numero: number;
    titulo: string;
    /** Qué pasa si nadie lo mira. Una línea. */
    consecuencia: string;
    lineas: LineaReporte[];
    total: number;
}

export interface ReporteEnfermeria {
    sedeId: string;
    sedeNombre: string;
    generadoAt: Date;
    desde: Date;
    residentesActivos: number;
    bloques: BloqueReporte[];
    /** Suma de los bloques 1 a 3 — la deuda accionable. */
    totalPendiente: number;
    /** Para poder decir "todo al día" con propiedad y no por falta de datos. */
    frentesRevisados: number;
}

/**
 * Toma un hallazgo de verificaciones.ts y lo convierte en línea del reporte.
 *
 * `codigo` está tipado a propósito: un código mal escrito no fallaría —
 * devolvería cero, y esa línea diría "0" para siempre. Es el mismo patrón que
 * los chequeos existen para cazar. Aquí se caza al compilar.
 */
function desdeHallazgo(hs: Hallazgo[], codigo: CodigoChequeo, texto: string): LineaReporte {
    const h = hs.find(x => x.codigo === codigo);
    return { texto, casos: h?.ejemplos ?? [], total: h?.total ?? 0 };
}

export async function construirReporte(sedeId: string, sedeNombre: string): Promise<ReporteEnfermeria> {
    const ahora = new Date();
    const desde = new Date(ahora.getTime() - 7 * 86400000);
    const limiteCuracion = new Date(ahora.getTime() - DIAS_SIN_CURACION * 86400000);
    const limitePRN = new Date(ahora.getTime() - HORAS_PARA_EXIGIR_EFECTO * 3600000);

    // Los chequeos ya calculan la mitad de esto contra la realidad. Reusarlos
    // evita que el reporte y la pantalla de verificaciones digan cosas distintas.
    const hallazgos = await verificarSede(sedeId);

    const [
        activos, ulceras, prnPendientes, cambiosAbiertos, relevosPendientes, planes,
        // ── movimiento de la semana ──
        curacionesHechas, ulcerasCerradas, cambiosNuevos, cambiosCerrados,
        prnRespondidos, relevosAceptados, planesFirmados,
    ] = await Promise.all([
        prisma.patient.count({ where: { headquartersId: sedeId, status: 'ACTIVE' } }),
        prisma.pressureUlcer.findMany({
            where: { patient: { headquartersId: sedeId }, resolvedAt: null, status: { not: 'RESOLVED' } },
            select: {
                stage: true, bodyLocation: true, identifiedAt: true,
                patient: { select: { name: true, status: true } },
                logs: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
            },
        }),
        prisma.medicationAdministration.findMany({
            where: {
                status: 'ADMINISTERED', prnMotivo: { not: null }, prnEfecto: null,
                createdAt: { gte: limitePRN },
                patientMedication: { patient: { headquartersId: sedeId } },
            },
            select: {
                prnMotivo: true, createdAt: true,
                patientMedication: { select: { patient: { select: { name: true } }, medication: { select: { name: true } } } },
            },
        }),
        prisma.cambioDeCondicion.findMany({
            where: { headquartersId: sedeId, revisadoAt: null },
            select: { area: true, reportadoAt: true, patient: { select: { name: true } } },
            orderBy: { reportadoAt: 'asc' },
        }),
        prisma.shiftHandover.count({ where: { headquartersId: sedeId, status: 'PENDING' } }),
        prisma.patient.findMany({
            where: { headquartersId: sedeId, status: 'ACTIVE' },
            select: { lifePlans: { select: { status: true, emailSentAt: true, nextReview: true } } },
        }),

        prisma.ulcerLog.count({ where: { ulcer: { patient: { headquartersId: sedeId } }, createdAt: { gte: desde } } }),
        prisma.pressureUlcer.count({ where: { patient: { headquartersId: sedeId }, resolvedAt: { gte: desde } } }),
        prisma.cambioDeCondicion.count({ where: { headquartersId: sedeId, reportadoAt: { gte: desde } } }),
        prisma.cambioDeCondicion.count({ where: { headquartersId: sedeId, revisadoAt: { gte: desde } } }),
        prisma.medicationAdministration.count({
            where: { prnEfectoAt: { gte: desde }, patientMedication: { patient: { headquartersId: sedeId } } },
        }),
        prisma.shiftHandover.count({ where: { headquartersId: sedeId, acceptedAt: { gte: desde } } }),
        prisma.lifePlan.count({
            where: { patient: { headquartersId: sedeId }, approvedAt: { gte: desde } },
        }),
    ]);

    /* ── 1. LO QUE LLEVA DÍAS ESPERANDO ─────────────────────────────────── */
    const curacionesVencidas = ulceras
        .map(u => {
            const ultima = u.logs[0]?.createdAt ?? u.identifiedAt;
            const dias = Math.floor((ahora.getTime() - ultima.getTime()) / 86400000);
            const fuera = u.patient.status !== 'ACTIVE' && u.patient.status !== 'TEMPORARY_LEAVE';
            return { u, dias, fuera, vencida: fuera || ultima < limiteCuracion };
        })
        .filter(x => x.vencida)
        .sort((a, b) => b.u.stage - a.u.stage || b.dias - a.dias)
        .map(x => x.fuera
            ? `${x.u.patient.name.trim()} — ${x.u.bodyLocation}, estadio ${x.u.stage}: abierta y el residente ya no está en el hogar`
            : `${x.u.patient.name.trim()} — ${x.u.bodyLocation}, estadio ${x.u.stage}: ${x.dias} días sin curación registrada`);

    const prnSinRespuesta = prnPendientes
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .map(a => `${a.patientMedication.patient.name.trim()} — ${a.patientMedication.medication.name} para "${a.prnMotivo}": falta decir si hizo efecto`);

    const bloque1: BloqueReporte = {
        numero: 1,
        titulo: 'Lo que lleva días esperando',
        consecuencia: 'Cada día que pasa el expediente dice que no se hizo nada, se haya hecho o no.',
        lineas: [
            { texto: 'Úlceras sin curación registrada', casos: curacionesVencidas, total: curacionesVencidas.length },
            { texto: 'Dosis por razón necesaria sin saber si hicieron efecto', casos: prnSinRespuesta, total: prnSinRespuesta.length },
        ],
        total: 0,
    };

    /* ── 2. LO QUE SE SALIÓ DE NORMA ────────────────────────────────────── */
    const bloque2: BloqueReporte = {
        numero: 2,
        titulo: 'Lo que se salió de norma',
        consecuencia: 'Son errores de configuración, no de cuidado. Se arreglan una vez y dejan de sonar.',
        lineas: [
            desdeHallazgo(hallazgos, 'MEDICAMENTO_QUE_NO_LLEGA', 'Medicamentos que no aparecen en ningún pack'),
            desdeHallazgo(hallazgos, 'DIETA_NO_REFLEJA_DIAGNOSTICO', 'La dieta prescrita no refleja el diagnóstico'),
            desdeHallazgo(hallazgos, 'CONTROLADO_SIN_MARCAR', 'Sustancias controladas sin marcar en el catálogo'),
            desdeHallazgo(hallazgos, 'PAI_CONTRADICE_EXPEDIENTE', 'Planes de cuido que contradicen el expediente'),
            desdeHallazgo(hallazgos, 'APROBADO_SIN_EFECTO', 'Cosas marcadas como hechas cuya consecuencia no ocurrió'),
            desdeHallazgo(hallazgos, 'VARIOS_PAI_VIGENTES', 'Residentes con más de un plan de cuido aprobado'),
        ],
        total: 0,
    };

    /* ── 3. LO QUE ESPERA UNA FIRMA ─────────────────────────────────────── */
    const paiPendientes = planes.filter(p => {
        const ap = p.lifePlans.find(l => l.status === 'APPROVED');
        if (p.lifePlans.length === 0) return true;
        if (!ap) return true;
        if (!ap.emailSentAt) return true;
        return !!(ap.nextReview && ap.nextReview < ahora);
    }).length;

    const cambiosViejos = cambiosAbiertos.map(c => {
        const dias = Math.floor((ahora.getTime() - c.reportadoAt.getTime()) / 86400000);
        return `${c.patient.name.trim()} — ${c.area.toLowerCase()}: ${dias === 0 ? 'reportado hoy' : `${dias} día${dias === 1 ? '' : 's'} esperando revisión`}`;
    });

    const bloque3: BloqueReporte = {
        numero: 3,
        titulo: 'Lo que espera una firma',
        consecuencia: 'El trabajo está hecho; falta que alguien lo cierre.',
        lineas: [
            { texto: 'Cambios del piso sin revisar', casos: cambiosViejos, total: cambiosViejos.length },
            { texto: 'Relevos de turno sin aceptar', casos: [], total: relevosPendientes },
            // "Sin resolver" incluye los que faltan por hacer y los vencidos, no
            // solo los que faltan por firmar. SIN_PLAN_DE_CUIDO, en el bloque 5,
            // cuenta los que llevan mas de 30 dias sin ninguno: son subconjuntos
            // distintos a proposito y por eso se enseñan por separado.
            { texto: 'Planes de cuido sin resolver', casos: [], total: paiPendientes },
        ],
        total: 0,
    };

    /* ── 4. LO QUE SE MOVIÓ ESTA SEMANA ─────────────────────────────────── */
    const bloque4: BloqueReporte = {
        numero: 4,
        titulo: 'Lo que se movió esta semana',
        consecuencia: 'Lo que sí se resolvió en los últimos siete días.',
        lineas: [
            { texto: 'Curaciones registradas', casos: [], total: curacionesHechas },
            { texto: 'Úlceras dadas por resueltas', casos: [], total: ulcerasCerradas },
            { texto: 'Cambios del piso reportados', casos: [], total: cambiosNuevos },
            { texto: 'Cambios del piso revisados y cerrados', casos: [], total: cambiosCerrados },
            { texto: 'Dosis PRN con su efecto anotado', casos: [], total: prnRespondidos },
            { texto: 'Relevos aceptados', casos: [], total: relevosAceptados },
            { texto: 'Planes de cuido firmados', casos: [], total: planesFirmados },
        ],
        total: 0,
    };

    /* ── 5. EL EXPEDIENTE INCOMPLETO ────────────────────────────────────── */
    const sinPrescriptor = await prisma.patientMedication.count({
        where: { patient: { headquartersId: sedeId, status: 'ACTIVE' }, isActive: true, prescribedBy: null },
    });

    const bloque5: BloqueReporte = {
        numero: 5,
        titulo: 'El expediente incompleto',
        consecuencia: 'No urge hoy, pero es lo que falta cuando alguien pregunta.',
        lineas: [
            desdeHallazgo(hallazgos, 'ALERGIAS_SIN_DOCUMENTAR', 'Residentes sin información de alergias'),
            desdeHallazgo(hallazgos, 'SIN_CONTACTO_FAMILIAR', 'Residentes activos sin ningún familiar registrado'),
            desdeHallazgo(hallazgos, 'CAIDAS_FUERA_DEL_MODULO', 'Caídas mencionadas en notas que no están en el módulo'),
            desdeHallazgo(hallazgos, 'SIN_PLAN_DE_CUIDO', 'Residentes sin plan de cuido firmado'),
            { texto: 'Medicamentos activos sin médico que los recetara', casos: [], total: sinPrescriptor },
        ],
        total: 0,
    };

    const bloques = [bloque1, bloque2, bloque3, bloque4, bloque5];
    for (const b of bloques) {
        b.lineas = b.lineas.filter(l => l.total > 0);
        b.total = b.lineas.reduce((n, l) => n + l.total, 0);
    }

    return {
        sedeId, sedeNombre,
        generadoAt: ahora, desde,
        residentesActivos: activos,
        // Los bloques vacíos se quedan: "0 úlceras esperando" no se dice, pero
        // un bloque entero sin líneas SÍ se enseña vacío, porque es la única
        // forma de que el lector sepa que se miró.
        bloques,
        totalPendiente: bloque1.total + bloque2.total + bloque3.total,
        frentesRevisados: 5,
    };
}
