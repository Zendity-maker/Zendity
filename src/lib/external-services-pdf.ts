import jsPDF from 'jspdf';

export type ExternalVisitRow = {
    registeredAt: Date;
    providerName: string;
    categoryName: string;
    categoryIcon: string | null;
    serviceType: string | null;
    comment: string | null;
    isFacilityWide: boolean;
    patients: { name: string; roomNumber: string | null }[];
    reviewedByName: string | null;
    autoPublished: boolean;
};

export type ExternalServicesPDFMeta = {
    hqName: string;
    monthLabel: string; // "Mayo 2026"
    totalPublished: number;
    autoPublishedCount: number;
    visits: ExternalVisitRow[];
};

/**
 * Genera el PDF mensual de Visitas Externas Publicadas.
 *
 * Diseñado para correr server-side: devuelve ArrayBuffer (no save() en disk).
 * El endpoint envía el buffer con Content-Type: application/pdf.
 *
 * Layout: portrait letter. Una fila por visita. Si el comentario es largo,
 * usa múltiples líneas con wrap.
 */
export function generateExternalServicesPDF(meta: ExternalServicesPDFMeta): ArrayBuffer {
    const { hqName, monthLabel, totalPublished, autoPublishedCount, visits } = meta;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const marginX = 12;
    const usableW = pageW - marginX * 2;

    let y = 14;

    // Header
    const drawHeader = () => {
        doc.setTextColor(15, 110, 86);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.text('ZÉNDITY', marginX, y);

        doc.setTextColor(100, 116, 139);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(`${hqName} — Visitas de Servicios Externos`, marginX, y + 6);
        doc.text(`Período: ${monthLabel}   ·   Total publicadas: ${totalPublished}   ·   Auto-publicadas (SLA): ${autoPublishedCount}`, marginX, y + 11);

        y += 18;
        doc.setDrawColor(15, 110, 86);
        doc.setLineWidth(0.5);
        doc.line(marginX, y, pageW - marginX, y);
        y += 6;
    };

    drawHeader();

    if (visits.length === 0) {
        doc.setTextColor(100, 116, 139);
        doc.setFontSize(11);
        doc.text('Sin visitas publicadas en este período.', marginX, y + 10);
        return doc.output('arraybuffer');
    }

    doc.setFontSize(9);

    visits.forEach((v, idx) => {
        // Estimar alto del bloque para saber si hace falta nueva página
        const commentLines = v.comment ? doc.splitTextToSize(v.comment, usableW - 4) : [];
        const patientLines = v.isFacilityWide
            ? 1
            : Math.max(1, Math.ceil(v.patients.length / 4));
        const blockH = 18 + (commentLines.length * 4) + patientLines * 4;

        if (y + blockH > pageH - 12) {
            doc.addPage();
            y = 14;
            drawHeader();
            doc.setFontSize(9);
        }

        // Fecha + proveedor
        const dt = v.registeredAt.toLocaleString('es-PR', {
            timeZone: 'America/Puerto_Rico',
            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
        });
        doc.setTextColor(15, 110, 86);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text(`${v.categoryIcon || ''} ${v.providerName}`, marginX, y);

        doc.setTextColor(100, 116, 139);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(`${dt}`, pageW - marginX, y, { align: 'right' });
        y += 4;

        // Categoría + tipo servicio
        doc.setTextColor(71, 85, 105);
        doc.setFontSize(8);
        const sub = `${v.categoryName}${v.serviceType ? ` · ${v.serviceType}` : ''}`;
        doc.text(sub, marginX, y);
        y += 5;

        // Residentes
        doc.setTextColor(30, 41, 59);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text('Residentes:', marginX, y);
        doc.setFont('helvetica', 'normal');
        if (v.isFacilityWide) {
            doc.text('Toda la sede', marginX + 18, y);
            y += 5;
        } else {
            const list = v.patients.map(p => p.roomNumber ? `${p.name} (Hab. ${p.roomNumber})` : p.name).join(' · ');
            const lines = doc.splitTextToSize(list, usableW - 20);
            lines.forEach((line: string, i: number) => {
                doc.text(line, marginX + 18, y + i * 4);
            });
            y += lines.length * 4 + 1;
        }

        // Comentario
        if (commentLines.length > 0) {
            doc.setFont('helvetica', 'bold');
            doc.text('Comentario:', marginX, y);
            doc.setFont('helvetica', 'normal');
            commentLines.forEach((line: string, i: number) => {
                doc.text(line, marginX + 18, y + i * 4);
            });
            y += commentLines.length * 4 + 1;
        }

        // Reviewer / autopublish
        if (v.autoPublished) {
            doc.setTextColor(180, 83, 9);
            doc.setFontSize(7);
            doc.text('Auto-publicada por SLA (24h sin revisión).', marginX, y);
            y += 4;
        } else if (v.reviewedByName) {
            doc.setTextColor(100, 116, 139);
            doc.setFontSize(7);
            doc.text(`Aprobada por: ${v.reviewedByName}`, marginX, y);
            y += 4;
        }

        // Separador
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.2);
        doc.line(marginX, y + 1, pageW - marginX, y + 1);
        y += 5;
    });

    return doc.output('arraybuffer');
}
