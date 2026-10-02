/**
 * LOS COLORES DE GRUPO. UNA SOLA DEFINICIÓN.
 *
 * ═══ POR QUÉ EXISTE ═══
 *
 * Andrés, 02-oct-2026: «necesito abrir otro color para residentes regulares ya
 * que la población está en aumento».
 *
 * Al medir qué costaba, el enum resultó ser la parte barata. Medido ese día:
 * **41 ficheros nombran los colores y 16 enumeran la lista** — cada uno con su
 * propia copia, y ninguna derivada de otra. Siete mapas de nombres en español
 * solo en `care/supervisor/page.tsx`, una cadena de ternarios en la misma
 * pantalla, un `COLOR_OPTIONS` con sus clases y sus teclas en el constructor de
 * horarios, otro juego de hex en `GrupoBadge`, otro en RGB para el PDF del
 * censo. Dieciséis veces la misma lista.
 *
 * Añadir un valor al enum y olvidar uno de esos sitios NO da error. Da un color
 * que en esa pantalla no existe: un punto invisible —`undefined` como clase de
 * Tailwind no pinta nada—, una insignia en blanco, un grupo que no se puede
 * cubrir, un residente que no sale. El fallo es callado, que es el peor.
 *
 * Es la causa raíz que este repo lleva toda la semana pagando: una regla
 * escrita muchas veces y arreglada en algunas.
 *
 * Así que primero la lista, y después el color. Con esto puesto, el sexto color
 * es una fila.
 *
 * ═══ POR QUÉ DIECINUEVE CAMPOS Y NO UNO ═══
 *
 * No es sobre-ingeniería: es el inventario de lo que las pantallas YA usaban.
 * Un punto de color, una píldora suave, un chip sólido y una insignia con borde
 * son cuatro cosas distintas, y aplastarlas en un solo valor cambiaría cómo se
 * ve media aplicación. Cada campo existía ya, repartido; aquí están en una
 * fila, uno al lado del otro, para que abrir un color sea rellenar esa fila y
 * se vea de un vistazo lo que falta.
 *
 * El número no es decorativo: es lo que hay que rellenar. Si esta frase y la
 * interfaz dejan de coincidir, quien abra el sexto color contará mal y dejará
 * un campo fuera — que es el fallo callado que este fichero existe para evitar.
 * **Al añadir un campo, actualiza este número.**
 *
 * ═══ LO QUE NO ES UN COLOR ═══
 *
 * `ALL`, `SUPERVISION`, `NONE` y `UNASSIGNED` conviven con los colores en
 * varios sitios y NO son colores: son respuestas a otra pregunta —«todos»,
 * «supervisa el piso», «libra», «sin asignar»—. Viven aparte a propósito, para
 * que un bucle sobre los colores no los recorra sin querer.
 *
 * ═══ EL ORDEN IMPORTA ═══
 *
 * Es el orden en que el piso los nombra y en que salen en los selectores. No se
 * ordena alfabéticamente ni por el enum: se ordena como se dicen.
 *
 * ═══ LO QUE ESTO **NO** SABE ═══
 *
 * Qué colores tienen residentes. Eso se pregunta a la base
 * (`derivePopulatedColors` en `shift-coverage.ts`), NUNCA se escribe aquí. Una
 * lista de colores poblados en el código es un dato disfrazado de constante, y
 * caduca el día que alguien mueve un residente.
 */

