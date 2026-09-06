/**
 * EL PDF DE LOS REPORTES SEMANALES
 * ────────────────────────────────
 * Uno solo para los tres —enfermería, supervisión y dirección— porque los tres
 * tienen la misma forma: bloques numerados, ordenados por lo que pasa si nadie
 * los mira. Añadir un cuarto reporte no toca este archivo.
 *
 * Va adjunto al correo de los lunes. Los nombres viven AQUÍ y no en el cuerpo
 * del mensaje: la regla del proyecto es que un correo no lleva diagnósticos ni
 * datos clínicos identificables. Mismo reparto que el paquete de continuidad.
 *
 * DECISIONES DE FORMA, y por qué:
 *
 *   · Los bloques vacíos SE IMPRIMEN, diciendo "nada pendiente". Es la única
 *     forma de que quien lo lee sepa que se miró. Un reporte que solo enseña
 *     problemas no distingue "no hay" de "no se comprobó".
 *
 *   · Cuando hay más casos que los que caben, lo dice: "mostrando 8 de 13". Un
 *     listado truncado en silencio hace creer que son ocho.
 *
 *   · El bloque de lo resuelto va al final. Abrir con las buenas noticias
 *     enseña a leer solo el principio.
 */
import jsPDF from 'jspdf';
import type { ReporteSemanal } from '@/lib/reporte-enfermeria';

// Misma paleta que continuity-pdf.ts — es el mismo hogar y el mismo lector.
const TEAL: [number, number, number] = [15, 110, 86];
const INK: [number, number, number] = [31, 45, 58];
const MUTED: [number, number, number] = [100, 116, 139];
const LINE: [number, number, number] = [226, 232, 240];
const ZEBRA: [number, number, number] = [248, 250, 252];
const DANGER: [number, number, number] = [190, 18, 60];
const WARN: [number, number, number] = [180, 83, 9];
const OK: [number, number, number] = [21, 128, 61];

const M = 14;

/** El color de cada bloque: los tres primeros son deuda, el cuarto es lo hecho. */
function colorBloque(n: number, vacio: boolean): [number, number, number] {
    if (vacio) return MUTED;
    if (n === 1) return DANGER;
    if (n === 2 || n === 3) return WARN;
    if (n === 4) return OK;
    return MUTED;
}

