import { clinicalDay } from '@/lib/dates';

/**
 * Plazo y penalidad de la ventana de vitales — fuente única.
 *
 * Estas dos constantes vivían duplicadas en shift/start, claim-coverage y el
 * cron, y significaban cosas distintas bajo el mismo nombre: el plazo del
 * cuidador y el umbral de castigo. Separarlas fue lo que permitió acortar el
 * plazo sin quitarle puntos a nadie.
 *
 * VITALS_WINDOW_MS — el PLAZO que ve el cuidador al abrir turno.
 *   19-ago-2026: baja de 4h a 3h por decisión de la enfermera del hogar. Una
 *   toma buena por turno, y ante variación significativa se repite en una o
 *   dos horas.
 *
 *   01-sep-2026: VUELVE a 4h. Celia indica que lo ideal son 4 horas. Herminia
 *   reportó que el sistema le pedía justificación, y al medirlo se vio que con
 *   3h el plazo apretaba de más en un turno normal.
 *
 *   Con la vuelta a 4h, PENALTY_GRACE_MS regresa a 0 — y eso NO es un endurecimiento.
 *   La gracia existía sólo para compensar el recorte: con 3h + 1h la penalidad
 *   caía a las 4h de abrirse la orden. Ahora el plazo YA es de 4h, así que la
 *   penalidad sigue cayendo exactamente a la misma hora que hoy. Lo que cambia
 *   es que deja de haber una hora en la que se exige justificar sin descontar:
 *   el plazo que se pide cumplir y el que se juzga vuelven a ser el mismo, que
 *   es como estaba antes del 19-ago y es más fácil de explicar en el piso.
 *
 * PENALTY_GRACE_MS — cuánto se espera DESPUÉS de vencido el plazo antes de
 *   descontar puntos. Existe para que acortar el plazo no fuera un recorte de
 *   Z-Score encubierto: 3h + 1h de gracia = la penalidad se sigue aplicando a
 *   las 4h de abrirse la orden, igual que antes del cambio.
 *   Ponerlo en 0 hace que la penalidad siga al plazo. Es una decisión de
 *   negocio, no un detalle técnico.
 */
export const VITALS_WINDOW_MS = 4 * 60 * 60 * 1000;
export const PENALTY_GRACE_MS = 0;

/** Umbral real de penalidad, contado desde que se abrió la orden. */
export const PENALTY_THRESHOLD_MS = VITALS_WINDOW_MS + PENALTY_GRACE_MS;

/**
 * HASTA QUE TERMINE EL TURNO DE NOCHE — el plazo de una orden de enfermería.
 *
 * Andrés, 01-oct-2026, al preguntarle qué plazo debía tener: «el plazo hasta
 * que termine el turno de noche».
 *
 * No es `VITALS_WINDOW_MS`. Esas 4 h son el plazo de la RONDA: quien abre turno
 * tiene cuatro horas para hacer la suya. Una orden de enfermería es otra cosa —
 * «a esta persona hay que mirarla esta noche»— y pedirla a las 5 de la tarde
 * con un reloj de 4 h la mataba a las 9, antes de que entrara la guardia que
 * tenía que cumplirla.
 *
 * El fin del turno de noche son las 6:00 AM AST, que es también el fin de la
 * jornada clínica. No se inventa una constante: se reusa la frontera que ya
 * gobierna todo lo demás en este sistema. Ver `clinicalDay` en dates.ts.
 *
 *     pedida a las 17:00 del día D ...... vence el D+1 a las 06:00  (13 h)
 *     pedida a las 02:00 del día D ...... vence el D   a las 06:00  ( 4 h)
 *     pedida a las 07:00 del día D ...... vence el D+1 a las 06:00  (23 h)
 *
 * EL BORDE, dicho y no disimulado: pedida a las 05:30 el plazo es de media
 * hora, porque el turno de noche termina a las 06:00. Es la lectura literal de
 * lo que se pidió y no se le pone un suelo artificial — pero si en el piso
 * resulta que una orden de madrugada quiere decir «la noche siguiente», esto es
 * lo que hay que cambiar, y está en un solo sitio.
 */
export function finDelTurnoDeNoche(ahora: Date = new Date()): Date {
    const { boundary6amUtc } = clinicalDay(ahora);
    return new Date(boundary6amUtc.getTime() + 24 * 60 * 60 * 1000);
}
