/**
 * EL REGISTRO DE VISITAS, COMO DOCUMENTO
 * ──────────────────────────────────────
 * Hasta hoy este registro se sacaba imprimiendo la pantalla. Con las reglas de
 * impresión de AppLayout eso ya sale limpio —sin barras, sin recortes, con los
 * colores y la cabecera repetida— pero sigue siendo una página web impresa:
 *
 *   · el membrete solo aparece en la hoja 1. Las hojas 2 y 3 no dicen de qué
 *     hogar son ni de qué período, y este papel lo lee un inspector
 *   · el navegador añade SU cabecera y pie —la URL, la fecha— salvo que cada
 *     persona lo desmarque en su diálogo
 *   · no hay "Página 2 de 3" propio, ni márgenes fijos
 *
 * Un documento que sale del edificio no puede depender de cómo tenga cada quien
 * configurado el navegador. Este sí es un documento.
 *
 * LO QUE NO HACE, Y ES DELIBERADO: no rellena huecos. Una visita sin salida
 * registrada se imprime como "Sin registrar", y una que cerró el personal dice
 * que la cerró el personal. Falsear una hora en un registro firmado es peor que
 * el hueco — el hueco al menos es cierto.
 */
import jsPDF from 'jspdf';

// Misma paleta que continuity-pdf.ts y los reportes semanales.
const TEAL: [number, number, number] = [15, 110, 86];
const INK: [number, number, number] = [31, 45, 58];
const MUTED: [number, number, number] = [100, 116, 139];
const LINE: [number, number, number] = [226, 232, 240];
const ZEBRA: [number, number, number] = [248, 250, 252];
const WARN: [number, number, number] = [180, 83, 9];

const M = 12;

export const TIPO_VISITA: Record<string, string> = {
    FAMILIAR: 'Familiar',
    TOUR: 'Recorrido',
    OFICIAL: 'Oficial',
    SERVICIO_EXTERNO: 'Servicio externo',
};

export interface VisitaPDF {
    tipo: string;
    visitorName: string;
    profesion?: string | null;
    residentName?: string | null;
    entidad?: string | null;
    futuroResidente?: string | null;
    visitedAt: Date;
    departedAt?: Date | null;
    salidaCerradaAt?: Date | null;
    retenida?: boolean;
    fueraDeHorario?: boolean;
    signatureData?: string | null;
}

export interface RegistroVisitasMeta {
    hqName: string;
    hqPhone?: string | null;
    hqLogo?: string | null;
    generadoAt: Date;
    desde?: string | null;
    hasta?: string | null;
    /** Total en el período. Si es mayor que las filas, el papel lo dice. */
    totalEnRango: number;
    visitas: VisitaPDF[];
}

const hora = (d: Date) => d.toLocaleTimeString('es-PR', {
    hour: '2-digit', minute: '2-digit', timeZone: 'America/Puerto_Rico',
});
const fechaCorta = (d: Date) => d.toLocaleDateString('es-PR', {
    day: '2-digit', month: 'short', year: '2-digit', timeZone: 'America/Puerto_Rico',
});

