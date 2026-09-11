"use client";

/**
 * EL PAPEL DE ACADEMY — la hoja, la tinta y el texto de un curso.
 *
 * Andrés, 10-sep-2026: "me gustaría que los cursos fueran bonitos, interactivos
 * y agradables a la vista. que no sea texto seco."
 *
 * ─────────────────────────────────────────────────────────────────────────
 * QUÉ ESTABA PASANDO DE VERDAD
 *
 * El texto se pintaba con `prose prose-invert prose-sm`, y esas clases NO
 * EXISTEN en este repo: `@tailwindcss/typography` no está instalado. Así que lo
 * que salía era sans de 14px, a todo el ancho de una tableta, sobre slate-900
 * casi negro — para una mujer de 50 años leyendo en el pasillo a media luz.
 *
 * Y `react-markdown` iba sin `remark-gfm`, así que las tablas del contenido ni
 * se parseaban: la de "Lo que SÍ te toca / Lo que NO te toca" —en el curso con
 * más matrículas— salía como una línea de barras verticales.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LAS DECISIONES, Y POR QUÉ
 *
 * PAPEL CREMA Y SERIF. Decisión de Andrés sobre seguir en oscuro. El registro
 * es el de un documento que acredita, no el de otra pantalla operativa — su
 * directriz del 19-ago-2026: "Academy debe tener aspecto de ACADEMIA".
 *
 * UNA COLUMNA DE 62 CARACTERES. Un renglón de tableta entera son 120 y el ojo
 * se pierde al volver. 62 es el ancho de un libro, y no es estética: es la
 * diferencia entre leer 300 palabras y abandonarlas.
 *
 * LA HOJA NO CAMBIA ENTRE LEER Y CONTESTAR. Antes la lectura y el examen eran
 * dos pantallas distintas, y contestar se sentía como un trámite aparte. Aquí
 * la pregunta aparece en el mismo papel, con la misma tinta: sigue siendo el
 * mismo documento, una página más adelante.
 *
 * TAMAÑO Y LUZ BAJA, QUE SE RECUERDAN. El turno de noche lee esto a las 3am.
 * "Luz baja" es CÁLIDO (#1A1713), no el azul de slate-900: el azul a esa hora
 * es exactamente lo que no se debe mirar. Y el tamaño se guarda porque quien lo
 * sube una vez lo quiere subido siempre.
 *
 * SIN EMOJI. Decisión de Andrés el 10-sep-2026, y es deliberadamente
 * inconsistente con el resto del producto: dentro de Academy el registro es
 * institucional. Fuera de Academy, los emoji se quedan.
 */
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { createContext, useContext, useEffect, useState } from 'react';

export type Tamano = 1 | 2 | 3;

/**
 * Si el <li> que se está pintando cuelga de una lista numerada o de una de
 * viñetas.
 *
 * Se intentó primero mirando `node.parentNode` dentro del `li`, que es lo que
 * uno haría — y en react-markdown 10 ese dato no llega. El resultado era que
 * los pasos numerados de un protocolo ("1. Lávate las manos, 2. Ponte los
 * guantes…") salían todos con la misma rayita y SIN NÚMERO: en un curso
 * clínico, el orden de los pasos es la mitad de la instrucción.
 */
const TipoDeLista = createContext<'ol' | 'ul'>('ul');

/**
 * El cuerpo, el interlineado y EL ANCHO DE LA COLUMNA de cada tamaño.
 *
 * El ancho va en píxeles y no en `ch` a propósito. Con `ch`, la portadilla
 * —que es sans— y el cuerpo —que es serif— medían dos columnas distintas y
 * el título quedaba 30px a la izquierda del primer párrafo. Un solo número
 * por tamaño mantiene el borde izquierdo alineado en toda la hoja.
 *
 * Los tres valores son ~62 caracteres de Source Serif 4 a ese cuerpo.
 */
const ESCALA: Record<Tamano, { px: number; alto: number; ancho: number }> = {
    1: { px: 17, alto: 1.68, ancho: 560 },
    2: { px: 19, alto: 1.72, ancho: 620 },
    3: { px: 22, alto: 1.76, ancho: 700 },
};

