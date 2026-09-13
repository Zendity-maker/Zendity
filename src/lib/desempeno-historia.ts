/**
 * TU HISTORIA, MES A MES — desde tu primer turno.
 *
 * Nace el 13-sep-2026 porque las cuidadoras preguntaron por qué ya no ven su
 * historia. La respuesta larga está en z-score-visible.ts; la corta es que lo
 * que veían era el Z-Score, estaba invertido y se apagó.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * POR QUÉ SOLO HAY UNA MEDIDA AQUÍ
 *
 * Se midió contra producción antes de escribir una línea, y de las cuatro
 * medidas de `desempeno.ts` solo UNA aguanta una serie histórica:
 *
 *   handoverCompleted        22-may-2026 ✓  el campo existe desde mar-2026 y su
 *                                           escritura se consolidó el 18-20 may,
 *                                           ANTES de la primera fila de datos.
 *                                           Solo lo pone el asistente de cierre
 *                                           (api/care/shift/end:157); el cierre
 *                                           forzado del supervisor NO lo pone, y
 *                                           vale cero en producción.
 *   DailyLog [NOTA DE TURNO] 25-ago-2026 ✗  el prefijo no existía antes
 *   [MEDICAMENTO SIN ADMIN.] nunca        ✗  no hay ni una fila
 *   CambioDeCondicion        06-sep-2026 ✗  lo anterior es backfill, y 11 de 29
 *                                           filas cuentan DOS veces porque el
 *                                           backfill copió DailyLogs que el
 *                                           regex ya contaba
 *   Academy (UserCourse)     24-ago-2026 ✗  no es una serie, es un escalón: 26 de
 *                                           33 asignaciones se crearon en agosto
 *
 * Dibujar cualquiera de las otras desde mayo no enseñaría el trabajo de nadie:
 * enseñaría la fecha en que Zéndity aprendió a registrarlo. Una línea que sube
 * porque cambió el software y no porque cambió la persona es peor que no tener
 * línea — es la misma trampa que las omisiones de medicación que nadie veía.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LO QUE ESTO NO ES, Y LAS REGLAS QUE LO IMPIDEN
 *
 * Una gráfica es MÁS peligrosa que una tarjeta: una línea crea una pendiente, y
 * una pendiente crea una meta implícita. El Z-Score no murió por ser un número,
 * murió por no ser verdad y por señalar a quien mejor documentaba.
 *
 *   · No se funde nada en un índice. Una medida, o ninguna.
 *   · No hay porcentaje como dato principal: van los DOS conteos —trabajados y
 *     cerrados— porque un mes flojo casi siempre es "vino menos", no "lo hizo
 *     peor", y una tasa esconde esa diferencia.
 *   · No hay meta, umbral ni línea de objetivo. Un umbral es una nota disfrazada.
 *   · No hay comparación con nadie. La media del turno cambia de cohorte cada
 *     mes —6 personas que ya no están acumulan 172 de 1.054 turnos— así que una
 *     media histórica se reescribe sola cuando alguien se va.
 *   · No hay orden, percentil ni "eres la 3 de 8".
 *   · Un mes sin turnos NO es un cero: es un hueco. Se omite el punto. Un cero
 *     dibujado y una ausencia se ven idénticos y no son lo mismo.
 *   · Esto no se guarda en ninguna columna. Se calcula al vuelo y se muere con
 *     la respuesta. Nunca en `complianceScore`, que ya tiene ocho escritores.
 *
 * Y el endpoint que la sirve NO acepta una lista de usuarios, a propósito: el
 * día que acepte `?userIds=`, alguien arma el ranking en una tarde.
 *
 * Ver [[veracidad-no-puntuacion]] y src/lib/z-score-visible.ts.
 */
import { prisma } from '@/lib/prisma';

/** Hora de Puerto Rico (AST, UTC-4). Sin esto los meses se parten mal. */
const AST_OFFSET_MS = 4 * 3600 * 1000;
const enAst = (d: Date) => new Date(d.getTime() - AST_OFFSET_MS);
const claveMes = (d: Date) => {
    const a = enAst(d);
    return `${a.getUTCFullYear()}-${String(a.getUTCMonth() + 1).padStart(2, '0')}`;
};

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export type MotivoParcial = 'primer-mes' | 'mes-en-curso';

export interface MesDeHistoria {
    /** '2026-06' */
    mes: string;
    /** 'jun' — y 'jun 26' cuando la serie cruza de año. */
    etiqueta: string;
    turnos: number;
    cerrados: number;
    /**
     * Turnos que cerró SUPERVISIÓN a la fuerza, no ella.
     *
     * Esto es lo que separa una gráfica honesta de una que acusa. Medido el
     * 13-sep-2026 sobre los 86 turnos sin cerrar de la sede: SESENTA los forzó
     * un supervisor y solo 26 son "no lo cerró ella". Neylianne Torres tenía 15
     * sin cerrar y doce eran forzados: su hueco real son TRES. Carlos Negrón,
     * de 7 sin cerrar, uno. Kerliann y Kishany, cero de los suyos.
     *
     * Sin este campo la barra le cuelga a cada una los cierres que hizo otra
     * persona por ella.
     */
    forzados: number;
    /**
     * Por qué este mes no es comparable con los de al lado. El primero porque
     * empezó a media altura, el último porque todavía va corriendo. Medido:
     * mayo son 10 días de datos (29-32% del mes) y el mes en curso iba por el
     * 43% — sin marcarlos, cualquier serie de cinco puntos sale con forma de V
     * que no existe.
     */
    parcial: MotivoParcial | null;
}

