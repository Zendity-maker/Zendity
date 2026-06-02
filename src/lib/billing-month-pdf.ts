import jsPDF from 'jspdf';

export interface BillingMonthRow {
    invoiceNumber: string;
    patientName: string;
    roomNumber: string | null;
    issueDate: Date;
    dueDate: Date;
    totalAmount: number;
    amountPaid: number;
    status: string;
    paidAt: Date | null;
    paymentMethod: string | null;
    referenceNumber: string | null;
}

export interface BillingMonthMeta {
    hqName: string;
    monthLabel: string; // "Junio 2026"
    rows: BillingMonthRow[];
    totalFacturado: number;
    cobrado: number;
    pendiente: number;
}

function fmtCurrency(n: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

function fmtDate(d: Date): string {
    return d.toLocaleDateString('es-PR', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'America/Puerto_Rico' });
}

const STATUS_LABELS: Record<string, string> = {
    PENDING: 'Pendiente',
    PAID: 'Pagada',
    OVERDUE: 'Vencida',
    CANCELLED: 'Cancelada',
};

/**
 * Reporte mensual de facturación — PDF landscape.
 * Listado completo de facturas del mes con estado, montos, método.
 */
export function generateBillingMonthPDF(meta: BillingMonthMeta): ArrayBuffer {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const marginX = 10;

    let y = 14;
    const drawHeader = () => {
        doc.setTextColor(15, 110, 86);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.text('ZÉNDITY', marginX, y);
        doc.setTextColor(100, 116, 139);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(`${meta.hqName} — Reporte de Facturación · ${meta.monthLabel}`, marginX, y + 5);
        const summary = `Facturado: ${fmtCurrency(meta.totalFacturado)}   ·   Cobrado: ${fmtCurrency(meta.cobrado)}   ·   Pendiente: ${fmtCurrency(meta.pendiente)}`;
        doc.text(summary, marginX, y + 10);
        y += 16;
    };

    const cols = [
        { label: '#', w: 7 },
        { label: 'Factura', w: 30 },
        { label: 'Residente', w: 55 },
        { label: 'Hab', w: 12 },
        { label: 'Emitida', w: 18 },
        { label: 'Vence', w: 18 },
        { label: 'Total', w: 22 },
        { label: 'Pagado', w: 22 },
        { label: 'Estado', w: 22 },
        { label: 'Método', w: 24 },
        { label: 'Ref', w: 30 },
    ];
    const colX: number[] = [];
    let cx = marginX;
    cols.forEach(c => { colX.push(cx); cx += c.w; });
    const tableRight = cx;

    const drawTableHead = () => {
        doc.setFillColor(241, 245, 249);
        doc.rect(marginX, y - 4, tableRight - marginX, 7, 'F');
        doc.setTextColor(51, 65, 85);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        cols.forEach((c, i) => doc.text(c.label, colX[i] + 1, y));
        y += 5;
    };

    drawHeader();
    drawTableHead();

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);

    const fit = (s: string, w: number) => {
        if (!s) return '';
        if (doc.getTextWidth(s) <= w - 2) return s;
        let t = s;
        while (t.length > 1 && doc.getTextWidth(t + '…') > w - 2) t = t.slice(0, -1);
        return t + '…';
    };

    const rowH = 5.5;
    meta.rows.forEach((r, idx) => {
        if (y > pageH - 12) {
            doc.addPage();
            y = 14;
            drawHeader();
            drawTableHead();
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(30, 41, 59);
        }
        // Tintar fila según estado
        if (r.status === 'OVERDUE') {
            doc.setFillColor(254, 226, 226);
            doc.rect(marginX, y - 3.5, tableRight - marginX, rowH, 'F');
        } else if (r.status === 'PAID') {
            doc.setFillColor(220, 252, 231);
            doc.rect(marginX, y - 3.5, tableRight - marginX, rowH, 'F');
        }
        doc.setTextColor(30, 41, 59);
        doc.text(String(idx + 1), colX[0] + 1, y);
        doc.text(fit(r.invoiceNumber, cols[1].w), colX[1] + 1, y);
        doc.text(fit(r.patientName, cols[2].w), colX[2] + 1, y);
        doc.text(fit(r.roomNumber || '—', cols[3].w), colX[3] + 1, y);
        doc.text(fmtDate(r.issueDate), colX[4] + 1, y);
        doc.text(fmtDate(r.dueDate), colX[5] + 1, y);
        doc.text(fmtCurrency(r.totalAmount), colX[6] + 1, y);
        doc.text(fmtCurrency(r.amountPaid), colX[7] + 1, y);
        doc.text(STATUS_LABELS[r.status] || r.status, colX[8] + 1, y);
        doc.text(fit(r.paymentMethod || '—', cols[9].w), colX[9] + 1, y);
        doc.text(fit(r.referenceNumber || '—', cols[10].w), colX[10] + 1, y);
        doc.setDrawColor(238, 242, 246);
        doc.line(marginX, y + 1.8, tableRight, y + 1.8);
        y += rowH;
    });

    return doc.output('arraybuffer');
}
