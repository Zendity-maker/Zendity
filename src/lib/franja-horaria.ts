/**
 * LA ETIQUETA DE UNA FRANJA DEL eMAR. UNA SOLA DEFINICIÓN.
 *
 * ═══ POR QUÉ EXISTE ═══
 *
 * La tableta casa una dosis con su pack por IGUALDAD DE TEXTO:
 *
 *     a.scheduleTime === slotLabel      (src/app/care/page.tsx, slotStatusToday)
 *
 * O sea que la cadena no es una etiqueta bonita: es la clave. Y estaba escrita
 * en dos sitios que producían cosas distintas.
 *
 *   · La tableta la construía a mano  →  "8:00 PM"
 *   · El cierre de turno usaba `toLocaleTimeString('es-PR', { hour12: true })`
 *     →  "8:00 p. m."
 *
 * Nunca casan. Medido el 27-sep-2026 sobre las 30.018 filas con `scheduleTime`
 * de Cupey: 74 llevan el formato con puntos, TODAS de origen `CIERRE_DE_TURNO`,
 * entre el 22-sep —el día en que se escribió ese flujo— y hoy. Son 74 dosis que
 * una cuidadora declaró dadas al cerrar el turno y que la tableta le seguía
 * enseñando sin firmar. Es exactamente la queja que trajeron al seminario:
 * «firmo y no se entera».
 *
 * Y es el quinto caso de la misma semana: una regla escrita dos veces, y solo
 * una copia arreglada. Por eso esto vive aquí y no en ninguno de los dos.
 *
 * ═══ POR QUÉ NO USA `toLocaleTimeString` ═══
 *
 * Porque su salida depende del ICU del entorno: el mismo código da "8:00 p. m."
 * en Node y podría dar "8:00 PM" en otro. Una clave de base de datos no puede
 * depender de qué versión de Node corre. Se construye a mano, a propósito.
 *
 * El formato canónico es el que ya tienen 29.944 de las 30.018 filas:
 * hora sin cero delante, minutos con dos cifras, AM/PM en mayúsculas.
 *
 *     8:00 AM · 12:30 PM · 5:00 PM
 */

/** Minutos desde medianoche (0..1439) → "8:00 PM". */
export function etiquetaDeFranja(minutosDesdeMedianoche: number): string {
    const m = ((Math.round(minutosDesdeMedianoche) % 1440) + 1440) % 1440;
    const h24 = Math.floor(m / 60);
    const min = m % 60;
    const ap = h24 >= 12 ? 'PM' : 'AM';
    const h12 = (h24 % 12) || 12;
    return `${h12}:${String(min).padStart(2, '0')} ${ap}`;
}

/**
 * Un instante → la etiqueta de su franja, en hora de Puerto Rico.
 *
 * Se saca la hora con `Intl` y se FORMATEA a mano: `Intl` para leer el reloj de
 * la isla (que es lo que hace bien) y construcción propia para la cadena (que
 * es lo que hacía mal).
 */
export function etiquetaDeFranjaAST(d: Date): string {
    const partes = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Puerto_Rico',
        hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(d);
    const hora = Number(partes.find(p => p.type === 'hour')?.value ?? '0') % 24;
    const minuto = Number(partes.find(p => p.type === 'minute')?.value ?? '0');
    return etiquetaDeFranja(hora * 60 + minuto);
}

/**
 * ¿Son la misma franja, escritas de cualquiera de las formas que hay en la base?
 *
 * Existe para lo que YA está escrito: "08:00 AM" (el cron), "8:00 AM" (la
 * tableta) y "8:00 p. m." (el cierre, hasta hoy). Lo nuevo sale todo de
 * `etiquetaDeFranja`, pero las 30.018 filas viejas no se reescriben.
 */
export function mismaFranja(a: string | null | undefined, b: string | null | undefined): boolean {
    const n = (s: string | null | undefined): string | null => {
        if (!s) return null;
        const t = s.trim().toUpperCase().replace(/\./g, '').replace(/\s+/g, ' ');
        const m = t.match(/^(\d{1,2}):(\d{2})\s*(A M|P M|AM|PM)?$/);
        if (!m) return t;
        let h = parseInt(m[1], 10);
        const ap = (m[3] || '').replace(' ', '');
        if (ap === 'PM' && h < 12) h += 12;
        if (ap === 'AM' && h === 12) h = 0;
        return etiquetaDeFranja(h * 60 + parseInt(m[2], 10));
    };
    const na = n(a), nb = n(b);
    return na !== null && nb !== null && na === nb;
}
