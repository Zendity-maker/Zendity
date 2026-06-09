import jsPDF from 'jspdf';

/**
 * Censo Financiero del Director — PDF descargable server-side.
 *
 * Patrón: jsPDF → ArrayBuffer entregado por el endpoint con
 * Content-Type: application/pdf + Content-Disposition: attachment.
 * Cero dependencias del browser (no usa window.print()).
 *
 * Diseño: portrait letter, membrete simple, tabla con totales.
 * Sello "CONFIDENCIAL" en el header para uso interno del Director.
 */

export interface DirectorCensusRow {
    name: string;
    roomNumber: string | null;
    status: string;            // 'ACTIVE' | 'TEMPORARY_LEAVE'
    monthlyFee: number;
    createdAt: Date;
    specialNote?: string;      // ej. "$900 + $1,050 multi-cuenta", "Sin asignar todavía"
}

export interface DirectorCensusMeta {
    hqName: string;
    brandName: string | null;
    billingAddress: string | null;
    phone: string | null;
    residents: DirectorCensusRow[];
    summary: {
        totalCount: number;
        countWithFee: number;
        countWithoutFee: number;
        totalMonthly: number;
        averageMonthly: number;
        estimatedAnnual: number;
    };
    generatedAt: Date;
}

function fmtDateShort(d: Date): string {
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${d.getUTCFullYear()}`;
}

function fmtDateLong(d: Date): string {
    return d.toLocaleString('es-PR', {
        timeZone: 'America/Puerto_Rico',
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true,
    });
}

function fmtCurrency(n: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

export function generateDirectorCensusPDF(meta: DirectorCensusMeta): ArrayBuffer {
    const displayName = meta.brandName || meta.hqName;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const marginX = 14;

    // Trunca texto a ancho disponible (con margen interno).
    const fit = (s: string, w: number): string => {
        if (!s) return '';
        if (doc.getTextWidth(s) <= w - 2) return s;
        let t = s;
        while (t.length > 1 && doc.getTextWidth(t + '…') > w - 2) t = t.slice(0, -1);
        return t + '…';
    };

    // ── Header / Membrete ──────────────────────────────────────────────
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, pageW, 24, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(displayName, marginX, 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Censo Financiero del Director', marginX, 17);
    if (meta.billingAddress) {
        doc.setFontSize(7);
        doc.text(meta.billingAddress, marginX, 21);
    }

    // Bloque derecho — CONFIDENCIAL + fecha
    doc.setTextColor(244, 63, 94); // rose-500
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('CONFIDENCIAL', pageW - marginX, 11, { align: 'right' });
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text('Uso interno del Director', pageW - marginX, 15, { align: 'right' });
    doc.text(fmtDateLong(meta.generatedAt), pageW - marginX, 19, { align: 'right' });

    let y = 32;

    // ── Tabla ──────────────────────────────────────────────────────────
    // # · Residente · Hab · Estado · Fecha adm. · Mensualidad
    const cols = [
        { label: '#',            w: 8,  align: 'left'  as const },
        { label: 'Residente',    w: 70, align: 'left'  as const },
        { label: 'Hab.',         w: 14, align: 'left'  as const },
        { label: 'Estado',       w: 20, align: 'left'  as const },
        { label: 'Fecha adm.',   w: 24, align: 'left'  as const },
        { label: 'Mensualidad',  w: 0,  align: 'right' as const }, // resto del ancho
    ];
    const usedW = cols.slice(0, -1).reduce((s, c) => s + c.w, 0);
    cols[cols.length - 1].w = (pageW - marginX * 2) - usedW;
    const tableRight = pageW - marginX;

    const colX: number[] = [];
    let cx = marginX;
    cols.forEach(c => { colX.push(cx); cx += c.w; });

    const drawTableHead = () => {
        doc.setFillColor(241, 245, 249); // slate-100
        doc.rect(marginX, y - 4, tableRight - marginX, 7, 'F');
        doc.setTextColor(51, 65, 85); // slate-700
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        cols.forEach((c, i) => {
            const x = c.align === 'right' ? colX[i] + c.w - 1.5 : colX[i] + 1.5;
            doc.text(c.label, x, y, { align: c.align });
        });
        y += 5;
    };
    drawTableHead();

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);

    const baseRowH = 5.5;
    meta.residents.forEach((r, idx) => {
        const hasNote = !!r.specialNote;
        const rowH = hasNote ? baseRowH + 4 : baseRowH;

        // page break
        if (y + rowH > pageH - 50) {
            doc.addPage();
            y = 14;
            drawTableHead();
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
        }

        const onLeave = r.status === 'TEMPORARY_LEAVE';
        if (onLeave) {
            doc.setFillColor(255, 247, 237); // amber-50
            doc.rect(marginX, y - 4, tableRight - marginX, rowH, 'F');
        }

        // #
        doc.setTextColor(148, 163, 184); // slate-400
        doc.text(String(idx + 1), colX[0] + 1.5, y);

        // Residente (+ nota especial debajo)
        doc.setTextColor(30, 41, 59); // slate-800
        doc.setFont('helvetica', 'bold');
        doc.text(fit(r.name.trim(), cols[1].w), colX[1] + 1.5, y);
        if (hasNote) {
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(7);
            doc.setTextColor(100, 116, 139); // slate-500
            doc.text('↳ ' + fit(r.specialNote!, cols[1].w + cols[2].w), colX[1] + 1.5, y + 3.5);
            doc.setFontSize(8);
        }
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(30, 41, 59);

        // Hab
        doc.text(r.roomNumber ?? '—', colX[2] + 1.5, y);

        // Estado
        if (onLeave) {
            doc.setTextColor(154, 52, 18);
            doc.text('Hospital', colX[3] + 1.5, y);
            doc.setTextColor(30, 41, 59);
        } else {
            doc.setTextColor(100, 116, 139);
            doc.text('En piso', colX[3] + 1.5, y);
            doc.setTextColor(30, 41, 59);
        }

        // Fecha admisión (proxy: createdAt)
        doc.text(fmtDateShort(r.createdAt), colX[4] + 1.5, y);

        // Mensualidad (right-aligned)
        if (r.monthlyFee > 0) {
            doc.setFont('helvetica', 'bold');
            doc.text(fmtCurrency(r.monthlyFee), colX[5] + cols[5].w - 1.5, y, { align: 'right' });
            doc.setFont('helvetica', 'normal');
        } else {
            doc.setTextColor(148, 163, 184);
            doc.text('—', colX[5] + cols[5].w - 1.5, y, { align: 'right' });
            doc.setTextColor(30, 41, 59);
        }

        // separator
        doc.setDrawColor(226, 232, 240);
        doc.line(marginX, y + (hasNote ? 5 : 1.5), tableRight, y + (hasNote ? 5 : 1.5));
        y += rowH;
    });

    // ── Totales ────────────────────────────────────────────────────────
    // page-break si totales no caben
    if (y + 30 > pageH - 10) {
        doc.addPage();
        y = 20;
    } else {
        y += 4;
    }

    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.6);
    doc.line(marginX, y, tableRight, y);
    doc.setLineWidth(0.2);
    y += 6;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('Total mensual', marginX, y);
    doc.text(fmtCurrency(meta.summary.totalMonthly), tableRight, y, { align: 'right' });
    y += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text('Total anual proyectado', marginX, y);
    doc.text(fmtCurrency(meta.summary.estimatedAnnual), tableRight, y, { align: 'right' });
    y += 4.5;

    doc.text('Promedio por residente (con tarifa)', marginX, y);
    doc.text(fmtCurrency(meta.summary.averageMonthly), tableRight, y, { align: 'right' });
    y += 4.5;

    doc.text('Residentes en el censo', marginX, y);
    doc.text(
        `${meta.summary.totalCount} (${meta.summary.countWithFee} con tarifa, ${meta.summary.countWithoutFee} sin asignar)`,
        tableRight, y, { align: 'right' }
    );
    y += 8;

    // ── Footer en última página ───────────────────────────────────────
    // (Repetir en cada página podría hacerse con un loop sobre páginas,
    // pero para censo de 1-3 páginas el footer al final es suficiente.)
    // jsPDF v2 typing exposes internal.pages as the canonical page count source.
    const pageCount = (doc.internal as any).pages?.length - 1 || 1;
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(6.5);
        doc.setTextColor(148, 163, 184);
        const footerY = pageH - 6;
        doc.text(
            'Documento generado por Zéndity para uso interno del Director. Contiene PHI — su descarga queda registrada en el audit log bajo HIPAA Audit Controls (45 CFR §164.312(b)).',
            marginX, footerY, { maxWidth: pageW - marginX * 2 - 30 }
        );
        doc.text(`Página ${i} de ${pageCount}`, pageW - marginX, footerY, { align: 'right' });
    }

    return doc.output('arraybuffer');
}
