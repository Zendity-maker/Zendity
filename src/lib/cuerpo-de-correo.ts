/**
 * EL CUERPO DE UN CORREO, VENGA COMO VENGA. UNA SOLA DEFINICIÓN.
 *
 * ═══ QUÉ PASABA ═══
 *
 * Las cinco pantallas que mandan correo —tres al personal, dos a familias—
 * metían lo que se escribía DIRECTO dentro del HTML de la plantilla. El campo se
 * llama `html`, y la de difusión al personal lo rotula «Cuerpo del Menú
 * Corporativo (HTML/Markdown)».
 *
 * De las dos cosas que ese rótulo promete, Markdown NO existe: no hay librería
 * que lo convierta en ninguna de las cinco rutas. Y el `placeholder` de esa
 * misma pantalla enseña TEXTO PLANO con saltos de línea:
 *
 *     "Hola colaborador...\n\nPor este medio Zendity HR informa que..."
 *
 * O sea que la pantalla enseña el formato que no funciona. Andrés, 01-oct-2026:
 * «cuando envío un correo para todo el personal no se ve bien, se recibe todo
 * el texto junto aunque yo lo vea separado». Mandó el memorando de octubre —
 * veintitantos párrafos y una lista— y llegó en un solo bloque.
 *
 * Y las dos rutas de familia tenían el fallo espejo: conservaban
 * `white-space: pre-wrap`, que respeta el texto plano pero hace VISIBLE la
 * indentación de cualquier HTML bien maquetado. El 12-sep ese mismo
 * `pre-wrap` se quitó de las de personal por eso, y las de familia se quedaron
 * sin el arreglo — la misma regla escrita cinco veces y corregida en tres.
 *
 * ═══ QUÉ HACE ESTO ═══
 *
 * Mira lo que llega y decide:
 *
 *   · Si trae etiquetas HTML de verdad, se deja INTACTO. Quien pega HTML
 *     maquetado sigue mandando exactamente lo que escribió.
 *   · Si no, es texto plano: se escapa (para que un «<» escrito a mano no se
 *     coma media frase) y se convierte en párrafos, saltos y viñetas.
 *
 * No se añade Markdown. Lo que Andrés escribe no es Markdown: es texto plano
 * con asteriscos, y una librería entera para eso sería construir de más. Si
 * algún día hace falta negrita o enlaces, se añade entonces y se sabrá por qué.
 */

/** Etiquetas que delatan HTML de verdad, no un «<» suelto en una frase. */
const ETIQUETA_REAL =
    /<\s*(p|div|br|span|table|tbody|tr|td|th|a|h[1-6]|ul|ol|li|strong|em|b|i|u|img|section|header|footer|blockquote|hr)\b[^>]*>/i;

/** Una línea de viñeta: «* algo», «- algo» o «• algo». */
const VINETA = /^\s*[*\-•]\s+(.*)$/;

function escapar(t: string): string {
    return t
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/**
 * Las viñetas van en TABLA y no en `<ul>`.
 *
 * Outlook de escritorio ignora buena parte del `list-style` y el `padding` de
 * una lista, y el resultado es una sangría que se mueve de cliente a cliente.
 * Una tabla de dos columnas se ve igual en todos — es lo que se usa en el
 * correo maquetado a mano desde siempre.
 */
function listaHtml(items: string[]): string {
    const filas = items.map(x => `
    <tr>
      <td style="padding:3px 0;color:#0F6E56;font-weight:700;width:18px;vertical-align:top;">&bull;</td>
      <td style="padding:3px 0;">${x}</td>
    </tr>`).join('');
    return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px 0;">${filas}
</table>`;
}

/**
 * Convierte el cuerpo escrito en HTML listo para la plantilla.
 *
 * Es idempotente sobre HTML: pasarle dos veces lo mismo devuelve lo mismo,
 * porque la primera pasada ya deja etiquetas y la segunda las reconoce.
 */
export function cuerpoDeCorreo(crudo: unknown): string {
    const texto = String(crudo ?? '');
    if (!texto.trim()) return '';

    // Ya viene maquetado: no se toca. Es el camino de quien pega HTML.
    if (ETIQUETA_REAL.test(texto)) return texto;

    const normalizado = texto.replace(/\r\n?/g, '\n');

    // Un bloque es lo que va entre líneas en blanco. Es como se escribe un
    // párrafo cuando nadie te ha dicho que estás escribiendo HTML.
    const bloques = normalizado.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);

    return bloques.map(bloque => {
        const lineas = bloque.split('\n');
        const vinetas = lineas.filter(l => VINETA.test(l));

        // Bloque de lista: todas sus líneas son viñetas.
        if (vinetas.length > 0 && vinetas.length === lineas.length) {
            return listaHtml(lineas.map(l => escapar(l.match(VINETA)![1].trim())));
        }

        /**
         * Lista PEGADA a su frase de entrada, que es como la escribió Andrés:
         *
         *     Eso requiere:
         *     * Compromiso
         *     * Paciencia
         *
         * Sin esto, el bloque entero caería al párrafo de abajo y las viñetas
         * saldrían como asteriscos en medio de una línea.
         */
        if (vinetas.length > 0) {
            const corte = lineas.findIndex(l => VINETA.test(l));
            const cabecera = lineas.slice(0, corte).join('\n').trim();
            const resto = lineas.slice(corte);
            const soloVinetas = resto.every(l => VINETA.test(l));
            if (soloVinetas) {
                const items = resto.map(l => escapar(l.match(VINETA)![1].trim()));
                return (cabecera ? parrafo(cabecera, '0 0 10px 0') : '') + listaHtml(items);
            }
        }

        return parrafo(bloque);
    }).join('\n');
}

/** Un párrafo; los saltos simples de dentro se respetan como `<br>`. */
function parrafo(texto: string, margen = '0 0 16px 0'): string {
    const cuerpo = escapar(texto).split('\n').join('<br>');
    return `<p style="margin:${margen};">${cuerpo}</p>`;
}
