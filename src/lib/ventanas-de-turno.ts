/**
 * LAS VENTANAS DE CADA TURNO, ESCRITAS UNA SOLA VEZ.
 *
 * Este fichero NO importa prisma a propósito: lo necesitan tanto el servidor
 * (shift-coverage) como el cliente (el constructor de horarios), y hasta ahora
 * cada uno llevaba su propia copia de la regla. Tres copias, tres respuestas
 * distintas.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * EL FALLO QUE VIENE A CERRAR (medido el 21-sep-2026)
 *
 * Hay cinco tipos de turno que cubren color, y dos de ellos duran doce horas.
 * La geometría es esta, en hora AST:
 *
 *     MORNING      06 ────── 14
 *     EVENING              14 ────── 22
 *     NIGHT                        22 ────── 06
 *     FULL_DAY     06 ───────────── 18
 *     FULL_NIGHT                18 ───────────── 06
 *
 * De ahí sale lo único que importa y que casi nadie aplicaba entero:
 *
 *   · FULL_DAY (06–18) solapa con MORNING **y con EVENING** (las 14–18).
 *   · FULL_NIGHT (18–06) solapa con **EVENING** (las 18–22) y con NIGHT.
 *   · Por tanto EVENING lo cubren LOS DOS turnos largos, cada uno a medias.
 *     Un día armado con FULL_DAY + FULL_NIGHT no tiene un solo minuto
 *     descubierto.
 *
 * Los tres mapas que había escritos a mano decían otra cosa:
 *
 *   1. `computeShiftCoverage` filtraba `shiftType: shiftType` — igualdad
 *      exacta contra un bucket de ocho horas. Los turnos de doce eran
 *      INALCANZABLES: ninguno de sus seis llamadores podía pasar FULL_*.
 *      Medido: de las 28 pautas FULL_* publicadas desde el 01-jul, la persona
 *      fichó en 17, y en **16 de esas 17** el resolvedor le dejaba `color =
 *      null`. El 94% de los turnos largos realmente trabajados eran invisibles
 *      — ni cubrían su color ni podían recibir una redistribución
 *      (`shift-redistribute.ts:111` filtra por `c.color`).
 *
 *   2 y 3. El constructor de horarios, en `huecosDeColor` y en
 *      `proponerColores`, decía FULL_DAY→MORNING y FULL_NIGHT→NIGHT y **dejaba
 *      EVENING sin ninguno de los dos**. O sea: inventaba un hueco en la franja
 *      de la tarde de todo día cubierto con turnos largos.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * POR QUÉ UNA TABLA Y NO CINCO `if`
 *
 * Las dos preguntas que se hacen son distintas y las dos salen de la MISMA
 * tabla, que es el punto: no pueden volver a divergir.
 *
 *   · `compatibleShiftTypesAt(instante)` — "¿qué turnos están corriendo AHORA?"
 *     La usan el resolvedor de color y el cierre de turno.
 *   · `tiposQueCubren(franja)` — "¿qué pautas cuentan para esta franja?"
 *     La usan la cobertura y el constructor, que razonan por franja y no por
 *     reloj.
 *
 * La segunda no se puede derivar de la primera llamándola con "una hora
 * cualquiera de la franja": a las 14:30 FULL_NIGHT todavía no ha empezado y a
 * las 19:00 FULL_DAY ya terminó, y las dos cuentan para EVENING. Hay que mirar
 * el SOLAPE de las dos ventanas, no un instante suelto.
 */

export type ShiftT = 'MORNING' | 'EVENING' | 'NIGHT' | 'FULL_DAY' | 'FULL_NIGHT';

/** Las tres franjas en las que se piensa un día. SUPERVISOR_DAY y OFF no cubren color. */
export type FranjaT = 'MORNING' | 'EVENING' | 'NIGHT';

/**
 * [desde, hasta) en hora AST. Si `desde > hasta`, la ventana cruza medianoche.
 *
 * Es la única definición de estas horas en todo el repo. Si cambian aquí,
 * cambian en la cobertura, en el constructor y en el cierre de turno a la vez.
 */
export const VENTANA_AST: Record<ShiftT, readonly [number, number]> = {
    MORNING:    [6, 14],
    EVENING:    [14, 22],
    NIGHT:      [22, 6],
    FULL_DAY:   [6, 18],
    FULL_NIGHT: [18, 6],
};

/** Los cinco que cubren color, en el orden en que se leen. */
export const TIPOS_QUE_CUBREN: readonly ShiftT[] =
    ['MORNING', 'EVENING', 'NIGHT', 'FULL_DAY', 'FULL_NIGHT'];

/**
 * Las horas que ocupa una ventana, como conjunto.
 *
 * Se expande a horas enteras en vez de comparar intervalos porque las ventanas
 * cruzan medianoche y la aritmética de intervalos circulares es justo donde se
 * cometen los errores de signo. Veinticuatro elementos: el coste es irrelevante
 * y la corrección se ve leyendo.
 */
function horasDe(tipo: ShiftT): Set<number> {
    const [desde, hasta] = VENTANA_AST[tipo];
    const out = new Set<number>();
    for (let h = 0; h < 24; h++) {
        const dentro = desde < hasta ? (h >= desde && h < hasta) : (h >= desde || h < hasta);
        if (dentro) out.add(h);
    }
    return out;
}

/** La hora AST de un instante, 0–23. */
export function horaAST(at?: Date): number {
    const fmt = new Intl.DateTimeFormat('en-US', {
        hour: 'numeric', hour12: false, timeZone: 'America/Puerto_Rico',
    });
    return parseInt(fmt.format(at ?? new Date()), 10) % 24;
}

