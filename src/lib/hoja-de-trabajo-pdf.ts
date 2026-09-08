/**
 * HOJAS DE TRABAJO — las que se llenan a mano con el residente delante
 * ───────────────────────────────────────────────────────────────────
 * Un mismo papel para dos cosas que ya existen y las que vengan: la hoja de
 * ruta de la piel y la de caídas sin registrar. Las dos tienen la misma forma
 * —lo que alguien escribió, y huecos para lo que hay que averiguar— y la única
 * diferencia son los campos.
 *
 * ESTÁ AQUÍ Y NO DENTRO DE UN SCRIPT porque ya pasó con las guías por rol: un
 * generador por documento acaba en dos papeles que no se parecen y nadie sabe
 * cuál está leyendo. Fue el mismo problema del PAI con sus dos caminos.
 *
 * LA NOTA LITERAL NO SE RESUME. Es lo que escribió quien estaba delante, y es
 * lo único de primera mano que va a tener quien rellene el papel semanas
 * después. Un resumen ya sería una interpretación.
 */
import jsPDF from 'jspdf';

const TEAL: [number, number, number] = [15, 110, 86];
const INK: [number, number, number] = [31, 45, 58];
const MUTED: [number, number, number] = [100, 116, 139];
const LINE: [number, number, number] = [203, 213, 225];
const CITA_BG: [number, number, number] = [255, 251, 235];
const AMBAR: [number, number, number] = [180, 83, 9];
const M = 16;

/** Un hueco que hay que rellenar a mano. */
export interface Campo {
    etiqueta: string;
    /** Opciones para marcar. Si va vacío, es una raya para escribir. */
    opciones?: string[];
    /** Cuántas rayas cuando es texto libre. */
    lineas?: number;
    /**
     * Media anchura. Dos `corto` seguidos comparten fila.
     *
     * Sin esto cada hoja salía a UNA ficha por página: seis campos apilados no
     * caben dos veces, y cuatro caídas se convertían en cuatro hojas. El papel
     * que sobra no es neutro — una hoja de trabajo gruesa se pospone.
     */
    corto?: boolean;
}

export interface ItemDeTrabajo {
    titulo: string;
    subtitulo: string;
    /** Lo que escribió alguien, tal cual. */
    cita: string;
    /** Lo que se enseña grande a la derecha — normalmente los días. */
    marca?: string;
    /** Cierto si la marca debe llamar la atención. */
    marcaUrgente?: boolean;
    campos: Campo[];
}

export interface HojaDeTrabajo {
    titulo: string;
    hogar: string;
    /** Dos o tres frases: qué es esto y qué NO es. */
    entradilla: string;
    /** Qué hacer al volver con el papel lleno. */
    cierre: string;
    items: ItemDeTrabajo[];
    generadoAt: Date;
}

