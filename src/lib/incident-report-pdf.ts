import jsPDF from 'jspdf';

// Sprint incident-print (jul-2026): PDF de una Observación de Personal individual.
// jsPDF nativo (texto nítido, mismo enfoque que exec-report-pdf.ts). Incluye el
// desenlace de firma del empleado: firmó (con firma), rehusó (con motivo +
// nota de reunión formal), o pendiente.

export type IncidentReportPDFData = {
    id: string;
    hqName: string;
    createdAt: string;
    type?: string | null;
    severity: string;
    category: string;
    status: string;
    description: string;
    directorNote?: string | null;
    employeeResponse?: string | null;
    respondedAt?: string | null;
    // Empleado y supervisor
    employeeName: string;
    employeeRole?: string | null;
    supervisorName?: string | null;
    // Firma del supervisor (creación)
    supervisorSignature?: string | null;
    signedAt?: string | null;
    // Desenlace del acuse del empleado
    acknowledgedAt?: string | null;
    acknowledgedSignature?: string | null;
    acknowledgeRefusedAt?: string | null;
    acknowledgeRefusedReason?: string | null;
};

const SEVERITY_LABELS: Record<string, string> = {
    OBSERVATION: 'Observación',
    WARNING: 'Amonestación Escrita',
    SUSPENSION: 'Suspensión Temporal',
    TERMINATION: 'Despido Justificado',
};
const CATEGORY_LABELS: Record<string, string> = {
    PUNCTUALITY: 'Puntualidad',
    PATIENT_CARE: 'Cuidado del Residente',
    HYGIENE: 'Desempeño',
    BEHAVIOR: 'Conducta',
    DOCUMENTATION: 'Documentación',
    UNIFORM: 'Uniforme',
    OTHER: 'Otro',
};
const STATUS_LABELS: Record<string, string> = {
    DRAFT: 'Borrador',
    NOTIFIED: 'Notificada',
    PENDING_EXPLANATION: 'Esperando explicación',
    EXPLANATION_RECEIVED: 'Respuesta recibida',
    APPLIED: 'Aplicada',
    DISMISSED: 'Desestimada',
    CLOSED: 'Cerrada',
};
const ROLE_LABELS: Record<string, string> = {
    CAREGIVER: 'Cuidador(a)', NURSE: 'Enfermero(a)', SUPERVISOR: 'Supervisor(a)',
    DIRECTOR: 'Director(a)', ADMIN: 'Administrador(a)',
};

