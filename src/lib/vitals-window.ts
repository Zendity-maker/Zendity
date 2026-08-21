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
 * PENALTY_GRACE_MS — cuánto se espera DESPUÉS de vencido el plazo antes de
 *   descontar puntos. Existe para que acortar el plazo no fuera un recorte de
 *   Z-Score encubierto: 3h + 1h de gracia = la penalidad se sigue aplicando a
 *   las 4h de abrirse la orden, igual que antes del cambio.
 *   Ponerlo en 0 hace que la penalidad siga al plazo. Es una decisión de
 *   negocio, no un detalle técnico.
 */
export const VITALS_WINDOW_MS = 3 * 60 * 60 * 1000;
export const PENALTY_GRACE_MS = 60 * 60 * 1000;

/** Umbral real de penalidad, contado desde que se abrió la orden. */
export const PENALTY_THRESHOLD_MS = VITALS_WINDOW_MS + PENALTY_GRACE_MS;
