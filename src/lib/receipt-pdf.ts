import jsPDF from 'jspdf';

export interface ReceiptItem {
    description: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
}

export interface ReceiptMeta {
    hqName: string;
    hqPhone?: string | null;
    invoiceNumber: string;
    issueDate: Date;
    paidAt: Date;
    paymentMethod: string;
    referenceNumber: string | null;
    patientName: string;
    patientRoom: string | null;
    familyName: string | null;
    items: ReceiptItem[];
    subtotal: number;
    totalAmount: number;
    notes: string | null;
}

function fmtDate(d: Date): string {
    return d.toLocaleDateString('es-PR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Puerto_Rico' });
}

function fmtCurrency(n: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

/**
 * Recibo de pago — PDF descargable.
 *
 * Diseño tipo factura simple: header con logo Zéndity, datos del hogar,
 * número de recibo, residente, items, totales, método de pago + referencia
 * ACH, sello "PAGADO" estampado al lado del total.
 *
 * Devuelve ArrayBuffer para entregar por el endpoint con
 * Content-Type: application/pdf.
 */
export function generateReceiptPDF(meta: ReceiptMeta): ArrayBuffer {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
    const pageW = doc.internal.pageSize.getWidth();
    const marginX = 14;

    // Header
    doc.setFillColor(15, 110, 86);
    doc.rect(0, 0, pageW, 26, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('ZÉNDITY', marginX, 13);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(meta.hqName, marginX, 19);
    doc.setFontSize(8);
    doc.text('Recibo de pago', marginX, 23);

    // Bloque derecho: número + fecha
    doc.setFontSize(9);
    doc.text(`Recibo: ${meta.invoiceNumber}`, pageW - marginX, 13, { align: 'right' });
    doc.text(`Emitido: ${fmtDate(meta.issueDate)}`, pageW - marginX, 17, { align: 'right' });
    doc.text(`Pagado: ${fmtDate(meta.paidAt)}`, pageW - marginX, 21, { align: 'right' });

    let y = 38;

    // Datos del residente / familiar
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Facturado a:', marginX, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    y += 5;
    doc.text(`${meta.patientName}${meta.patientRoom ? ` · Hab ${meta.patientRoom}` : ''}`, marginX, y);
    if (meta.familyName) {
        y += 4;
        doc.setTextColor(100, 116, 139);
        doc.text(`Contacto: ${meta.familyName}`, marginX, y);
        doc.setTextColor(30, 41, 59);
    }
    y += 10;

    // Tabla de items
    const colDesc = marginX;
    const colQty = pageW - marginX - 70;
    const colUnit = pageW - marginX - 45;
    const colTotal = pageW - marginX;

    doc.setFillColor(241, 245, 249);
    doc.rect(marginX, y - 4, pageW - 2 * marginX, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text('DESCRIPCIÓN', colDesc + 1, y);
    doc.text('CANT.', colQty, y, { align: 'right' });
    doc.text('UNIT.', colUnit, y, { align: 'right' });
    doc.text('TOTAL', colTotal - 1, y, { align: 'right' });
    y += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    for (const item of meta.items) {
        doc.text(item.description, colDesc + 1, y);
        doc.text(String(item.quantity), colQty, y, { align: 'right' });
        doc.text(fmtCurrency(item.unitPrice), colUnit, y, { align: 'right' });
        doc.text(fmtCurrency(item.totalPrice), colTotal - 1, y, { align: 'right' });
        doc.setDrawColor(226, 232, 240);
        doc.line(marginX, y + 1.5, pageW - marginX, y + 1.5);
        y += 6;
    }

    y += 6;

    // Totales
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text('Subtotal:', pageW - marginX - 35, y);
    doc.setTextColor(30, 41, 59);
    doc.text(fmtCurrency(meta.subtotal), pageW - marginX - 1, y, { align: 'right' });
    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 110, 86);
    doc.text('Total pagado:', pageW - marginX - 35, y);
    doc.text(fmtCurrency(meta.totalAmount), pageW - marginX - 1, y, { align: 'right' });
    y += 12;

    // Sello PAGADO al lado izquierdo
    doc.setDrawColor(34, 160, 107);
    doc.setLineWidth(1);
    doc.roundedRect(marginX, y - 14, 50, 14, 2, 2, 'S');
    doc.setTextColor(34, 160, 107);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('PAGADO', marginX + 25, y - 5, { align: 'center' });
    doc.setLineWidth(0.2);

    // Bloque método de pago
    doc.setTextColor(71, 85, 105);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const methodLabel: Record<string, string> = { ACH: 'Transferencia ACH', CHECK: 'Cheque', WIRE: 'Wire', CASH: 'Efectivo' };
    doc.text(`Método: ${methodLabel[meta.paymentMethod] || meta.paymentMethod}`, marginX + 60, y - 9);
    if (meta.referenceNumber) {
        doc.text(`Referencia: ${meta.referenceNumber}`, marginX + 60, y - 4);
    }
    y += 8;

    // Notas
    if (meta.notes) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        const noteLines = doc.splitTextToSize(`Notas: ${meta.notes}`, pageW - 2 * marginX);
        noteLines.forEach((line: string, i: number) => {
            doc.text(line, marginX, y + i * 4);
        });
        y += noteLines.length * 4 + 4;
    }

    // Footer
    doc.setTextColor(148, 163, 184);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(
        `${meta.hqName}${meta.hqPhone ? ` · ${meta.hqPhone}` : ''} — Zéndity Healthcare Management Platform`,
        pageW / 2,
        doc.internal.pageSize.getHeight() - 8,
        { align: 'center' },
    );

    return doc.output('arraybuffer');
}
