/**
 * QUÉ CAMBIÓ EN ZÉNDITY — el bloque que viaja pegado al reporte semanal
 * ─────────────────────────────────────────────────────────────────────
 * Un cambio en el sistema no sirve de nada si quien lo iba a usar no se entera.
 * El horario se rehizo porque Celia lo estaba armando en Excel y pasándolo a
 * mano; si nadie se lo dice, lo sigue armando en Excel y el trabajo no existió.
 *
 * POR QUÉ AQUÍ Y NO EN UN CORREO APARTE. Un correo de "novedades del producto"
 * se abre la primera vez y la segunda ya no. El reporte de los lunes SÍ se abre,
 * porque trae trabajo pendiente con nombre y apellido. La novedad viaja pegada a
 * algo que ya se lee.
 *
 * TRES REGLAS QUE HACEN QUE ESTO NO SE VUELVA RUIDO:
 *
 *   · CADA NOVEDAD CADUCA. `hasta` no es opcional. Un aviso que se queda para
 *     siempre arriba del correo enseña a saltarse el principio del correo, y
 *     entonces el día que haya algo importante ahí tampoco se lee.
 *
 *   · UN SOLO CANAL POR PERSONA. Celia es DIRECTOR con NURSE secundario, así que
 *     le llegan los tres reportes —enfermería, supervisión y dirección—. Una
 *     novedad marcada en los tres canales le llegaría por triplicado el mismo
 *     lunes. Se marca en el canal de quien TIENE QUE HACER algo distinto.
 *
 *   · SIN NÚMEROS QUEMADOS. Lo que se cuenta —cuántos residentes sin alergias
 *     documentadas, cuántos relevos sin firmar— lo calcula el reporte cada lunes
 *     y sale en el adjunto. Si la novedad trae su propio número, ese número está
 *     muerto desde el día que se escribe y a las tres semanas miente.
 *
 * LO QUE NO HACE. No fuerza un envío. `enviarReporte` no manda nada cuando no
 * hay trabajo pendiente —un correo semanal que llega diciendo "cero" deja de
 * abrirse— y esa regla no se toca por un aviso. En la práctica Cupey nunca ha
 * estado en cero, pero si lo estuviera, ese lunes la novedad no sale y espera al
 * siguiente. Vale la pena saberlo: esto informa, no garantiza.
 */

export type CanalNovedad = 'enfermeria' | 'supervision' | 'direccion';

export interface Novedad {
    /** Para poder hablar de una en concreto sin citarla entera. */
    id: string;
    desde: Date;
    /** Obligatorio. El último día que aparece; después desaparece sola. */
    hasta: Date;
    canales: CanalNovedad[];
    titulo: string;
    /** Qué cambió, en dos o tres líneas. Sin jerga de programación. */
    cuerpo: string;
    /** Lo que le toca a quien lo lee. Se omite cuando no hay que hacer nada. */
    queHacer?: string;
}

/** AST. Las fechas se escriben como las diría alguien en el hogar. */
const dia = (iso: string) => new Date(`${iso}T00:00:00-04:00`);

/**
 * Los cambios del 6 de septiembre de 2026. Caducan el 1 de octubre: aparecen
 * cuatro lunes —7, 14, 21 y 28 de septiembre— y después el correo vuelve a ser
 * solo el trabajo pendiente.
 *
 * Van al canal de ENFERMERÍA porque quien tiene que hacer algo distinto con
 * ellos es Celia: arma el horario, documenta las alergias y es quien manda el
 * papel con el residente cuando sale a un hospital.
 */
