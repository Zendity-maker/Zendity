/**
 * EL PAPEL QUE VA CON EL RESIDENTE A EMERGENCIAS
 * ──────────────────────────────────────────────
 * De los diez documentos que imprime Zéndity, este es el único que alguien lee
 * de pie, con prisa, sin conocer al residente y con él delante. Todo lo demás
 * de este archivo sale de esa frase.
 *
 * POR QUÉ NO BASTA CON IMPRIMIR LA PANTALLA. Con las reglas de AppLayout ya sale
 * sin barras y sin recortes, pero sigue siendo una página web:
 *
 *   · el nombre del residente aparece solo en la hoja 1. Si el papel se separa
 *     —y en una sala de urgencias se separa— la hoja 2 es una lista de
 *     medicamentos sin dueño
 *   · el navegador añade su cabecera con la URL, salvo que cada quien la
 *     desmarque
 *   · no hay "Página 2 de 2"
 *
 * LO QUE VA PRIMERO ES LO QUE MATA. Alergias arriba del todo, en rojo, antes que
 * el nombre del seguro. Un campo vacío NO dice "sin alergias conocidas": dice
 * NO DOCUMENTADO y dice que hay que preguntar. Medido el 06-sep-2026: 28 de 33
 * residentes activos de Cupey no tienen alergias documentadas, y de los cinco
 * que sí, tres son alérgicos a penicilina.
 */
import jsPDF from 'jspdf';

const ROJO: [number, number, number] = [190, 18, 60];
const ROJO_BG: [number, number, number] = [254, 226, 226];
const AMBAR: [number, number, number] = [180, 83, 9];
const AMBAR_BG: [number, number, number] = [255, 251, 235];
const TEAL: [number, number, number] = [15, 110, 86];
const INK: [number, number, number] = [31, 45, 58];
const MUTED: [number, number, number] = [100, 116, 139];
const LINE: [number, number, number] = [226, 232, 240];
const ZEBRA: [number, number, number] = [248, 250, 252];

const M = 14;

export interface MedicamentoTraslado {
    name: string;
    dosage?: string | null;
    route?: string | null;
    frequency?: string | null;
    instructions?: string | null;
}

export interface TrasladoMeta {
    nombre: string;
    habitacion?: string | null;
    fechaNacimiento?: string | null;
    edad?: number | null;
    /** Texto tal cual. Si está vacío, quien llama ya puso el aviso. */
    alergias: string;
    /** Cierto cuando `alergias` es el aviso de que no hay dato. */
    alergiasSinDocumentar: boolean;
    diagnosticos?: string | null;
    dieta?: string | null;
    dialisis: boolean;
    modalidadCuidado?: string | null;
    hospitalPreferido?: string | null;
    seguro?: { plan?: string | null; poliza?: string | null; medicare?: string | null; medicaid?: string | null } | null;
    contacto?: { name: string; phone: string; relationship: string } | null;
    hogar: { nombre: string; telefono?: string | null; direccion?: string | null };
    medicamentos: MedicamentoTraslado[];
    generadoAt: Date;
}