/** Un color de grupo, con todo lo que cualquier pantalla puede necesitar. */
export interface ColorDeGrupo {
    /** El valor del enum `ColorGroup` en la base. */
    codigo: string;
    /** Como lo dice el piso. NUNCA se enseña el código en pantalla. */
    nombre: string;
    /** El mismo nombre en mayúsculas, que es lo que acepta `GrupoBadge`. */
    nombreMayus: string;
    /** «los rojos», «los morados» — para hablar de los residentes del grupo. */
    plural: string;
    /** El color base de la marca. */
    hex: string;
    /** El mismo color en RGB para el PDF del censo (jsPDF no entiende hex). */
    rgb: readonly [number, number, number];
    /** Punto de color: un círculo pequeño y saturado. */
    punto: string;
    /** Píldora suave: tinte + texto + borde. Lo más usado. */
    pildora: string;
    /** Fondo de tarjeta: tinte muy claro + borde. */
    fondoSuave: string;
    /** Píldora clarísima: el tinte más suave + texto + borde. */
    pildoraClara: string;
    /** Chip sólido: fondo saturado. */
    solido: string;
    /**
     * El color del texto que va ENCIMA de `solido`.
     *
     * El amarillo no lo lleva blanco: sobre ámbar el texto blanco no se lee.
     * Es el único que rompe la regla y por eso el campo existe en vez de
     * escribirse `text-white` en cada sitio.
     */
    solidoTexto: string;
    /** La insignia de `GrupoBadge`: tinte, borde, texto y punto a medida. */
    insignia: { bg: string; border: string; text: string; dot: string };
    /**
     * Borde izquierdo de 4px de la tarjeta del wall (`RondaCard`).
     *
     * Escrito ENTERO a proposito, aunque sea `hex` repetido. Tailwind genera las
     * clases leyendo el codigo como texto: `border-l-[${'${hex}'}]` construido con
     * un template nunca aparece escrito en ninguna parte, asi que la clase no se
     * genera y el borde desaparece sin un solo error. Las clases de este fichero
     * son texto literal porque es la unica forma de que existan.
     */
    bordeIzq: string;
    /** Botón grande de la tableta: fondo + su hover. */
    boton: string;
    /** Solo el borde claro, para la tarjeta que agrupa por color. */
    borde: string;
    /** El anillo de «seleccionado» del selector de grupo de la ficha. */
    anillo: string;
    /** Sobre fondo oscuro (la pantalla de vitales): tinte + borde + texto. */
    enOscuro: string;
    /** Tecla rápida en el constructor de horarios. */
    tecla: string;
}

/**
 * Los colores reales, en el orden en que se nombran.
 *
 * MORADO se añade el 02-oct-2026, cuando el hogar pasó de 32 a 33 residentes y
 * tres grupos de once dejaron de repartirse solos.
 *
 * Los `hex` y las `insignia` de los cuatro primeros vienen de `GrupoBadge`, que
 * era la única definición visual canónica que había. Los `rgb` vienen del PDF
 * del censo y NO son los mismos valores: son los de la paleta de Tailwind.
 * Se dejan los dos juegos a propósito — unificarlos cambiaría el color del
 * censo impreso, que no es lo que se pidió.
 *
 * El morado se elige por distancia: a brillo bajo en una tableta no se confunde
 * con el rojo ni con el azul, que son los dos vecinos peligrosos.
 */
