/**
 * FECHA DE NACIMIENTO Y EDAD
 * ─────────────────────────
 * `Patient.dateOfBirth` se guarda como **medianoche UTC**: el formulario manda
 * 'YYYY-MM-DD' y `new Date('1939-05-26')` lo interpreta como
 * `1939-05-26T00:00:00.000Z`.
 *
 * Puerto Rico es UTC-4, así que leer esa fecha con getters locales devuelve el
 * DÍA ANTERIOR. Comprobado contra producción: Aida Rivera, nacida el 26 de
 * mayo, salía como 25 de mayo. Le pasaba a los 34 residentes.
 *
 * Por eso la fecha de nacimiento se lee siempre en UTC —que es como se
 * escribió— mientras que "hoy" se lee en la hora local del navegador, que es
 * el calendario en el que vive quien mira la pantalla. Emparejar los dos así
 * es lo que hace que el cumpleaños caiga en el día correcto.
 *
 * OJO: esto NO sirve para `admissionDate`. Esa sí es una marca de tiempo real
 * (`new Date()` al momento del registro, p. ej. 13:24 UTC = 9:24 am en PR), y
 * formatearla en UTC la correría al día siguiente. Va en local.
 */

function aFecha(v: Date | string | null | undefined): Date | null {
    if (!v) return null;
    const d = v instanceof Date ? v : new Date(v);
    return isNaN(d.getTime()) ? null : d;
}

/** Años cumplidos. `null` si no hay fecha o si sale negativa (fecha mal escrita). */
export function edadEnAnios(dob: Date | string | null | undefined): number | null {
    const d = aFecha(dob);
    if (!d) return null;

    const hoy = new Date();
    let anios = hoy.getFullYear() - d.getUTCFullYear();
    const meses = hoy.getMonth() - d.getUTCMonth();
    if (meses < 0 || (meses === 0 && hoy.getDate() < d.getUTCDate())) anios--;

    return anios >= 0 && anios < 130 ? anios : null;
}

/** "26 de mayo de 1939". Cadena vacía si no hay fecha. */
export function fechaNacimientoLarga(dob: Date | string | null | undefined): string {
    const d = aFecha(dob);
    if (!d) return '';
    return d.toLocaleDateString('es-PR', {
        day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
    });
}

/** "26/05/1939". Para renglones estrechos. */
export function fechaNacimientoCorta(dob: Date | string | null | undefined): string {
    const d = aFecha(dob);
    if (!d) return '';
    return d.toLocaleDateString('es-PR', {
        day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC',
    });
}

/**
 * Para marcas de tiempo reales (`admissionDate`, `createdAt`): hora local, sin
 * el `timeZone: 'UTC'` de arriba. Está aquí para que quede a la vista que son
 * dos reglas distintas y nadie las cruce por descuido.
 */
export function fechaLocalLarga(v: Date | string | null | undefined): string {
    const d = aFecha(v);
    if (!d) return '';
    return d.toLocaleDateString('es-PR', { day: 'numeric', month: 'long', year: 'numeric' });
}
