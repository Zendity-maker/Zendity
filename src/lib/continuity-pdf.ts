import jsPDF from 'jspdf';

/**
 * Hoja de Continuidad Operativa — se genera cuando Zendity suspende una sede
 * por facturación.
 *
 * Razón de existir: la suspensión corta el acceso al sistema, y la instrucción
 * al hogar es "continúen con documentación manual". Pero documentar en papel
 * exige SABER qué administrar: 300+ medicamentos activos con sus horarios,
 * alergias y residentes con úlceras por presión no están en la cabeza de
 * nadie. Sin este documento, "manual" significa de memoria — y ahí es donde
 * ocurre un error de medicación con una persona vulnerable.
 *
 * Corta el servicio, no el cuidado.
 */

export type ContinuityMed = { name: string; dosage: string; times: string[] };
export type ContinuityResident = {
    name: string;
    roomNumber: string | null;
    allergies: string | null;
    diet: string | null;
    meds: ContinuityMed[];
    alerts: string[]; // UPP activa, riesgo de caída, encamado, diálisis…
};
export type ContinuityMeta = {
    hqName: string;
    generatedAt: Date;
    residents: ContinuityResident[];
};

const M = 12;

export function generateContinuityPDF(meta: ContinuityMeta): ArrayBuffer {
    const doc = new jsPDF({ unit: 'mm', format: 'letter' });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    let y = M;

    const fecha = meta.generatedAt.toLocaleString('es-PR', {
        dateStyle: 'full', timeStyle: 'short', timeZone: 'America/Puerto_Rico',
    });

    // ── Encabezado ────────────────────────────────────────────────────
    doc.setFillColor(15, 110, 86);
    doc.rect(0, 0, W, 26, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold').setFontSize(15);
    doc.text('HOJA DE CONTINUIDAD OPERATIVA', M, 11);
    doc.setFont('helvetica', 'normal').setFontSize(9);
    doc.text(`${meta.hqName}  ·  Generada ${fecha}`, M, 18);
    doc.text(`${meta.residents.length} residentes`, W - M, 18, { align: 'right' });
    y = 34;

    // ── Aviso ─────────────────────────────────────────────────────────
    doc.setFillColor(254, 243, 199);
    doc.setDrawColor(217, 119, 6);
    doc.rect(M, y, W - M * 2, 20, 'FD');
    doc.setTextColor(120, 53, 15);
    doc.setFont('helvetica', 'bold').setFontSize(9);
    doc.text('El acceso a Zendity está suspendido por un asunto de facturación.', M + 4, y + 6);
    doc.setFont('helvetica', 'normal').setFontSize(8);
    doc.text('Continúe la operación con documentación en papel usando esta hoja como referencia clínica.', M + 4, y + 11.5);
    doc.text('Registre en papel todo lo administrado; deberá transcribirse al restablecerse el servicio.', M + 4, y + 16.5);
    y += 27;

    const ensureSpace = (need: number) => {
        if (y + need > H - 14) { doc.addPage(); y = M; }
    };

    // ── Residentes ────────────────────────────────────────────────────
    for (const r of meta.residents) {
        ensureSpace(24);

        doc.setFillColor(241, 245, 249);
        doc.rect(M, y, W - M * 2, 8, 'F');
        doc.setTextColor(15, 23, 42);
        doc.setFont('helvetica', 'bold').setFontSize(10);
        doc.text(`${r.name}`, M + 3, y + 5.6);
        doc.setFont('helvetica', 'normal').setFontSize(9);
        doc.text(`Hab. ${r.roomNumber || '—'}`, W - M - 3, y + 5.6, { align: 'right' });
        y += 11;

        // Alergias primero: es el dato que evita el daño más grave.
        doc.setFontSize(8);
        if (r.allergies) {
            doc.setTextColor(190, 18, 60);
            doc.setFont('helvetica', 'bold');
            doc.text(`ALERGIAS: ${r.allergies}`, M + 3, y);
            y += 5;
        }
        if (r.alerts.length > 0) {
            doc.setTextColor(180, 83, 9);
            doc.setFont('helvetica', 'bold');
            const alertLines = doc.splitTextToSize(`CUIDADOS: ${r.alerts.join(' · ')}`, W - M * 2 - 6);
            doc.text(alertLines, M + 3, y);
            y += alertLines.length * 4 + 1;
        }
        if (r.diet) {
            doc.setTextColor(71, 85, 105);
            doc.setFont('helvetica', 'normal');
            doc.text(`Dieta: ${r.diet}`, M + 3, y);
            y += 5;
        }

        // Medicamentos con horario
        doc.setTextColor(15, 23, 42);
        doc.setFont('helvetica', 'bold').setFontSize(8);
        doc.text('MEDICAMENTOS', M + 3, y);
        y += 4.5;
        doc.setFont('helvetica', 'normal');
        if (r.meds.length === 0) {
            doc.setTextColor(100, 116, 139);
            doc.text('Sin medicamentos activos registrados.', M + 6, y);
            y += 5;
        } else {
            for (const m of r.meds) {
                ensureSpace(6);
                doc.setTextColor(30, 41, 59);
                const horario = m.times.length > 0 ? m.times.join(', ') : 'sin horario';
                const line = doc.splitTextToSize(`• ${m.name} ${m.dosage} — ${horario}`, W - M * 2 - 10);
                doc.text(line, M + 6, y);
                y += line.length * 4;
                // Casillas para marcar administración en papel
                doc.setDrawColor(203, 213, 225);
                for (let i = 0; i < Math.min(m.times.length || 1, 6); i++) {
                    doc.rect(W - M - 42 + i * 7, y - 3.2, 4.5, 4.5, 'S');
                }
                y += 1.5;
            }
        }
        y += 4;
    }

    // ── Pie en todas las páginas ──────────────────────────────────────
    // jsPDF v2: internal.pages es la fuente canónica del conteo (mismo patrón
    // que director-census-pdf.ts; getNumberOfPages no está en el typing).
    const pages = (doc.internal as any).pages?.length - 1 || 1;
    for (let i = 1; i <= pages; i++) {
        doc.setPage(i);
        doc.setDrawColor(226, 232, 240);
        doc.line(M, H - 11, W - M, H - 11);
        doc.setFont('helvetica', 'normal').setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text('Documento de continuidad — contiene información clínica protegida (PHI). Manéjese conforme a HIPAA.', M, H - 7);
        doc.text(`Página ${i} de ${pages}`, W - M, H - 7, { align: 'right' });
    }

    return doc.output('arraybuffer');
}