/** El ancho de la columna. Lo usan la hoja, la portadilla y el texto. */
export const anchoColumna = (t: Tamano) => ESCALA[t].ancho;

/**
 * La serif DE LA CASA, no una cualquiera. El layout raíz ya carga Source Serif 4
 * como `--font-serif-academy` y la nota dice por qué: "font-serif sin fuente
 * propia caía al Times del sistema, distinto en cada máquina". Poner Georgia
 * aquí habría vuelto a ese error por otra puerta.
 */
export const SERIF = 'var(--font-serif-academy), Georgia, "Times New Roman", serif';

/**
 * Papel y tinta. La luz baja es cálida a propósito — ver cabecera.
 *
 * `fallo` no es rojo de alarma: es tierra quemada. En el piso el rojo significa
 * una emergencia clínica, y equivocarse en una pregunta de estudio no lo es.
 */
export const PAPEL = {
    claro: {
        fondo: '#FBF7EF', hoja: '#FFFDF8', tinta: '#1F2A24', suave: '#5E6B63',
        filete: '#E3DCCC', realce: '#0F6E56', realceSuave: '#ECF4F0',
        fallo: '#9C4221', falloSuave: '#FAEFE9',
    },
    bajo: {
        fondo: '#1A1713', hoja: '#211D18', tinta: '#E8E0D2', suave: '#A79C88',
        filete: '#3A332A', realce: '#6FDDB1', realceSuave: '#1E2E27',
        fallo: '#E0906F', falloSuave: '#2E211A',
    },
};

export type Tinta = typeof PAPEL.claro;

const CLAVE = 'zendity.academy.lectura';

export function usarPreferencias() {
    const [tamano, setTamano] = useState<Tamano>(2);
    const [luzBaja, setLuzBaja] = useState(false);

    useEffect(() => {
        try {
            const g = JSON.parse(localStorage.getItem(CLAVE) ?? '{}');
            if (g.tamano === 1 || g.tamano === 2 || g.tamano === 3) setTamano(g.tamano);
            if (typeof g.luzBaja === 'boolean') setLuzBaja(g.luzBaja);
        } catch { /* sin preferencia guardada, valores por defecto */ }
    }, []);

    useEffect(() => {
        try { localStorage.setItem(CLAVE, JSON.stringify({ tamano, luzBaja })); } catch { /* da igual */ }
    }, [tamano, luzBaja]);

    const c: Tinta = luzBaja ? PAPEL.bajo : PAPEL.claro;
    return { tamano, setTamano, luzBaja, setLuzBaja, c };
}

/** Los controles de arriba a la derecha. Discretos, no una barra de herramientas. */
export function ControlesDeLectura({ tamano, setTamano, luzBaja, setLuzBaja, c }: {
    tamano: Tamano; setTamano: (t: Tamano) => void;
    luzBaja: boolean; setLuzBaja: (v: boolean) => void; c: Tinta;
}) {
    return (
        <div className="flex items-center gap-1">
            {([1, 2, 3] as Tamano[]).map(t => (
                <button key={t} onClick={() => setTamano(t)} aria-label={`Tamaño de letra ${t} de 3`}
                    className="w-8 h-8 rounded-lg transition-colors flex items-center justify-center"
                    style={{
                        fontSize: 10 + t * 2, fontFamily: SERIF,
                        color: tamano === t ? c.hoja : c.suave,
                        backgroundColor: tamano === t ? c.realce : 'transparent',
                    }}>
                    A
                </button>
            ))}
            <button onClick={() => setLuzBaja(!luzBaja)}
                className="ml-1 px-3 h-8 rounded-lg text-[11px] font-bold transition-colors whitespace-nowrap"
                style={{ color: c.suave, border: `1px solid ${c.filete}` }}>
                {luzBaja ? 'Luz normal' : 'Luz baja'}
            </button>
        </div>
    );
}