/**
 * Los tipos de turno que están CORRIENDO en ese instante.
 *
 * Casos borde, que son los que dan sentido a la precisión por hora:
 *   · 14:30 → EVENING + FULL_DAY.  FULL_NIGHT no ha empezado (arranca a las 18).
 *   · 18:30 → EVENING + FULL_NIGHT. FULL_DAY ya terminó.
 *   · 22:00 → NIGHT + FULL_NIGHT.
 *
 * Vivía en shift-coverage.ts; se movió aquí para que salga de la misma tabla
 * que `tiposQueCubren` y no puedan volver a contradecirse. shift-coverage la
 * re-exporta, así que sus llamadores no cambian.
 */
export function compatibleShiftTypesAt(at?: Date): ShiftT[] {
    const h = horaAST(at);
    return TIPOS_QUE_CUBREN.filter(t => horasDe(t).has(h));
}

/**
 * Los tipos de pauta que CUENTAN para una franja de ocho horas.
 *
 * Por solape de ventanas, no por instante. El resultado, que conviene tener a
 * la vista porque es lo que se estaba haciendo mal:
 *
 *     MORNING ← MORNING, FULL_DAY
 *     EVENING ← EVENING, FULL_DAY, FULL_NIGHT      ← los DOS largos
 *     NIGHT   ← NIGHT, FULL_NIGHT
 *
 * Una pauta cuenta para la franja si comparte con ella AL MENOS UNA HORA. Es la
 * regla honesta para "¿hay alguien de este color en esta franja?": si la
 * respuesta fuera "solo si la cubre entera", ningún turno largo cubriría
 * EVENING y tampoco lo haría medio MORNING — y sin embargo esa persona está en
 * el piso con esos residentes a su cargo.
 *
 * Lo que esto NO resuelve, y hay que saberlo: FULL_DAY cubre la mitad de
 * EVENING (14–18) y FULL_NIGHT la otra mitad (18–22). Un día con FULL_DAY pero
 * sin nadie de 18 a 22 tiene un hueco REAL que esta función no distingue,
 * porque solo contesta sí/no por franja. Si alguna vez hace falta esa
 * precisión, la tabla de arriba ya tiene los datos para calcularla.
 */
export function tiposQueCubren(franja: FranjaT): ShiftT[] {
    const horasFranja = horasDe(franja);
    return TIPOS_QUE_CUBREN.filter(t => {
        for (const h of horasDe(t)) if (horasFranja.has(h)) return true;
        return false;
    });
}

/** ¿Esta pauta cuenta para esta franja? Azúcar sobre `tiposQueCubren`. */
export function cubreLaFranja(shiftType: string, franja: FranjaT): boolean {
    return (tiposQueCubren(franja) as string[]).includes(shiftType);
}

/**
 * CUÁNTAS HORAS DURA CADA TIPO DE TURNO.
 *
 * Las cinco que cubren color salen CONTADAS de la tabla de ventanas de arriba,
 * no escritas a mano: si mañana `FULL_DAY` pasa a 06–19, esto cambia solo. Los
 * otros dos no tienen ventana de cobertura y van explícitos.
 *
 * SUPERVISOR_DAY son 09–18, nueve horas. No cubre color —por eso no está en
 * VENTANA_AST— pero sí son horas trabajadas y cuentan para la semana.
 */
export const DURACION_HORAS: Record<string, number> = {
    ...Object.fromEntries(TIPOS_QUE_CUBREN.map(t => [t, horasDe(t).size])),
    SUPERVISOR_DAY: 9,
    OFF: 0,
};

/**
 * Las horas de UN turno, incluido el de horario manual.
 *
 * Un turno manual lleva sus propias horas (`customStartTime`/`customEndTime`) y
 * puede durar cualquier cosa: contar 8 porque su `shiftType` diga MORNING sería
 * inventarse el dato. Si cruza la medianoche —de 22:00 a 06:00— se le suman las
 * 24 horas, que es la única lectura posible de un fin anterior al inicio.
 *
 * Devuelve 0 para lo que no sabe medir, nunca un número de relleno.
 */
export function horasDelTurno(t: {
    shiftType: string;
    isManual?: boolean | null;
    customStartTime?: string | Date | null;
    customEndTime?: string | Date | null;
}): number {
    if (t.isManual && t.customStartTime && t.customEndTime) {
        const a = new Date(t.customStartTime).getTime();
        const b = new Date(t.customEndTime).getTime();
        if (Number.isNaN(a) || Number.isNaN(b)) return 0;
        const horas = (b - a) / 3600000;
        return horas > 0 ? horas : horas + 24;
    }
    return DURACION_HORAS[t.shiftType] ?? 0;
}

/**
 * La jornada semanal completa: el umbral a partir del cual la pantalla AVISA.
 *
 * QUÉ SON ESTAS HORAS Y QUÉ NO SON. Son las horas PAUTADAS: lo que el horario
 * dice que esa persona va a trabajar. No son horas fichadas —esas salen de
 * `ShiftSession`— ni horas de nómina: un turno de doce suele llevar descanso
 * dentro, y si se paga o no es una decisión del hogar que este número no
 * conoce. Sirve para repartir la semana con criterio, no para pagar.
 *
 * Cuarenta porque es la jornada completa de referencia y la línea a partir de
 * la cual se suele hablar de horas extra. Medido el 21-sep-2026 sobre la semana
 * publicada de Cupey: 7 de 12 personas la pasan (48, 48, 44, 44, 44, 44, 44),
 * tres están justo en 40 y dos por debajo. O sea que el aviso SE MUEVE y no es
 * decorativo — pero también que aquí pasar de 40 es lo normal, así que el
 * número es para verlo al armar, no una alarma que haya que apagar.
 */
export const HORAS_SEMANA_COMPLETA = 40;
