/**
 * EL eMAR COMO DOCUMENTO DE AUDITORÍA
 * ───────────────────────────────────
 * El registro de administración de medicamentos de un residente. Es lo que pide
 * un inspector del Departamento de la Familia, y lo que pediría un abogado.
 *
 * POR QUÉ NO SE PUEDE IMPRIMIR LA PANTALLA. Medido el 06-sep-2026: el residente
 * con más historial tiene 1 978 administraciones, y el promedio es 716. A unas
 * 28 filas por hoja eso son 71 páginas para uno solo. Antes del arreglo de
 * impresión de AppLayout salía RECORTADO A UNA — sin que nada lo dijera.
 *
 * POR ESO LLEVA RANGO DE FECHAS. Un eMAR completo casi nunca es lo que alguien
 * quiere: se pide "del 1 al 31 de agosto". El período va en cada hoja, porque un
 * documento que no dice qué período cubre no sirve para auditar nada — quien lo
 * recibe no puede saber si le falta un trozo.
 *
 * Y EL CONTEO VA EN EL PAPEL. Cuántas dosis hubo, cuántas se administraron y
 * cuántas no, con su motivo. Sin eso hay que contar a mano 700 filas para
 * responder "¿se le dio su medicación?".
 */
import jsPDF from 'jspdf';

const TEAL: [number, number, number] = [15, 110, 86];
const INK: [number, number, number] = [31, 45, 58];
const MUTED: [number, number, number] = [100, 116, 139];
const LINE: [number, number, number] = [226, 232, 240];
const ZEBRA: [number, number, number] = [248, 250, 252];
const OK: [number, number, number] = [21, 128, 61];
const AVISO: [number, number, number] = [180, 83, 9];

const M = 12;

/** Cómo se lee cada estado en un papel que audita alguien de fuera. */
export const ESTADO_DOSIS: Record<string, string> = {
    ADMINISTERED: 'Administrado',
    OMITTED: 'Omitido',
    REFUSED: 'Rechazado por el residente',
    HELD: 'Suspendido',
    MISSED: 'No registrado',
    PENDING: 'Pendiente',
};

export interface DosisEmar {
    medicamento: string;
    dosis?: string | null;
    via?: string | null;
    estado: string;
    /** La hora en que se administró de verdad, cuando se declaró. */
    administradoAt?: Date | null;
    /** La hora del tecleo. Siempre existe. */
    registradoAt: Date;
    slot?: string | null;
    porQuien?: string | null;
    notas?: string | null;
    prnMotivo?: string | null;
    prnEfecto?: string | null;
}

export interface EmarMeta {
    residente: string;
    habitacion?: string | null;
    hogar: string;
    hogarTelefono?: string | null;
    desde: Date;
    hasta: Date;
    generadoAt: Date;
    /** Total en el período. Si es mayor que las filas, el papel lo dice. */
    totalEnRango: number;
    dosis: DosisEmar[];
}

const fechaHora = (d: Date) => d.toLocaleString('es-PR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit', timeZone: 'America/Puerto_Rico',
});
const fechaLarga = (d: Date) => d.toLocaleDateString('es-PR', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Puerto_Rico',
});