/**
 * LA HOJA. Todas las pantallas del curso viven dentro de esta misma.
 *
 * Cabecera fina, cuerpo que corre, pie con la acción. Si cambia el papel,
 * cambia en un solo sitio — que es lo contrario de lo que había: seis
 * pantallas con el mismo `bg-slate-900` copiado seis veces.
 */
export function Hoja({ c, tamano = 2, cabecera, pie, children, centrado = false }: {
    c: Tinta;
    tamano?: Tamano;
    cabecera?: React.ReactNode;
    pie?: React.ReactNode;
    children: React.ReactNode;
    centrado?: boolean;
}) {
    return (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: c.fondo, color: c.tinta }}>
            {cabecera && (
                <div className="px-4 sm:px-6 py-2.5 flex items-center justify-between gap-2 sm:gap-3 flex-shrink-0"
                    style={{ borderBottom: `1px solid ${c.filete}` }}>
                    {cabecera}
                </div>
            )}
            <div className={`flex-1 overflow-y-auto px-5 sm:px-8 ${centrado ? 'flex flex-col items-center justify-center text-center py-10' : 'py-8 sm:py-12'}`}>
                {children}
            </div>
            {pie && (
                <div className="px-5 sm:px-8 py-4 flex-shrink-0" style={{ borderTop: `1px solid ${c.filete}` }}>
                    <div className="mx-auto" style={{ maxWidth: anchoColumna(tamano) }}>{pie}</div>
                </div>
            )}
        </div>
    );
}

/** El botón que lleva adelante. Uno por pantalla; si hay dos, el otro es texto. */
export function BotonPrincipal({ c, onClick, children, disabled }: {
    c: Tinta; onClick: () => void; children: React.ReactNode; disabled?: boolean;
}) {
    return (
        <button onClick={onClick} disabled={disabled}
            className="w-full py-4 rounded-xl font-bold transition-opacity disabled:opacity-40"
            style={{ backgroundColor: c.realce, color: c.fondo, fontFamily: SERIF, fontSize: 17, letterSpacing: '0.01em' }}>
            {children}
        </button>
    );
}

/** El de salir, de renunciar, de "lo dejo por hoy". Nunca compite con el principal. */
export function BotonDiscreto({ c, onClick, children }: {
    c: Tinta; onClick: () => void; children: React.ReactNode;
}) {
    return (
        <button onClick={onClick} className="text-[13px] py-2 hover:opacity-70 transition-opacity"
            style={{ color: c.suave }}>
            {children}
        </button>
    );
}

/** El hilo de secciones de la cabecera: dónde voy y cuánto falta. */
export function HiloDeSecciones({ c, total, actual }: { c: Tinta; total: number; actual: number }) {
    return (
        <div className="flex items-center gap-1.5" aria-label={`Sección ${actual + 1} de ${total}`}>
            {Array.from({ length: total }, (_, i) => (
                <span key={i} className="h-[3px] rounded-full transition-all"
                    style={{
                        width: i === actual ? 26 : 14,
                        backgroundColor: i <= actual ? c.realce : c.filete,
                        opacity: i < actual ? 0.5 : 1,
                    }} />
            ))}
        </div>
    );
}

/** La columna de texto. Todo lo que se lee en Academy pasa por este ancho. */
export function Columna({ children, tamano = 2, className = '' }: {
    children: React.ReactNode; tamano?: Tamano; className?: string;
}) {
    return <div className={`mx-auto ${className}`} style={{ maxWidth: anchoColumna(tamano) }}>{children}</div>;
}

/**
 * Un punto de lista. Las numeradas conservan su número; las de viñeta llevan un
 * filete corto en vez de un punto — pesa menos y deja el ojo en el texto.
 */
function Punto({ c, cuerpo, children }: { c: Tinta; cuerpo: number; children: React.ReactNode }) {
    if (useContext(TipoDeLista) === 'ol') return <li className="pl-1">{children}</li>;
    return (
        <li className="flex gap-3">
            <span aria-hidden className="flex-shrink-0"
                style={{ marginTop: cuerpo * 0.72, width: 13, height: 2, backgroundColor: c.realce, opacity: 0.55 }} />
            <span className="flex-1">{children}</span>
        </li>
    );
}