export function generarHojaDeTrabajo(h: HojaDeTrabajo): jsPDF {
    const doc = new jsPDF({ unit: 'mm', format: 'letter' });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const setFill = (c: [number, number, number]) => doc.setFillColor(c[0], c[1], c[2]);
    const setText = (c: [number, number, number]) => doc.setTextColor(c[0], c[1], c[2]);
    const setDraw = (c: [number, number, number]) => doc.setDrawColor(c[0], c[1], c[2]);

    let pagina = 0;
    let y = 0;

    const abrir = () => {
        if (pagina > 0) doc.addPage();
        pagina++;
        setFill(INK);
        doc.rect(0, 0, W, pagina === 1 ? 24 : 15, 'F');
        setText([255, 255, 255]);
        doc.setFont('helvetica', 'bold').setFontSize(pagina === 1 ? 14 : 10);
        doc.text(h.titulo.toUpperCase(), M, pagina === 1 ? 11 : 9);
        doc.setFont('helvetica', 'normal').setFontSize(pagina === 1 ? 8 : 7);
        doc.text(h.hogar, M, pagina === 1 ? 18 : 13);
        doc.setFontSize(7.5);
        doc.text(
            h.generadoAt.toLocaleDateString('es-PR', { dateStyle: 'long', timeZone: 'America/Puerto_Rico' }),
            W - M, pagina === 1 ? 11 : 9, { align: 'right' },
        );
        y = pagina === 1 ? 30 : 21;
    };

    abrir();
    setText(INK);
    doc.setFont('helvetica', 'normal').setFontSize(9.5);
    const intro = doc.splitTextToSize(h.entradilla, W - 2 * M) as string[];
    for (const ln of intro) { doc.text(ln, M, y); y += 4.6; }
    y += 4;

    h.items.forEach((it, i) => {
        // LA FUENTE SE FIJA ANTES DE MEDIR. splitTextToSize mide con la fuente
        // ACTIVA, que aquí era la de 6.5 de las etiquetas del item anterior:
        // partía líneas para un cuerpo más pequeño y luego se dibujaban a 8.5,
        // así que la cita se salía de la caja por la derecha.
        doc.setFont('helvetica', 'italic').setFontSize(8.5);
        const citaLineas = doc.splitTextToSize(`"${it.cita}"`, W - 2 * M - 10) as string[];
        // Cada campo con opciones ocupa una fila; los de texto, sus rayas.
        // Los `corto` seguidos van de dos en dos, así que solo cuenta la mitad.
        let altoCampos = 0;
        for (let k = 0; k < it.campos.length; k++) {
            const c = it.campos[k];
            const par = c.corto && it.campos[k + 1]?.corto;
            altoCampos += c.opciones ? 8 : 4 + (c.lineas ?? 1) * 7;
            if (par) k++;
        }
        const alto = 24 + citaLineas.length * 4.3 + 8 + altoCampos + 4;
        if (y + alto > H - 18) abrir();

        setDraw(LINE); doc.setLineWidth(0.4);
        doc.rect(M, y, W - 2 * M, alto - 4);
        doc.setLineWidth(0.2);

        setText(INK);
        doc.setFont('helvetica', 'bold').setFontSize(12);
        doc.text(`${i + 1}.  ${it.titulo}`, M + 4, y + 8);
        setText(MUTED);
        doc.setFont('helvetica', 'normal').setFontSize(8);
        doc.text(it.subtitulo, M + 4, y + 13.5);
        if (it.marca) {
            setText(it.marcaUrgente ? AMBAR : MUTED);
            doc.setFont('helvetica', 'bold').setFontSize(13);
            doc.text(it.marca, W - M - 4, y + 9, { align: 'right' });
        }

        let yy = y + 20;
        setFill(CITA_BG);
        doc.rect(M + 4, yy - 4, W - 2 * M - 8, citaLineas.length * 4.3 + 5, 'F');
        setText([120, 80, 10]);
        doc.setFont('helvetica', 'italic').setFontSize(8.5);
        for (const ln of citaLineas) { doc.text(ln, M + 7, yy); yy += 4.3; }
        yy += 6;

        const anchoUtil = W - 2 * M - 8;
        for (let k = 0; k < it.campos.length; k++) {
            const c = it.campos[k];
            const par = c.corto && it.campos[k + 1]?.corto ? it.campos[k + 1] : null;
            const pintar = (campo: Campo, x: number, ancho: number) => {
                setText(MUTED);
                doc.setFont('helvetica', 'bold').setFontSize(6.5);
                doc.text(campo.etiqueta.toUpperCase(), x, yy);
                if (campo.opciones) {
                    let cx = x + doc.getTextWidth(campo.etiqueta.toUpperCase()) + 6;
                    setText(INK);
                    doc.setFont('helvetica', 'normal').setFontSize(9);
                    for (const op of campo.opciones) {
                        setDraw(INK); doc.setLineWidth(0.4);
                        doc.rect(cx, yy - 3.2, 3.6, 3.6);
                        doc.setLineWidth(0.2);
                        doc.text(op, cx + 5.5, yy);
                        cx += 5.5 + doc.getTextWidth(op) + 8;
                    }
                } else {
                    setDraw(LINE);
                    let ly = yy;
                    for (let n = 0; n < (campo.lineas ?? 1); n++) { ly += 6; doc.line(x, ly, x + ancho, ly); ly += 1; }
                }
            };
            if (par) {
                const mitad = anchoUtil / 2 - 4;
                pintar(c, M + 4, mitad);
                pintar(par, M + 4 + anchoUtil / 2 + 4, mitad);
                yy += (c.opciones ? 8 : 4 + (c.lineas ?? 1) * 7);
                k++;
                continue;
            }
            if (c.opciones) {
                // Casillas DIBUJADAS: el carácter ☐ no existe en helvetica y
                // salía impreso como un "&".
                pintar(c, M + 4, anchoUtil);
                yy += 8;
            } else {
                pintar(c, M + 4, anchoUtil);
                yy += 4 + (c.lineas ?? 1) * 7;
            }
        }

        y += alto;
    });

    setText(MUTED);
    doc.setFont('helvetica', 'italic').setFontSize(7.5);
    for (const ln of doc.splitTextToSize(h.cierre, W - 2 * M - 30) as string[]) { doc.text(ln, M, H - 12); }
    setText(TEAL);
    doc.setFont('helvetica', 'bold').setFontSize(7.5);
    doc.text('ZÉNDITY', W - M, H - 7, { align: 'right' });
    setText(MUTED);
    doc.setFont('helvetica', 'normal');
    doc.text(`${h.hogar} · documento clínico con datos de residentes`, M, H - 7);

    return doc;
}