export function generarEmarPDF(m: EmarMeta): ArrayBuffer {
    const doc = new jsPDF({ unit: 'mm', format: 'letter', orientation: 'landscape' });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();

    const setFill = (c: [number, number, number]) => doc.setFillColor(c[0], c[1], c[2]);
    const setText = (c: [number, number, number]) => doc.setTextColor(c[0], c[1], c[2]);
    const setDraw = (c: [number, number, number]) => doc.setDrawColor(c[0], c[1], c[2]);

    const COLS = [
        { t: 'Medicamento', w: 66 },
        { t: 'Dosis / Vía', w: 34 },
        { t: 'Pauta', w: 22 },
        { t: 'Administrado', w: 32 },
        { t: 'Registrado', w: 32 },
        { t: 'Estado', w: 42 },
        { t: 'Por', w: 38 },
    ];

    const periodo = `${fechaLarga(m.desde)} — ${fechaLarga(m.hasta)}`;
    let pagina = 0;
    let y = 0;

    /** Residente y período en CADA hoja: sin eso el papel no audita nada. */
    const abrirPagina = () => {
        if (pagina > 0) doc.addPage();
        pagina++;
        setFill(INK);
        doc.rect(0, 0, W, 20, 'F');
        setText([255, 255, 255]);
        doc.setFont('helvetica', 'bold').setFontSize(12);
        doc.text(m.residente + (m.habitacion ? `  ·  Hab. ${m.habitacion}` : ''), M, 9);
        doc.setFont('helvetica', 'normal').setFontSize(8);
        doc.text(`${m.hogar}${m.hogarTelefono ? `  ·  ${m.hogarTelefono}` : ''}`, M, 15);
        doc.setFont('helvetica', 'bold').setFontSize(9);
        doc.text('REGISTRO DE ADMINISTRACIÓN DE MEDICAMENTOS', W - M, 9, { align: 'right' });
        doc.setFont('helvetica', 'normal').setFontSize(8);
        doc.text(periodo, W - M, 15, { align: 'right' });
        y = 26;
        cabecera();
    };

    const cabecera = () => {
        setFill(TEAL);
        doc.rect(M, y, W - 2 * M, 7, 'F');
        setText([255, 255, 255]);
        doc.setFont('helvetica', 'bold').setFontSize(7);
        let x = M;
        for (const c of COLS) { doc.text(c.t.toUpperCase(), x + 2, y + 4.8); x += c.w; }
        y += 7;
    };

    const pie = () => {
        setDraw(LINE);
        doc.line(M, H - 11, W - M, H - 11);
        setText(MUTED);
        doc.setFont('helvetica', 'normal').setFontSize(7);
        doc.text(`${m.residente} · ${periodo}`, M, H - 6.5);
        doc.text(
            `Generado ${m.generadoAt.toLocaleString('es-PR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Puerto_Rico' })} · Zéndity`,
            W / 2, H - 6.5, { align: 'center' },
        );
    };

    abrirPagina();

    /* ── El resumen, antes de las filas ─────────────────────────────────── */
    const cuenta = new Map<string, number>();
    for (const d of m.dosis) cuenta.set(d.estado, (cuenta.get(d.estado) ?? 0) + 1);
    const admin = cuenta.get('ADMINISTERED') ?? 0;
    const resto = m.dosis.length - admin;

    setFill(ZEBRA); setDraw(LINE);
    doc.rect(M, y, W - 2 * M, 11, 'FD');
    setText(INK);
    doc.setFont('helvetica', 'bold').setFontSize(9);
    doc.text(`${m.dosis.length} dosis en el período`, M + 4, y + 7);
    let x = M + 4 + doc.getTextWidth(`${m.dosis.length} dosis en el período`) + 8;
    setText(OK); doc.setFontSize(8.5);
    doc.text(`${admin} administradas`, x, y + 7);
    x += doc.getTextWidth(`${admin} administradas`) + 8;
    if (resto > 0) {
        setText(AVISO);
        const detalle = [...cuenta.entries()]
            .filter(([e]) => e !== 'ADMINISTERED')
            .map(([e, n]) => `${n} ${(ESTADO_DOSIS[e] ?? e).toLowerCase()}`)
            .join(' · ');
        doc.text(detalle, x, y + 7);
    }
    y += 15;
    cabecera();

    if (m.dosis.length === 0) {
        setText(MUTED);
        doc.setFont('helvetica', 'italic').setFontSize(10);
        doc.text('No hay dosis registradas en este período.', W / 2, y + 15, { align: 'center' });
    }

    m.dosis.forEach((d, i) => {
        const extra = [d.notas, d.prnMotivo].filter(Boolean).length;
        const alto = Math.max(7, 6 + extra * 3.4);
        if (y + alto > H - 15) { pie(); abrirPagina(); }

        if (i % 2 === 0) { setFill(ZEBRA); doc.rect(M, y, W - 2 * M, alto, 'F'); }
        setDraw(LINE); doc.line(M, y + alto, W - M, y + alto);

        let x2 = M;
        const col = (n: number, cuerpo: () => void) => { cuerpo(); x2 += COLS[n].w; };

        col(0, () => {
            setText(INK); doc.setFont('helvetica', 'bold').setFontSize(8);
            doc.text((doc.splitTextToSize(d.medicamento, COLS[0].w - 4) as string[])[0] ?? '', x2 + 2, y + 4.8);
            let yy = y + 8.2;
            setText(MUTED); doc.setFont('helvetica', 'normal').setFontSize(6.8);
            // El motivo de un PRN vive con su dosis: es lo que explica por qué
            // se dio algo que no estaba en la pauta.
            if (d.prnMotivo) { doc.text(`Para: ${d.prnMotivo}`, x2 + 2, yy); yy += 3.4; }
            if (d.notas) doc.text((doc.splitTextToSize(d.notas, COLS[0].w * 2) as string[])[0] ?? '', x2 + 2, yy);
        });
        col(1, () => {
            setText(INK); doc.setFont('helvetica', 'normal').setFontSize(8);
            doc.text([d.dosis, d.via].filter(Boolean).join(' · ') || '—', x2 + 2, y + 4.8);
        });
        col(2, () => {
            setText(MUTED); doc.setFont('helvetica', 'normal').setFontSize(7.5);
            doc.text(d.slot || (d.prnMotivo ? 'PRN' : '—'), x2 + 2, y + 4.8);
        });
        // Las DOS horas, porque son cosas distintas: cuándo se dio y cuándo se
        // tecleó. Un expediente que solo guarda la segunda no puede auditarse.
        col(3, () => {
            setText(INK); doc.setFont('helvetica', 'normal').setFontSize(7.5);
            doc.text(d.administradoAt ? fechaHora(d.administradoAt) : '—', x2 + 2, y + 4.8);
        });
        col(4, () => {
            setText(MUTED); doc.setFont('helvetica', 'normal').setFontSize(7.5);
            doc.text(fechaHora(d.registradoAt), x2 + 2, y + 4.8);
        });
        col(5, () => {
            const esOk = d.estado === 'ADMINISTERED';
            setText(esOk ? OK : AVISO);
            doc.setFont('helvetica', esOk ? 'normal' : 'bold').setFontSize(7.5);
            doc.text(ESTADO_DOSIS[d.estado] ?? d.estado, x2 + 2, y + 4.8);
            if (d.prnEfecto) {
                setText(MUTED); doc.setFont('helvetica', 'normal').setFontSize(6.8);
                doc.text(`Efecto: ${d.prnEfecto.toLowerCase()}`, x2 + 2, y + 8);
            }
        });
        col(6, () => {
            setText(MUTED); doc.setFont('helvetica', 'normal').setFontSize(7.5);
            doc.text((doc.splitTextToSize(d.porQuien ?? '—', COLS[6].w - 4) as string[])[0] ?? '—', x2 + 2, y + 4.8);
        });

        y += alto;
    });

    if (m.totalEnRango > m.dosis.length) {
        if (y + 16 > H - 15) { pie(); abrirPagina(); }
        y += 4;
        setFill([254, 243, 199]); setDraw([234, 179, 8]);
        doc.rect(M, y, W - 2 * M, 11, 'FD');
        setText([120, 53, 15]);
        doc.setFont('helvetica', 'bold').setFontSize(8.5);
        doc.text(
            `REGISTRO PARCIAL — en este período hay ${m.totalEnRango} dosis y aquí salen las ${m.dosis.length} más recientes. Reduzca el rango.`,
            M + 3, y + 7,
        );
    }

    pie();

    const total = (doc.internal as unknown as { getNumberOfPages: () => number }).getNumberOfPages();
    for (let p = 1; p <= total; p++) {
        doc.setPage(p);
        setText(MUTED);
        doc.setFont('helvetica', 'normal').setFontSize(7);
        doc.text(`Página ${p} de ${total}`, W - M, H - 6.5, { align: 'right' });
    }

    return doc.output('arraybuffer');
}