export const COLORES_DE_GRUPO = [
    {
        codigo: 'RED', nombre: 'Rojo', nombreMayus: 'ROJO', plural: 'rojos',
        hex: '#D9534F', rgb: [239, 68, 68],
        punto: 'bg-red-500',
        pildora: 'bg-red-100 text-red-700 border-red-200',
        fondoSuave: 'bg-red-50 border-red-200',
        pildoraClara: 'bg-red-50 text-red-700 border-red-200',
        solido: 'bg-red-600',
        solidoTexto: 'text-white',
        insignia: { bg: 'bg-[#FCEDEC]', border: 'border-[#F0B5B3]', text: 'text-[#A23B38]', dot: 'bg-[#D9534F]' },
        bordeIzq: 'border-l-[#D9534F]',
        boton: 'bg-red-500 hover:bg-red-600',
        borde: 'border-red-200',
        anillo: 'ring-red-500',
        enOscuro: 'bg-red-500/10 border-red-500 text-red-400',
        tecla: '1',
    },
    {
        codigo: 'YELLOW', nombre: 'Amarillo', nombreMayus: 'AMARILLO', plural: 'amarillos',
        hex: '#E5A93D', rgb: [245, 158, 11],
        punto: 'bg-amber-400',
        pildora: 'bg-amber-100 text-amber-700 border-amber-200',
        fondoSuave: 'bg-amber-50 border-amber-200',
        pildoraClara: 'bg-amber-50 text-amber-700 border-amber-200',
        solido: 'bg-amber-500',
        solidoTexto: 'text-slate-900',
        insignia: { bg: 'bg-[#FBF1DA]', border: 'border-[#EFD18C]', text: 'text-[#8A6420]', dot: 'bg-[#E5A93D]' },
        bordeIzq: 'border-l-[#E5A93D]',
        boton: 'bg-amber-400 hover:bg-amber-500',
        borde: 'border-amber-200',
        anillo: 'ring-amber-400',
        enOscuro: 'bg-amber-400/10 border-amber-400 text-amber-400',
        tecla: '2',
    },
    {
        codigo: 'GREEN', nombre: 'Verde', nombreMayus: 'VERDE', plural: 'verdes',
        hex: '#22A06B', rgb: [16, 185, 129],
        punto: 'bg-emerald-500',
        pildora: 'bg-emerald-100 text-emerald-700 border-emerald-200',
        fondoSuave: 'bg-emerald-50 border-emerald-200',
        pildoraClara: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        solido: 'bg-emerald-500',
        solidoTexto: 'text-white',
        insignia: { bg: 'bg-[#DDF3E8]', border: 'border-[#A4DEC0]', text: 'text-[#1A6E4B]', dot: 'bg-[#22A06B]' },
        bordeIzq: 'border-l-[#22A06B]',
        boton: 'bg-emerald-500 hover:bg-emerald-600',
        borde: 'border-emerald-200',
        anillo: 'ring-emerald-500',
        enOscuro: 'bg-emerald-500/10 border-emerald-500 text-emerald-400',
        tecla: '3',
    },
    {
        codigo: 'BLUE', nombre: 'Azul', nombreMayus: 'AZUL', plural: 'azules',
        hex: '#2563EB', rgb: [59, 130, 246],
        punto: 'bg-blue-500',
        pildora: 'bg-blue-100 text-blue-700 border-blue-200',
        fondoSuave: 'bg-blue-50 border-blue-200',
        pildoraClara: 'bg-blue-50 text-blue-700 border-blue-200',
        solido: 'bg-blue-600',
        solidoTexto: 'text-white',
        insignia: { bg: 'bg-[#DDE9FC]', border: 'border-[#A6C0EE]', text: 'text-[#1E489E]', dot: 'bg-[#2563EB]' },
        bordeIzq: 'border-l-[#2563EB]',
        boton: 'bg-blue-500 hover:bg-blue-600',
        borde: 'border-blue-200',
        anillo: 'ring-blue-500',
        enOscuro: 'bg-blue-500/10 border-blue-500 text-blue-400',
        tecla: '4',
    },
    {
        codigo: 'PURPLE', nombre: 'Morado', nombreMayus: 'MORADO', plural: 'morados',
        hex: '#7C3AED', rgb: [168, 85, 247],
        punto: 'bg-purple-500',
        pildora: 'bg-purple-100 text-purple-700 border-purple-200',
        fondoSuave: 'bg-purple-50 border-purple-200',
        pildoraClara: 'bg-purple-50 text-purple-700 border-purple-200',
        solido: 'bg-purple-600',
        solidoTexto: 'text-white',
        insignia: { bg: 'bg-[#EDE9FE]', border: 'border-[#C4B5FD]', text: 'text-[#5B21B6]', dot: 'bg-[#7C3AED]' },
        bordeIzq: 'border-l-[#7C3AED]',
        // '5' ya era «toda la sede» en el constructor desde antes. Mover una
        // tecla que el personal ya tiene en los dedos cuesta más que saltar un
        // número, así que el morado entra por el 6.
        boton: 'bg-purple-500 hover:bg-purple-600',
        borde: 'border-purple-200',
        anillo: 'ring-purple-500',
        enOscuro: 'bg-purple-500/10 border-purple-500 text-purple-400',
        // El 5 ya era «toda la sede» en el constructor desde antes. Mover una
        // tecla que el personal ya tiene en los dedos cuesta más que saltar un
        // número, así que el morado entra por el 6.
        tecla: '6',
    },
] as const satisfies readonly ColorDeGrupo[];