export function generarTrasladoPDF(m: TrasladoMeta): ArrayBuffer {
    const doc = new jsPDF({ unit: 'mm', format: 'letter' });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();

    const setFill = (c: [number, number, number]) => doc.setFillColor(c[0], c[1], c[2]);
    const setText = (c: [number, number, number]) => doc.setTextColor(c[0], c[1], c[2]);
    const setDraw = (c: [number, number, number]) => doc.setDrawColor(c[0], c[1], c[2]);

    let pagina = 0;
    let y = 0;

    /**
     * EL NOMBRE VA EN CADA HOJA. Es la diferencia entre un documento y una
     * impresión: si la hoja 2 se separa en una camilla, tiene que seguir
     * diciendo de quién es.
     */
    const abrirPagina = () => {
        if (pagina > 0) doc.addPage();
        pagina++;

        setFill(INK);
        doc.rect(0, 0, W, pagina === 1 ? 26 : 16, 'F');
        setText([255, 255, 255]);
        doc.setFont('helvetica', 'bold').setFontSize(pagina === 1 ? 15 : 11);
        doc.text(m.nombre, M, pagina === 1 ? 11 : 8.5);
        doc.setFont('helvetica', 'normal').setFontSize(8);
        const linea = [
            m.habitacion ? `Hab. ${m.habitacion}` : null,
            m.edad != null ? `${m.edad} años` : null,
            m.fechaNacimiento,
        ].filter(Boolean).join('  ·  ');
        doc.text(linea, M, pagina === 1 ? 18 : 13);
        doc.setFont('helvetica', 'bold').setFontSize(8);
        doc.text('TRASLADO A EMERGENCIAS', W - M, pagina === 1 ? 11 : 8.5, { align: 'right' });
        doc.setFont('helvetica', 'normal').setFontSize(7.5);
        doc.text(m.hogar.nombre, W - M, pagina === 1 ? 18 : 13, { align: 'right' });

        y = pagina === 1 ? 32 : 22;
    };

    const pie = () => {
        setDraw(LINE);
        doc.line(M, H - 13, W - M, H - 13);
        setText(MUTED);
        doc.setFont('helvetica', 'normal').setFontSize(7);
        doc.text(
            `${m.hogar.nombre}${m.hogar.telefono ? ` · ${m.hogar.telefono}` : ''}`,
            M, H - 8.5,
        );
        doc.text(
            `Generado ${m.generadoAt.toLocaleString('es-PR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Puerto_Rico' })}`,
            W / 2, H - 8.5, { align: 'center' },
        );
    };

    const sitio = (mm: number) => { if (y + mm > H - 18) { pie(); abrirPagina(); } };

    const titulo = (t: string, color: [number, number, number] = TEAL) => {
        sitio(12);
        setText(color);
        doc.setFont('helvetica', 'bold').setFontSize(8);
        doc.text(t.toUpperCase(), M, y);
        setDraw(color);
        doc.setLineWidth(0.4);
        doc.line(M, y + 1.5, W - M, y + 1.5);
        doc.setLineWidth(0.2);
        y += 6;
    };

    const parrafo = (t: string, tam = 10, color: [number, number, number] = INK, estilo: 'normal' | 'bold' = 'normal') => {
        setText(color);
        doc.setFont('helvetica', estilo).setFontSize(tam);
        for (const ln of doc.splitTextToSize(t, W - 2 * M) as string[]) {
            sitio(tam * 0.55);
            doc.text(ln, M, y);
            y += tam * 0.5;
        }
        y += 2;
    };

    abrirPagina();

    /* ── ALERGIAS. Lo primero, siempre. ─────────────────────────────────── */
    const cAlergia = m.alergiasSinDocumentar ? AMBAR : ROJO;
    const cFondo = m.alergiasSinDocumentar ? AMBAR_BG : ROJO_BG;
    const lineas = doc.splitTextToSize(m.alergias, W - 2 * M - 10) as string[];
    const alto = 12 + lineas.length * 5;
    setFill(cFondo); setDraw(cAlergia);
    doc.setLineWidth(0.6);
    doc.rect(M, y, W - 2 * M, alto, 'FD');
    doc.setLineWidth(0.2);
    setText(cAlergia);
    doc.setFont('helvetica', 'bold').setFontSize(9);
    doc.text('ALERGIAS', M + 4, y + 6);
    doc.setFontSize(m.alergiasSinDocumentar ? 10 : 13);
    let yy = y + 13;
    for (const ln of lineas) { doc.text(ln, M + 4, yy); yy += 5; }
    y += alto + 6;

    /* ── Lo que hace falta saber antes de tocar al residente ────────────── */
    const banderas = [
        m.dialisis ? 'RECIBE DIÁLISIS' : null,
        m.modalidadCuidado && m.modalidadCuidado !== 'NONE'
            ? (m.modalidadCuidado === 'HOSPICE' ? 'EN HOSPICIO' : 'CUIDADO PALIATIVO')
            : null,
        m.dieta ? `Dieta: ${m.dieta}` : null,
    ].filter(Boolean) as string[];
    if (banderas.length) {
        sitio(12);
        let x = M;
        for (const b of banderas) {
            const ancho = doc.getTextWidth(b) + 8;
            setFill([238, 242, 255]); setDraw([129, 140, 248]);
            doc.roundedRect(x, y, ancho, 8, 2, 2, 'FD');
            setText([55, 48, 163]);
            doc.setFont('helvetica', 'bold').setFontSize(8.5);
            doc.text(b, x + 4, y + 5.4);
            x += ancho + 4;
        }
        y += 14;
    }

    /* ── Diagnósticos ───────────────────────────────────────────────────── */
    titulo('Diagnósticos');
    parrafo(m.diagnosticos?.trim() || 'No documentados', 10, m.diagnosticos?.trim() ? INK : MUTED);

    /* ── Medicamentos ───────────────────────────────────────────────────── */
    titulo('Medicamentos activos');
    if (m.medicamentos.length === 0) {
        parrafo('Sin medicamentos activos registrados.', 10, MUTED);
    } else {
        const COLS = [
            { t: 'Medicamento', w: 62 },
            { t: 'Dosis', w: 30 },
            { t: 'Vía', w: 22 },
            { t: 'Frecuencia', w: 34 },
            { t: 'Indicaciones', w: W - 2 * M - 148 },
        ];
        const cabecera = () => {
            setFill(TEAL);
            doc.rect(M, y, W - 2 * M, 7, 'F');
            setText([255, 255, 255]);
            doc.setFont('helvetica', 'bold').setFontSize(7);
            let x = M;
            for (const c of COLS) { doc.text(c.t.toUpperCase(), x + 2, y + 4.8); x += c.w; }
            y += 7;
        };
        cabecera();
        m.medicamentos.forEach((med, i) => {
            const inst = med.instructions?.trim() ?? '';
            const nLineas = Math.max(1, (doc.splitTextToSize(inst || '—', COLS[4].w - 4) as string[]).length);
            const altoFila = Math.max(7, 3 + nLineas * 3.6);
            if (y + altoFila > H - 18) { pie(); abrirPagina(); cabecera(); }
            if (i % 2 === 0) { setFill(ZEBRA); doc.rect(M, y, W - 2 * M, altoFila, 'F'); }
            setDraw(LINE); doc.line(M, y + altoFila, W - M, y + altoFila);

            let x = M;
            setText(INK); doc.setFont('helvetica', 'bold').setFontSize(8);
            doc.text((doc.splitTextToSize(med.name, COLS[0].w - 4) as string[])[0] ?? '', x + 2, y + 4.8); x += COLS[0].w;
            doc.setFont('helvetica', 'normal');
            doc.text(med.dosage ?? '—', x + 2, y + 4.8); x += COLS[1].w;
            doc.text(med.route ?? '—', x + 2, y + 4.8); x += COLS[2].w;
            doc.text(med.frequency ?? '—', x + 2, y + 4.8); x += COLS[3].w;
            setText(MUTED); doc.setFontSize(7.5);
            let yi = y + 4.6;
            for (const ln of doc.splitTextToSize(inst || '—', COLS[4].w - 4) as string[]) { doc.text(ln, x + 2, yi); yi += 3.6; }
            y += altoFila;
        });
        y += 6;
    }

    /* ── A quién llamar ─────────────────────────────────────────────────── */
    titulo('A quién llamar');
    if (m.contacto) {
        setText(INK); doc.setFont('helvetica', 'bold').setFontSize(11);
        sitio(14);
        doc.text(`${m.contacto.name}  ·  ${m.contacto.phone}`, M, y);
        y += 5;
        setText(MUTED); doc.setFont('helvetica', 'normal').setFontSize(9);
        doc.text(m.contacto.relationship, M, y);
        y += 7;
    } else {
        // El hueco se dice. Quien recibe al residente tiene que saber que no hay
        // a quién llamar, no descubrirlo cuando lo necesite.
        parrafo('SIN CONTACTO FAMILIAR REGISTRADO — llamar al hogar.', 10, AMBAR, 'bold');
    }
    parrafo(
        `Hogar: ${m.hogar.nombre}${m.hogar.telefono ? ` · ${m.hogar.telefono}` : ' · sin teléfono registrado'}`
        + (m.hogar.direccion ? `\n${m.hogar.direccion}` : ''),
        9, INK,
    );

    /* ── Seguro y hospital ──────────────────────────────────────────────── */
    const s = m.seguro;
    if (m.hospitalPreferido || s?.plan || s?.poliza || s?.medicare || s?.medicaid) {
        titulo('Seguro y hospital');
        const filas = [
            m.hospitalPreferido ? `Hospital preferido: ${m.hospitalPreferido}` : null,
            s?.plan ? `Plan: ${s.plan}` : null,
            s?.poliza ? `Póliza: ${s.poliza}` : null,
            s?.medicare ? `Medicare: ${s.medicare}` : null,
            s?.medicaid ? `Medicaid: ${s.medicaid}` : null,
        ].filter(Boolean) as string[];
        parrafo(filas.join('\n'), 9.5);
    }

    pie();

    // El "de N" solo se sabe al final.
    const total = (doc.internal as unknown as { getNumberOfPages: () => number }).getNumberOfPages();
    for (let p = 1; p <= total; p++) {
        doc.setPage(p);
        setText(MUTED);
        doc.setFont('helvetica', 'normal').setFontSize(7);
        doc.text(`Página ${p} de ${total}`, W - M, H - 8.5, { align: 'right' });
    }

    return doc.output('arraybuffer');
}