export function generarReporteSemanalPDF(r: ReporteSemanal): ArrayBuffer {
    const doc = new jsPDF({ unit: 'mm', format: 'letter' });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();

    const setFill = (c: [number, number, number]) => doc.setFillColor(c[0], c[1], c[2]);
    const setText = (c: [number, number, number]) => doc.setTextColor(c[0], c[1], c[2]);
    const setDraw = (c: [number, number, number]) => doc.setDrawColor(c[0], c[1], c[2]);

    const fecha = (d: Date) => d.toLocaleDateString('es-PR', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Puerto_Rico',
    });

    let y = 0;
    let pagina = 1;

    const pie = () => {
        setText(MUTED);
        doc.setFont('helvetica', 'normal').setFontSize(7);
        doc.text(`Zéndity · ${r.sedeNombre} · ${r.titulo} · página ${pagina}`, M, H - 8);
        doc.text('Documento con información clínica. Trátese como el expediente.', W - M, H - 8, { align: 'right' });
    };

    const nuevaPagina = () => { pie(); doc.addPage(); pagina++; y = M + 4; };
    const espacio = (mm: number) => { if (y + mm > H - 18) nuevaPagina(); };

    /* ── Cabecera ──────────────────────────────────────────────────────── */
    setFill(TEAL);
    doc.rect(0, 0, W, 30, 'F');
    setText([255, 255, 255]);
    doc.setFont('helvetica', 'bold').setFontSize(15);
    doc.text(r.titulo, M, 13);
    doc.setFont('helvetica', 'normal').setFontSize(9);
    doc.text(`${r.sedeNombre} · ${r.paraQuien}`, M, 20);
    doc.text(fecha(r.generadoAt), W - M, 13, { align: 'right' });
    doc.setFontSize(8);
    doc.text(`Semana del ${fecha(r.desde).replace(/^\w+,?\s*/, '')}`, W - M, 20, { align: 'right' });
    doc.text(`${r.residentesActivos} residentes activos`, W - M, 25.5, { align: 'right' });

    y = 40;

    /* ── Resumen ───────────────────────────────────────────────────────── */
    setFill(ZEBRA);
    setDraw(LINE);
    doc.roundedRect(M, y, W - 2 * M, 18, 2, 2, 'FD');
    setText(r.totalPendiente > 0 ? DANGER : OK);
    doc.setFont('helvetica', 'bold').setFontSize(20);
    doc.text(String(r.totalPendiente), M + 6, y + 12.5);
    setText(INK);
    doc.setFont('helvetica', 'bold').setFontSize(10);
    doc.text(
        r.totalPendiente > 0 ? 'cosas esperando una decisión de enfermería' : 'nada esperando una decisión de enfermería',
        M + 6 + doc.getTextWidth(String(r.totalPendiente)) + 4, y + 9,
    );
    setText(MUTED);
    doc.setFont('helvetica', 'normal').setFontSize(8);
    doc.text(
        `Se revisaron ${r.frentesRevisados} frentes. Lo urgente va primero; lo que se resolvió esta semana, al final.`,
        M + 6 + doc.getTextWidth(String(r.totalPendiente)) + 4, y + 14,
    );
    y += 26;

    /* ── Bloques ───────────────────────────────────────────────────────── */
    for (const b of r.bloques) {
        const vacio = b.total === 0;
        const c = colorBloque(b.numero, vacio);
        espacio(24);

        // Título del bloque
        setFill(c);
        doc.circle(M + 3, y + 2.2, 3, 'F');
        setText([255, 255, 255]);
        doc.setFont('helvetica', 'bold').setFontSize(8);
        doc.text(String(b.numero), M + 3, y + 3.4, { align: 'center' });

        setText(INK);
        doc.setFont('helvetica', 'bold').setFontSize(11);
        doc.text(b.titulo, M + 9, y + 3.6);
        if (!vacio) {
            setText(c);
            doc.setFontSize(11);
            doc.text(String(b.total), W - M, y + 3.6, { align: 'right' });
        }
        y += 7;

        setText(MUTED);
        doc.setFont('helvetica', 'italic').setFontSize(8);
        doc.text(b.consecuencia, M + 9, y);
        y += 3;

        setDraw(LINE);
        doc.line(M, y, W - M, y);
        y += 4;

        if (vacio) {
            setText(MUTED);
            doc.setFont('helvetica', 'normal').setFontSize(8.5);
            doc.text('Nada pendiente. Se comprobó.', M + 9, y + 1);
            y += 9;
            continue;
        }

        for (const l of b.lineas) {
            espacio(12);
            setText(c);
            doc.setFont('helvetica', 'bold').setFontSize(9.5);
            doc.text(String(l.total).padStart(3), M + 9, y, { align: 'right' });
            setText(INK);
            doc.setFont('helvetica', 'bold').setFontSize(9.5);
            doc.text(l.texto, M + 12, y);
            y += 4.5;

            for (const caso of l.casos) {
                espacio(6);
                setText(MUTED);
                doc.setFont('helvetica', 'normal').setFontSize(8);
                const lineas = doc.splitTextToSize(`· ${caso}`, W - 2 * M - 16) as string[];
                for (const ln of lineas) {
                    espacio(4.5);
                    doc.text(ln, M + 14, y);
                    y += 3.8;
                }
            }
            // Un listado truncado en silencio hace creer que son ocho.
            if (l.casos.length > 0 && l.casos.length < l.total) {
                espacio(5);
                setText(MUTED);
                doc.setFont('helvetica', 'italic').setFontSize(7.5);
                doc.text(`mostrando ${l.casos.length} de ${l.total} — el resto, en la pantalla`, M + 14, y);
                y += 4;
            }
            y += 2;
        }
        y += 4;
    }

    /* ── Cierre ────────────────────────────────────────────────────────── */
    espacio(20);
    setDraw(LINE);
    doc.line(M, y, W - M, y);
    y += 5;
    setText(MUTED);
    doc.setFont('helvetica', 'normal').setFontSize(8);
    doc.text('Todo lo de este reporte se calcula contra el expediente cada lunes. Nada se marca a mano como hecho:', M, y);
    y += 4;
    doc.text('cada línea desaparece sola cuando el trabajo se registra. Se entra en app.zendity.com.', M, y);

    pie();
    return doc.output('arraybuffer');
}