export function generarRegistroVisitasPDF(meta: RegistroVisitasMeta): ArrayBuffer {
    // Apaisado: ocho columnas con nombres completos y una firma no caben de pie.
    const doc = new jsPDF({ unit: 'mm', format: 'letter', orientation: 'landscape' });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();

    const setFill = (c: [number, number, number]) => doc.setFillColor(c[0], c[1], c[2]);
    const setText = (c: [number, number, number]) => doc.setTextColor(c[0], c[1], c[2]);
    const setDraw = (c: [number, number, number]) => doc.setDrawColor(c[0], c[1], c[2]);

    /** Anchos de columna. Suman el ancho útil de la hoja. */
    const COLS = [
        { t: '#', w: 10 },
        { t: 'Tipo', w: 28 },
        { t: 'Visitante', w: 62 },
        { t: 'Residente / Entidad', w: 58 },
        { t: 'Fecha', w: 24 },
        { t: 'Entrada', w: 20 },
        { t: 'Salida', w: 34 },
        { t: 'Firma', w: 30 },
    ];

    const periodo = meta.desde || meta.hasta
        ? `${meta.desde ?? 'inicio'} — ${meta.hasta ?? 'hoy'}`
        : 'Todo el historial';

    let pagina = 0;
    let y = 0;

    /**
     * EL MEMBRETE VA EN CADA HOJA. Es la diferencia entre un documento y una
     * captura: la hoja 3 tiene que decir de qué hogar y de qué período es,
     * porque puede acabar suelta sobre una mesa.
     */
    const abrirPagina = () => {
        if (pagina > 0) doc.addPage();
        pagina++;

        setFill(INK);
        doc.rect(0, 0, W, 22, 'F');

        setText([255, 255, 255]);
        doc.setFont('helvetica', 'bold').setFontSize(13);
        doc.text(meta.hqName, M, 10);
        doc.setFont('helvetica', 'normal').setFontSize(8);
        const sub = meta.hqPhone ? `Tel. ${meta.hqPhone}` : '';
        doc.text(['Registro Oficial de Visitas', sub].filter(Boolean).join('  ·  '), M, 16);

        doc.setFont('helvetica', 'bold').setFontSize(9);
        doc.text(`Período: ${periodo}`, W - M, 10, { align: 'right' });
        doc.setFont('helvetica', 'normal').setFontSize(8);
        doc.text(
            `Generado ${meta.generadoAt.toLocaleDateString('es-PR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Puerto_Rico' })}`,
            W - M, 16, { align: 'right' },
        );

        y = 28;
        cabeceraTabla();
    };

    const cabeceraTabla = () => {
        setFill(TEAL);
        doc.rect(M, y, W - 2 * M, 8, 'F');
        setText([255, 255, 255]);
        doc.setFont('helvetica', 'bold').setFontSize(7.5);
        let x = M;
        for (const c of COLS) {
            doc.text(c.t.toUpperCase(), x + 2, y + 5.4);
            x += c.w;
        }
        y += 8;
    };

    const pie = () => {
        setDraw(LINE);
        doc.line(M, H - 12, W - M, H - 12);
        setText(MUTED);
        doc.setFont('helvetica', 'normal').setFontSize(7);
        doc.text(`${meta.hqName} · Registro Oficial de Visitas · ${periodo}`, M, H - 7);
        doc.text('Documento generado por Zéndity', W / 2, H - 7, { align: 'center' });
        // El total va en el pie de CADA hoja: quien recibe la hoja 2 suelta
        // tiene que poder saber si le falta alguna.
        doc.text(`Página ${pagina} de {{TOTAL}}`, W - M, H - 7, { align: 'right' });
    };

    abrirPagina();

    if (meta.visitas.length === 0) {
        setText(MUTED);
        doc.setFont('helvetica', 'italic').setFontSize(10);
        doc.text('No hay visitas registradas en este período.', W / 2, y + 20, { align: 'center' });
    }

    meta.visitas.forEach((v, i) => {
        // Altura de la fila: la firma manda, y las marcas añaden una línea.
        const extras = [v.profesion, v.retenida ? 1 : null, v.fueraDeHorario ? 1 : null,
                        v.entidad && v.residentName ? 1 : null, v.futuroResidente ? 1 : null].filter(Boolean).length;
        const alto = Math.max(12, 7 + extras * 3.2);

        if (y + alto > H - 16) { pie(); abrirPagina(); }

        if (i % 2 === 0) { setFill(ZEBRA); doc.rect(M, y, W - 2 * M, alto, 'F'); }
        setDraw(LINE);
        doc.line(M, y + alto, W - M, y + alto);

        let x = M;
        const celda = (ancho: number, cuerpo: () => void) => { cuerpo(); x += ancho; };

        // #
        celda(COLS[0].w, () => {
            setText(MUTED); doc.setFont('helvetica', 'bold').setFontSize(7.5);
            doc.text(String(i + 1), x + 2, y + 5);
        });
        // Tipo
        celda(COLS[1].w, () => {
            setText(INK); doc.setFont('helvetica', 'normal').setFontSize(8);
            doc.text(TIPO_VISITA[v.tipo] ?? v.tipo, x + 2, y + 5);
        });
        // Visitante — con sus marcas debajo, no en otra columna
        celda(COLS[2].w, () => {
            setText(INK); doc.setFont('helvetica', 'bold').setFontSize(8.5);
            doc.text(doc.splitTextToSize(v.visitorName, COLS[2].w - 4)[0] ?? '', x + 2, y + 5);
            let yy = y + 8.4;
            if (v.profesion) {
                setText(MUTED); doc.setFont('helvetica', 'normal').setFontSize(7);
                doc.text(v.profesion, x + 2, yy); yy += 3.2;
            }
            if (v.retenida) {
                setText(WARN); doc.setFont('helvetica', 'bold').setFontSize(7);
                doc.text('Esperó asistencia — no pasó', x + 2, yy); yy += 3.2;
            }
            if (v.fueraDeHorario) {
                setText(WARN); doc.setFont('helvetica', 'bold').setFontSize(7);
                doc.text('Fuera de horario — autorizada', x + 2, yy);
            }
        });
        // Residente / entidad
        celda(COLS[3].w, () => {
            setText(INK); doc.setFont('helvetica', 'normal').setFontSize(8);
            doc.text(doc.splitTextToSize(v.residentName || v.entidad || '—', COLS[3].w - 4)[0] ?? '', x + 2, y + 5);
            let yy = y + 8.4;
            setText(MUTED); doc.setFont('helvetica', 'normal').setFontSize(7);
            if (v.residentName && v.entidad) { doc.text(v.entidad, x + 2, yy); yy += 3.2; }
            if (v.futuroResidente) doc.text(`Pregunta por ${v.futuroResidente}`, x + 2, yy);
        });
        // Fecha
        celda(COLS[4].w, () => {
            setText(INK); doc.setFont('helvetica', 'normal').setFontSize(8);
            doc.text(fechaCorta(v.visitedAt), x + 2, y + 5);
        });
        // Entrada
        celda(COLS[5].w, () => {
            setText(INK); doc.setFont('helvetica', 'normal').setFontSize(8);
            doc.text(hora(v.visitedAt), x + 2, y + 5);
        });
        // Salida — el hueco se dice, no se rellena
        celda(COLS[6].w, () => {
            doc.setFontSize(8);
            if (v.departedAt) {
                setText(INK); doc.setFont('helvetica', 'normal');
                doc.text(hora(v.departedAt), x + 2, y + 5);
            } else if (v.salidaCerradaAt) {
                setText(MUTED); doc.setFont('helvetica', 'normal').setFontSize(7.5);
                doc.text('Cerrada por personal', x + 2, y + 4.5);
                doc.setFont('helvetica', 'italic').setFontSize(6.5);
                doc.text('el visitante no registró salida', x + 2, y + 7.8);
            } else {
                setText(WARN); doc.setFont('helvetica', 'italic').setFontSize(7.5);
                doc.text('Sin registrar', x + 2, y + 5);
            }
        });
        // Firma
        celda(COLS[7].w, () => {
            if (v.signatureData && v.signatureData.startsWith('data:image')) {
                try {
                    doc.addImage(v.signatureData, 'PNG', x + 2, y + 1.5, COLS[7].w - 5, alto - 3.5);
                } catch {
                    // Una firma ilegible no puede tumbar el documento entero.
                    setText(MUTED); doc.setFont('helvetica', 'italic').setFontSize(7);
                    doc.text('(firma)', x + 2, y + 5);
                }
            } else {
                setText(MUTED); doc.setFont('helvetica', 'italic').setFontSize(7);
                doc.text('Sin firma', x + 2, y + 5);
            }
        });

        y += alto;
    });

    // El aviso de recorte va IMPRESO. Un papel que parece completo y no lo es
    // es peor que no imprimirlo: nadie duda de una lista que no avisa.
    if (meta.totalEnRango > meta.visitas.length) {
        if (y + 18 > H - 16) { pie(); abrirPagina(); }
        y += 4;
        setFill([254, 243, 199]); setDraw([234, 179, 8]);
        doc.rect(M, y, W - 2 * M, 12, 'FD');
        setText([120, 53, 15]);
        doc.setFont('helvetica', 'bold').setFontSize(8.5);
        doc.text(
            `REGISTRO PARCIAL — en este período hay ${meta.totalEnRango} visitas y aquí salen las ${meta.visitas.length} más recientes.`,
            M + 3, y + 5,
        );
        doc.setFont('helvetica', 'normal').setFontSize(7.5);
        doc.text('Reduzca el rango de fechas para obtener el registro completo.', M + 3, y + 9);
    }

    pie();

    // El "de N" no se sabe hasta el final. Se sustituye en cada pie.
    // `getNumberOfPages` no está en los tipos de esta versión de jsPDF; el
    // contador interno sí, y es lo que la propia librería usa.
    const total = (doc.internal as unknown as { getNumberOfPages: () => number }).getNumberOfPages();
    for (let p = 1; p <= total; p++) {
        doc.setPage(p);
        setFill([255, 255, 255]);
        doc.rect(W - M - 30, H - 10, 30, 5, 'F');
        setText(MUTED);
        doc.setFont('helvetica', 'normal').setFontSize(7);
        doc.text(`Página ${p} de ${total}`, W - M, H - 7, { align: 'right' });
    }

    return doc.output('arraybuffer');
}