function fmtDateTime(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleString('es-PR', { timeZone: 'America/Puerto_Rico', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/**
 * Genera y descarga el PDF de una observación de personal individual.
 */
export function generateIncidentReportPDF(d: IncidentReportPDFData): void {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const marginX = 14;
    const usableW = pageW - 2 * marginX;
    let y = 14;

    const pageBreakIfNeeded = (need: number) => {
        if (y + need > pageH - 16) { doc.addPage(); y = 16; }
    };

    // Párrafo con wrap. Devuelve la nueva y.
    const paragraph = (text: string, opts?: { size?: number; color?: [number, number, number]; bold?: boolean }) => {
        const size = opts?.size ?? 10;
        const color = opts?.color ?? [30, 41, 59];
        doc.setFont('helvetica', opts?.bold ? 'bold' : 'normal'); doc.setFontSize(size);
        doc.setTextColor(color[0], color[1], color[2]);
        const lines = doc.splitTextToSize(text || '—', usableW);
        for (const line of lines) {
            pageBreakIfNeeded(6);
            doc.text(line, marginX, y);
            y += size * 0.52;
        }
    };

    const sectionHeader = (title: string) => {
        pageBreakIfNeeded(16);
        y += 4;
        doc.setFillColor(15, 110, 86); doc.rect(marginX, y - 4, usableW, 6, 'F');
        doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
        doc.text(title, marginX + 2, y);
        y += 7;
    };

    // Imagen de firma (data URL base64 PNG). Best-effort: si falla, muestra texto.
    const signatureImage = (b64: string, caption: string) => {
        pageBreakIfNeeded(28);
        try {
            doc.addImage(b64, 'PNG', marginX, y, 55, 22);
        } catch {
            doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(148, 163, 184);
            doc.text('[firma registrada]', marginX, y + 10);
        }
        doc.setDrawColor(203, 213, 225); doc.line(marginX, y + 24, marginX + 55, y + 24);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(100, 116, 139);
        doc.text(caption, marginX, y + 27.5);
        y += 32;
    };

    // ─── Header ──────────────────────────────────────────────────────
    doc.setFillColor(11, 37, 64); doc.rect(marginX, y, usableW, 22, 'F');
    doc.setTextColor(29, 158, 117); doc.setFont('helvetica', 'bold'); doc.setFontSize(17);
    doc.text('ZÉNDITY', marginX + 6, y + 9);
    doc.setTextColor(203, 213, 225); doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    doc.text(`${d.hqName} — OBSERVACIÓN DE PERSONAL`, marginX + 6, y + 14);
    doc.setTextColor(148, 163, 184); doc.setFontSize(8);
    doc.text(`Creada: ${fmtDateTime(d.createdAt)}`, marginX + 6, y + 18.5);
    y += 28;

    // ─── Meta (severidad / categoría / estado) ───────────────────────
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    const meta = [
        { label: 'Severidad', value: SEVERITY_LABELS[d.severity] || d.severity },
        { label: 'Categoría', value: CATEGORY_LABELS[d.category] || d.category },
        { label: 'Estado', value: STATUS_LABELS[d.status] || d.status },
    ];
    const col = usableW / meta.length;
    meta.forEach((m, i) => {
        const x = marginX + i * col;
        doc.setTextColor(100, 116, 139); doc.setFont('helvetica', 'bold'); doc.setFontSize(7);
        doc.text(m.label.toUpperCase(), x, y);
        doc.setTextColor(15, 110, 86); doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
        doc.text(String(m.value), x, y + 6);
    });
    y += 12;

    // ─── Empleado / creada por ───────────────────────────────────────
    sectionHeader('EMPLEADO');
    paragraph(`${d.employeeName}${d.employeeRole ? `  ·  ${ROLE_LABELS[d.employeeRole] || d.employeeRole}` : ''}`, { bold: true, size: 11 });
    if (d.supervisorName) {
        y += 1;
        paragraph(`Reportada por: ${d.supervisorName}`, { size: 9, color: [100, 116, 139] });
    }

    // ─── Descripción ─────────────────────────────────────────────────
    sectionHeader('DESCRIPCIÓN');
    paragraph(d.description);

    // ─── Nota del director ───────────────────────────────────────────
    if (d.directorNote && d.directorNote.trim()) {
        sectionHeader('NOTA DE LA DIRECCIÓN');
        paragraph(d.directorNote);
    }

    // ─── Explicación del empleado ────────────────────────────────────
    if (d.employeeResponse && d.employeeResponse.trim()) {
        sectionHeader('EXPLICACIÓN DEL EMPLEADO');
        if (d.respondedAt) paragraph(`Respondida: ${fmtDateTime(d.respondedAt)}`, { size: 8, color: [148, 163, 184] });
        paragraph(d.employeeResponse);
    }

    // ─── Desenlace del acuse ─────────────────────────────────────────
    sectionHeader('ACUSE DE RECIBO DEL EMPLEADO');
    if (d.acknowledgedAt) {
        paragraph(`Firmado el ${fmtDateTime(d.acknowledgedAt)}.`, { size: 9 });
        paragraph('El acuse indica recibo del documento; no constituye necesariamente conformidad.', { size: 8, color: [148, 163, 184] });
        y += 2;
        if (d.acknowledgedSignature) signatureImage(d.acknowledgedSignature, `Firma de ${d.employeeName}`);
    } else if (d.acknowledgeRefusedAt) {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(185, 28, 28);
        pageBreakIfNeeded(6);
        doc.text('El empleado REHUSÓ firmar el acuse.', marginX, y); y += 6;
        paragraph(`Registrado el ${fmtDateTime(d.acknowledgeRefusedAt)}.`, { size: 9, color: [100, 116, 139] });
        if (d.acknowledgeRefusedReason && d.acknowledgeRefusedReason.trim()) {
            paragraph('Motivo del empleado:', { size: 8, bold: true, color: [100, 116, 139] });
            paragraph(d.acknowledgeRefusedReason);
        }
        paragraph('Requiere reunión formal con administración. Se notificó a la dirección.', { size: 9, color: [185, 28, 28] });
    } else {
        paragraph('Pendiente: el empleado aún no ha firmado ni rehusado el acuse.', { size: 9, color: [148, 163, 184] });
    }

    // ─── Firma del supervisor ────────────────────────────────────────
    if (d.supervisorSignature) {
        sectionHeader('FIRMA DE QUIEN REPORTA');
        if (d.signedAt) paragraph(`Firmado el ${fmtDateTime(d.signedAt)}.`, { size: 8, color: [148, 163, 184] });
        y += 1;
        signatureImage(d.supervisorSignature, d.supervisorName ? `Firma de ${d.supervisorName}` : 'Firma del supervisor');
    }

    // ─── Footer ──────────────────────────────────────────────────────
    pageBreakIfNeeded(12);
    doc.setDrawColor(226, 232, 240); doc.line(marginX, pageH - 14, pageW - marginX, pageH - 14);
    doc.setTextColor(148, 163, 184); doc.setFont('helvetica', 'italic'); doc.setFontSize(7);
    doc.text(`Generado por Zéndity — app.zendity.com   ·   Documento confidencial de Recursos Humanos   ·   ${d.hqName}`, marginX, pageH - 10);

    const safeName = d.employeeName.replace(/[^a-zA-Z0-9]/g, '_');
    const fileDate = new Date().toISOString().slice(0, 10);
    doc.save(`Observacion_${safeName}_${fileDate}.pdf`);
}