export const NOVEDADES: Novedad[] = [
    {
        id: 'horario-en-pantalla-sep2026',
        desde: dia('2026-09-06'),
        hasta: dia('2026-10-01'),
        canales: ['enfermeria'],
        titulo: 'El horario ya se puede armar en la pantalla',
        cuerpo:
            'La semana completa se ve de un tirón, con los días libres incluidos. Se teclea: '
            + '<strong>d</strong> diurno, <strong>t</strong> vespertino, <strong>n</strong> nocturno, '
            + '<strong>l</strong> libre — y baja sola a la próxima persona. El color va en una '
            + 'segunda pasada (<strong>1</strong> rojo, <strong>2</strong> amarillo, '
            + '<strong>3</strong> verde, <strong>4</strong> azul), así que ya no hay que decidir '
            + 'turno y grupo en el mismo gesto. Se guarda solo cada tres segundos.',
        queHacer:
            'Probar una semana directo en la pantalla antes de abrir el Excel. Si algo sigue '
            + 'siendo más fácil en el Excel, decirlo — significa que quedó algo sin resolver.',
    },
    {
        id: 'correo-horario-espanol-sep2026',
        desde: dia('2026-09-06'),
        hasta: dia('2026-10-01'),
        canales: ['enfermeria'],
        titulo: 'El correo del horario ya no sale en inglés',
        cuerpo:
            'Un tercio de las líneas le llegaba al personal como <em>OFF</em>, <em>FULL_DAY</em> o '
            + '<em>SUPERVISOR_DAY</em>, sin decir la hora. Ahora cada turno sale en español y con '
            + 'su horario, y el día libre dice «Día libre».',
    },
    {
        id: 'alergias-no-documentado-sep2026',
        desde: dia('2026-09-06'),
        hasta: dia('2026-10-01'),
        canales: ['enfermeria'],
        titulo: 'Los papeles ya no dicen «Ninguna conocida» cuando nadie preguntó',
        cuerpo:
            'La hoja de emergencia decía <em>«Ninguna conocida»</em> de residentes cuyas alergias '
            + 'nunca se preguntaron a la familia. Eso en un hospital se lee como un dato, no como '
            + 'un hueco. Ahora dice <strong>«NO DOCUMENTADO — confirmar con el hogar antes de '
            + 'medicar»</strong>, y un «N/A» escrito en el expediente cuenta como vacío, no como '
            + 'alergia.',
        queHacer:
            'Hay familias a las que hay que preguntarles. Quiénes son sale en el bloque de '
            + 'expediente incompleto del PDF adjunto, con el conteo del lunes.',
    },
    {
        id: 'papeles-pdf-sep2026',
        desde: dia('2026-09-06'),
        hasta: dia('2026-10-01'),
        canales: ['enfermeria'],
        titulo: 'Los papeles se descargan como documento, no como captura de pantalla',
        cuerpo:
            'El registro de visitas, la hoja de traslado y el eMAR ahora tienen botón '
            + '<strong>Descargar PDF</strong>: membrete del hogar en cada hoja, «Página 2 de 3», y '
            + 'el nombre del residente repetido en todas. Antes la hoja 2 de un traslado era una '
            + 'lista de medicamentos sin dueño, y esos papeles se separan en una camilla.',
        queHacer:
            'Cuando el papel sale del hogar —hospital, inspección, familia— usar «Descargar PDF». '
            + '«Imprimir» sigue estando, pero imprime la pantalla.',
    },
];

/** Las que hoy tocan a este canal. Fuera de ventana no existen. */
export function novedadesVigentes(canal: CanalNovedad, ahora: Date = new Date()): Novedad[] {
    return NOVEDADES.filter(n => n.canales.includes(canal) && ahora >= n.desde && ahora < n.hasta);
}

/**
 * El bloque para el cuerpo del correo. Cadena vacía cuando no hay nada — el
 * llamador la interpola tal cual y no le queda un hueco ni un separador huérfano.
 *
 * Va DESPUÉS del trabajo pendiente a propósito. El correo existe por la deuda
 * clínica; la novedad es lo segundo, y el correo es corto — se ve sin bajar.
 */
export function novedadesHTML(canal: CanalNovedad, ahora: Date = new Date()): string {
    const vigentes = novedadesVigentes(canal, ahora);
    if (vigentes.length === 0) return '';

    const items = vigentes.map(n => `
<div style="margin:0 0 16px;">
<p style="margin:0 0 4px;font-size:14px;font-weight:800;color:#12211D;">${n.titulo}</p>
<p style="margin:0;font-size:14px;color:#3D4B45;">${n.cuerpo}</p>
${n.queHacer
        ? `<p style="margin:6px 0 0;font-size:14px;color:#0F6E56;"><strong>Qué hacer:</strong> ${n.queHacer}</p>`
        : ''}
</div>`).join('');

    return `
<div style="border-top:1px solid #E3EAE7;margin:22px 0 0;padding:18px 0 0;">
<p style="margin:0 0 14px;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#66766F;">Qué cambió en Zéndity</p>
${items}
<p style="margin:2px 0 0;font-size:13px;color:#66766F;">Este aviso deja de aparecer a finales de septiembre.</p>
</div>`;
}
