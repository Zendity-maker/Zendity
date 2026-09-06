/**
 * EL PDF DE LAS GUÍAS DE CAMBIOS
 * ──────────────────────────────
 * Un PDF por rol, para las reuniones de turno.
 *
 * NO ES UN LISTADO DE CAMBIOS. Un changelog está escrito desde el punto de
 * vista del software y no se recuerda. Cada punto es: qué pasaba antes, qué
 * hacer ahora, y EL CASO REAL que lo provocó — porque los casos son suyos.
 * Fernando, Carmen, la avena, el Warfarin. Nadie olvida una regla cuando la
 * regla tiene la cara de alguien.
 *
 * ESTÁ AQUÍ Y NO EN EL SCRIPT porque en septiembre hubo dos bloques de cambios
 * y va a haber más. Un generador por bloque es la forma de que la guía de
 * octubre no se parezca a la de septiembre y nadie sepa cuál está leyendo — el
 * mismo problema que tuvo el PAI con sus dos caminos.
 *
 * OJO CON LOS GLIFOS. Las fuentes estándar de jsPDF (helvetica) no traen ni la
 * flecha → ni la casilla ☐: salen impresos como basura, y no avisa nadie — el
 * PDF se genera igual. Para rutas de menú usa ">" y para casillas dibuja un
 * rect(). Se descubrió el 06-sep-2026 con "Menú → Rotación / UPP".
 */
import jsPDF from 'jspdf';

const TEAL: [number, number, number] = [15, 110, 86];
const INK: [number, number, number] = [31, 45, 58];
const MUTED: [number, number, number] = [100, 116, 139];
const LINE: [number, number, number] = [226, 232, 240];
const CASO_BG: [number, number, number] = [254, 249, 235];
const CASO_BR: [number, number, number] = [234, 179, 8];
const M = 16;

export interface Punto {
    titulo: string;
    antes: string;
    ahora: string;
    /** El caso real. Es lo que hace que se recuerde. */
    caso?: string;
    /** Dónde está, con las palabras que se ven en pantalla. */
    donde?: string;
}

export interface Guia {
    archivo: string;
    paraQuien: string;
    entradilla: string;
    puntos: Punto[];
    cierre: string;
    /** Lo que sale arriba a la derecha y en el pie. */
    periodo?: string;
    /** Cambia el titulo de la cabecera cuando hace falta. */
    titulo?: string;
}

export function generarGuiaPDF(g: Guia): ArrayBuffer {
    const doc = new jsPDF({ unit: 'mm', format: 'letter' });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const setFill = (c: [number, number, number]) => doc.setFillColor(c[0], c[1], c[2]);
    const setText = (c: [number, number, number]) => doc.setTextColor(c[0], c[1], c[2]);
    const setDraw = (c: [number, number, number]) => doc.setDrawColor(c[0], c[1], c[2]);

    let y = 0, pagina = 1;
    const pie = () => {
        setText(MUTED);
        doc.setFont('helvetica', 'normal').setFontSize(7.5);
        doc.text(`Zéndity · ${g.paraQuien} · ${(g.periodo ?? 'septiembre 2026').toLowerCase()} · página ${pagina}`, M, H - 9);
    };
    const salto = () => { pie(); doc.addPage(); pagina++; y = M + 4; };
    const sitio = (mm: number) => { if (y + mm > H - 16) salto(); };

    const parrafo = (texto: string, tam: number, color: [number, number, number], estilo: 'normal' | 'bold' | 'italic', sangria = 0) => {
        setText(color);
        doc.setFont('helvetica', estilo).setFontSize(tam);
        for (const ln of doc.splitTextToSize(texto, W - 2 * M - sangria) as string[]) {
            sitio(tam * 0.55);
            doc.text(ln, M + sangria, y);
            y += tam * 0.52;
        }
    };

    // Cabecera
    setFill(TEAL);
    doc.rect(0, 0, W, 34, 'F');
    setText([255, 255, 255]);
    doc.setFont('helvetica', 'bold').setFontSize(17);
    doc.text(g.titulo ?? 'Lo que cambió en Zéndity', M, 15);
    doc.setFont('helvetica', 'normal').setFontSize(10);
    doc.text(g.paraQuien, M, 23);
    doc.setFontSize(8.5);
    doc.text(g.periodo ?? 'Septiembre 2026', W - M, 15, { align: 'right' });
    y = 44;

    parrafo(g.entradilla, 10.5, INK, 'normal');
    y += 6;

    g.puntos.forEach((p, i) => {
        sitio(40);
        setDraw(LINE);
        doc.line(M, y, W - M, y);
        y += 7;

        setText(TEAL);
        doc.setFont('helvetica', 'bold').setFontSize(9);
        doc.text(String(i + 1).padStart(2, '0'), M, y);
        setText(INK);
        doc.setFont('helvetica', 'bold').setFontSize(13);
        doc.text(p.titulo, M + 9, y);
        y += 7;

        parrafo(`Antes:  ${p.antes}`, 10, MUTED, 'normal', 9);
        y += 1.5;
        parrafo(`Ahora:  ${p.ahora}`, 10.5, INK, 'bold', 9);
        y += 2;

        if (p.donde) {
            parrafo(`Dónde: ${p.donde}`, 9, TEAL, 'normal', 9);
            y += 1;
        }

        if (p.caso) {
            const lineas = doc.splitTextToSize(p.caso, W - 2 * M - 20) as string[];
            const alto = lineas.length * 4.6 + 8;
            sitio(alto + 4);
            setFill(CASO_BG); setDraw(CASO_BR);
            doc.setLineWidth(0.8);
            doc.rect(M + 9, y - 1, W - 2 * M - 9, alto, 'F');
            doc.line(M + 9, y - 1, M + 9, y - 1 + alto);
            doc.setLineWidth(0.2);
            setText([120, 80, 10]);
            doc.setFont('helvetica', 'italic').setFontSize(9.5);
            let yy = y + 4.5;
            for (const ln of lineas) { doc.text(ln, M + 14, yy); yy += 4.6; }
            y += alto + 3;
        }
        y += 4;
    });

    sitio(26);
    setDraw(LINE);
    doc.line(M, y, W - M, y);
    y += 8;
    parrafo(g.cierre, 10, INK, 'normal');

    pie();
    return doc.output('arraybuffer');
}