export interface Historia {
    /** ISO del primer turno. El ancla. */
    desde: string | null;
    meses: MesDeHistoria[];
    /** Cuántos turnos tiene en total, para saber si merece la pena dibujar. */
    turnosTotales: number;
    /**
     * Por qué no hay gráfica, cuando no la hay. Nunca se deja un hueco mudo:
     * eso es exactamente lo que hizo que el piso preguntara qué había pasado.
     */
    aviso: string | null;
}

/**
 * El ancla es el PRIMER TURNO, no la fecha de alta.
 *
 * `User.hiredAt` está nulo en las 14 personas de piso, y `createdAt` se agolpa
 * el 20-22 de mayo porque es cuando se reconstruyó la base tras el force-reset
 * — no cuando entró nadie. El primer `ShiftSession` es lo único que de verdad
 * dice "desde aquí hay historia".
 */
export async function calcularHistoria(userId: string): Promise<Historia | null> {
    const usuario = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, headquartersId: true },
    });
    if (!usuario) return null;

    const turnos = await prisma.shiftSession.findMany({
        where: { caregiverId: userId },
        select: { id: true, startTime: true, handoverCompleted: true },
        orderBy: { startTime: 'asc' },
    });

    /**
     * Los turnos que cerró supervisión por ella.
     *
     * `/api/care/shift/force-close` pone `actualEndTime` y deja constancia en
     * `SystemAuditLog` (SYSTEM_ABANDONED), pero NO crea relevo ni toca
     * `handoverCompleted` — así que para cualquier conteo ingenuo esos turnos
     * se leen como "no lo cerró". Contrastado el 13-sep-2026: los 60 registros
     * de auditoría casan uno a uno con los 60 turnos cuyo `aiSummaryReport`
     * empieza por "Cierre forzado", y ninguno de ellos tiene relevo.
     */
    const forzados = turnos.length > 0
        ? await prisma.systemAuditLog.findMany({
            where: {
                entityName: 'ShiftSession',
                action: 'SYSTEM_ABANDONED',
                entityId: { in: turnos.map(t => t.id) },
            },
            select: { entityId: true },
        })
        : [];
    const idsForzados = new Set(forzados.map(f => f.entityId));

    if (turnos.length === 0) {
        return {
            desde: null, meses: [], turnosTotales: 0,
            aviso: 'Todavía no hay turnos tuyos registrados en Zéndity. En cuanto cierres el primero, aquí empieza tu historia.',
        };
    }

    const primero = turnos[0].startTime;
    const ahora = new Date();
    const mesActual = claveMes(ahora);

    // Agrupar por mes. Solo existen los meses en los que TRABAJÓ: un mes sin
    // turnos no entra, para que no se dibuje un cero donde hubo una ausencia.
    const porMes = new Map<string, { turnos: number; cerrados: number; forzados: number }>();
    for (const t of turnos) {
        const k = claveMes(t.startTime);
        const m = porMes.get(k) ?? { turnos: 0, cerrados: 0, forzados: 0 };
        m.turnos++;
        if (t.handoverCompleted) m.cerrados++;
        else if (idsForzados.has(t.id)) m.forzados++;
        porMes.set(k, m);
    }

    const claves = [...porMes.keys()].sort();
    const primerMes = claves[0];
    const cruzaDeAnio = new Set(claves.map(k => k.slice(0, 4))).size > 1;

    const meses: MesDeHistoria[] = claves.map(k => {
        const [anio, mes] = k.split('-');
        const etiqueta = cruzaDeAnio
            ? `${MESES[Number(mes) - 1]} ${anio.slice(2)}`
            : MESES[Number(mes) - 1];
        const d = porMes.get(k)!;
        return {
            mes: k,
            etiqueta,
            turnos: d.turnos,
            cerrados: d.cerrados,
            forzados: d.forzados,
            parcial: k === mesActual ? 'mes-en-curso' : k === primerMes ? 'primer-mes' : null,
        };
    });

    /**
     * Con un mes no hay historia que enseñar, y con dos tampoco: dos barras no
     * son una tendencia, son dos barras. Medido el 13-sep-2026, tres personas
     * estaban en ese caso (la más nueva llevaba diez días). Decirlo es mejor
     * que dibujarles algo que las invita a sacar conclusiones de nada.
     */
    const aviso = meses.length < 3
        ? `Llevas ${meses.length === 1 ? 'un mes' : 'dos meses'} con turnos registrados. Con un par de meses más, aquí vas a ver cómo ha ido cambiando.`
        : null;

    return {
        desde: primero.toISOString(),
        meses,
        turnosTotales: turnos.length,
        aviso,
    };
}
