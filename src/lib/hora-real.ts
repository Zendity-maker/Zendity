/**
 * HORA REAL DEL CUIDO vs HORA DEL TECLEO
 * ──────────────────────────────────────
 * Hasta ago-2026 todos los registros clinicos sellaban la hora con `now()` en
 * el momento del toque: BathLog.timeLogged, MealLog.timeLogged,
 * PosturalChangeLog.performedAt y MedicationAdministration.administeredAt eran
 * todos "cuando se toco el boton", no "cuando ocurrio el cuido".
 *
 * Consecuencia medida sobre 5,070 administraciones de 21 dias: la diferencia
 * entre `administeredAt` y `createdAt` era de CERO minutos en el 100% de los
 * casos. En la auditoria de turno el baño, el desayuno y el medicamento salian
 * a la misma hora — la hora en que la cuidadora se sento con la tableta.
 *
 * Este helper deja que ella declare la hora real. `createdAt` sigue siendo
 * automatico e inalterable, asi que el expediente conserva las dos y se puede
 * leer "bañado 7:15, registrado 8:47".
 *
 * Los limites NO son burocracia: una hora declarada sin techo ni piso vuelve el
 * campo inauditable, y entonces no sirve para lo unico que se creo — que el
 * expediente diga la verdad.
 */

/** Margen de reloj desfasado que se tolera hacia el futuro. */
export const MARGEN_FUTURO_MIN = 5;
/**
 * Cuanto hacia atras se acepta declarar. Mas que esto va a la bitacora.
 *
 * ERAN 12 Y NO ALCANZABAN EL DIA QUE ESTE CAMPO EXISTE PARA REGISTRAR.
 *
 * El 21-sep-2026 el pack de las 8:00 AM del grupo ROJO se firmo a las 5 de la
 * tarde —se habia administrado, se corroboro por telefono con las cuidadoras—
 * y quedo en el expediente con la hora del tecleo. Al intentar corregirlo se
 * vio por que: declarar las 08:00 a las 21:39 son 13 h 40, y el servidor lo
 * rechazaba. Las 05:00 del mismo dia, 16 h 39. O sea que el unico registro que
 * de verdad necesitaba declarar su hora era justo el que no podia.
 *
 * 19 SALE DE UNA MEDIDA, NO DE UN REDONDEO. Se probo primero con 18 —"un dia
 * de trabajo y algo"— y la propia casa lo desmintio: de las 259 recetas activas
 * la franja mas temprana son las 05:00 (11 recetas), y la tableta ofrece un
 * pack atrasado desde las 06:00 hasta las 23:59. El peor caso legitimo es esa
 * franja declarada a las 23:59: 18.98 h. Con 18 quedaba una franja entera —la
 * de madrugada, que es la que mas se anota tarde— sin poder declarar su hora.
 *
 * Si alguna vez se receta algo antes de las 05:00, este numero hay que volver
 * a medirlo. Sigue siendo un techo: el campo no sirve si no es auditable. Pero
 * el techo ahora es "hoy" en vez de medio dia.
 */
export const MAX_ATRAS_HORAS = 19;

export type HoraReal =
    | { ok: true;  hora: Date }
    | { ok: false; error: string };

/**
 * Resuelve la hora que debe guardarse.
 * Sin hora declarada devuelve `ahora` — el comportamiento de siempre, para que
 * ninguna pantalla que aun no pregunte la hora se rompa.
 */
export function resolverHoraReal(declarada: unknown, ahora: Date = new Date()): HoraReal {
    if (declarada === undefined || declarada === null || declarada === '') {
        return { ok: true, hora: ahora };
    }

    const d = declarada instanceof Date ? declarada : new Date(String(declarada));
    if (isNaN(d.getTime())) {
        return { ok: false, error: 'La hora indicada no es válida.' };
    }

    const minutosAdelante = (d.getTime() - ahora.getTime()) / 60000;
    if (minutosAdelante > MARGEN_FUTURO_MIN) {
        return { ok: false, error: 'La hora no puede estar en el futuro.' };
    }

    const horasAtras = (ahora.getTime() - d.getTime()) / 3600000;
    if (horasAtras > MAX_ATRAS_HORAS) {
        return {
            ok: false,
            error: `La hora no puede ser de hace más de ${MAX_ATRAS_HORAS} horas. Si es un registro muy atrasado, anótalo en la bitácora.`,
        };
    }

    // Nunca adelantar el reloj: un desfase de pocos minutos se ancla en ahora.
    return { ok: true, hora: minutosAdelante > 0 ? ahora : d };
}