/**
 * El texto del curso.
 *
 * `ocultarPrimerTitulo`: la LECTURA empieza con un `# Título` que es el nombre
 * de la sección, y la portadilla de arriba ya lo enseña. Se pintaba DOS VECES.
 */
export function Lectura({ markdown, tamano, c, ocultarPrimerTitulo = true }: {
    markdown: string; tamano: Tamano; c: Tinta; ocultarPrimerTitulo?: boolean;
}) {
    const e = ESCALA[tamano];
    const texto = ocultarPrimerTitulo ? markdown.replace(/^\s*#\s+.*\n/, '') : markdown;

    return (
        <div className="mx-auto" style={{
            maxWidth: e.ancho, fontFamily: SERIF,
            fontSize: e.px, lineHeight: e.alto, color: c.tinta,
        }}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    h1: ({ children }) => (
                        <h2 style={{ color: c.tinta, fontSize: e.px * 1.35, lineHeight: 1.25 }}
                            className="font-bold mt-10 mb-4">{children}</h2>
                    ),
                    h2: ({ children }) => (
                        <h3 style={{ color: c.tinta, fontSize: e.px * 1.15, lineHeight: 1.3 }}
                            className="font-bold mt-8 mb-3">{children}</h3>
                    ),
                    h3: ({ children }) => (
                        <h4 style={{ color: c.suave, fontSize: e.px * 0.76, letterSpacing: '0.1em' }}
                            className="font-bold uppercase mt-7 mb-2">{children}</h4>
                    ),
                    p: ({ children }) => <p className="mb-5">{children}</p>,
                    strong: ({ children }) => <strong style={{ color: c.tinta }} className="font-bold">{children}</strong>,
                    em: ({ children }) => <em className="italic">{children}</em>,
                    ul: ({ children }) => (
                        <TipoDeLista.Provider value="ul">
                            <ul className="mb-5 space-y-2.5">{children}</ul>
                        </TipoDeLista.Provider>
                    ),
                    ol: ({ children }) => (
                        <TipoDeLista.Provider value="ol">
                            <ol className="mb-5 space-y-3 list-decimal marker:font-bold"
                                style={{ paddingLeft: '1.5em' }}>{children}</ol>
                        </TipoDeLista.Provider>
                    ),
                    li: ({ children }) => <Punto c={c} cuerpo={e.px}>{children}</Punto>,
                    blockquote: ({ children }) => (
                        <blockquote className="my-7 pl-5 italic"
                            style={{ borderLeft: `3px solid ${c.realce}`, color: c.suave }}>{children}</blockquote>
                    ),
                    hr: () => <hr className="my-9 border-0 h-px" style={{ backgroundColor: c.filete }} />,
                    a: ({ children }) => <span style={{ color: c.realce }}>{children}</span>,
                    code: ({ children }) => (
                        <code className="px-1.5 py-0.5 rounded text-[0.9em]"
                            style={{ backgroundColor: c.realceSuave, fontFamily: 'ui-monospace, monospace' }}>{children}</code>
                    ),

                    /* ── Las tablas. Antes ni se parseaban: faltaba remark-gfm. ── */
                    table: ({ children }) => (
                        <div className="my-7 overflow-x-auto">
                            <table className="w-full border-collapse" style={{ fontSize: e.px * 0.92 }}>{children}</table>
                        </div>
                    ),
                    thead: ({ children }) => <thead style={{ borderBottom: `2px solid ${c.realce}` }}>{children}</thead>,
                    th: ({ children }) => (
                        <th className="text-left font-bold py-2.5 px-3"
                            style={{ color: c.realce, fontSize: e.px * 0.74, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                            {children}
                        </th>
                    ),
                    tr: ({ children }) => <tr style={{ borderBottom: `1px solid ${c.filete}` }}>{children}</tr>,
                    td: ({ children }) => <td className="py-3 px-3 align-top">{children}</td>,
                }}
            >
                {texto}
            </ReactMarkdown>
        </div>
    );
}