/**
 * Los tipos salen de la lista, no al lado de la lista.
 *
 * `as const satisfies` es lo que lo permite: el `as const` conserva los
 * literales para que TypeScript pueda derivar las uniones, y el `satisfies`
 * sigue comprobando que cada fila esté completa. Anotar el array
 * `: readonly ColorDeGrupo[]` —que es lo natural— borraría los literales y
 * obligaría a escribir las uniones a mano, que es el problema otra vez.
 */
export type CodigoDeColor = typeof COLORES_DE_GRUPO[number]['codigo'];
export type NombreMayusDeColor = typeof COLORES_DE_GRUPO[number]['nombreMayus'];

/** Solo los códigos, en el mismo orden. */
export const CODIGOS_DE_COLOR: readonly string[] = COLORES_DE_GRUPO.map(c => c.codigo);

/**
 * Lo que NO es un color pero vive en los mismos campos.
 *
 * `UNASSIGNED` es el `@default` del enum: un residente que todavía no está en
 * ningún grupo. `ALL` significa «toda la sede» y solo se recomienda de noche.
 * `SUPERVISION` y `NONE` son del constructor de horarios: quien supervisa el
 * piso no lleva color, y quien libra tampoco.
 */
export const NO_ES_UN_COLOR = ['ALL', 'SUPERVISION', 'NONE', 'UNASSIGNED'] as const;

/** ¿Es uno de los colores de grupo de verdad? */
export function esColorReal(valor: string | null | undefined): boolean {
    return !!valor && CODIGOS_DE_COLOR.includes(valor);
}

/** La fila entera de un color, o `undefined` si no es un color. */
export function colorDeGrupo(valor: string | null | undefined): ColorDeGrupo | undefined {
    return COLORES_DE_GRUPO.find(c => c.codigo === valor);
}

/**
 * Como lo dice el piso. Para lo que no es un color, devuelve su propia palabra.
 *
 * Nunca devuelve el código en bruto: si llega algo desconocido dice que no se
 * sabe, en vez de enseñar «PURPLE» a una cuidadora.
 */
export function nombreDeColor(valor: string | null | undefined): string {
    const c = colorDeGrupo(valor);
    if (c) return c.nombre;
    switch (valor) {
        case 'ALL':         return 'Todos';
        case 'SUPERVISION': return 'Supervisión';
        case 'NONE':        return 'Libra';
        default:            return 'Sin grupo';
    }
}

/** Mapas código → valor, para quien ya tenía uno escrito a mano. */
export const NOMBRES_DE_COLOR: Record<string, string> = Object.fromEntries(COLORES_DE_GRUPO.map(c => [c.codigo, c.nombre]));
export const PUNTO_DE_COLOR: Record<string, string> = Object.fromEntries(COLORES_DE_GRUPO.map(c => [c.codigo, c.punto]));
export const PILDORA_DE_COLOR: Record<string, string> = Object.fromEntries(COLORES_DE_GRUPO.map(c => [c.codigo, c.pildora]));
export const PILDORA_CLARA_DE_COLOR: Record<string, string> = Object.fromEntries(COLORES_DE_GRUPO.map(c => [c.codigo, c.pildoraClara]));
export const FONDO_SUAVE_DE_COLOR: Record<string, string> = Object.fromEntries(COLORES_DE_GRUPO.map(c => [c.codigo, c.fondoSuave]));
export const SOLIDO_DE_COLOR: Record<string, string> = Object.fromEntries(COLORES_DE_GRUPO.map(c => [c.codigo, c.solido]));
export const HEX_DE_COLOR: Record<string, string> = Object.fromEntries(COLORES_DE_GRUPO.map(c => [c.codigo, c.hex]));
export const RGB_DE_COLOR: Record<string, readonly [number, number, number]> = Object.fromEntries(COLORES_DE_GRUPO.map(c => [c.codigo, c.rgb]));
export const TECLA_DE_COLOR: Record<string, string> = Object.fromEntries(COLORES_DE_GRUPO.map(c => [c.tecla, c.codigo]));
