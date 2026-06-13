/**
 * src/lib/sw-evaluation/pdf.ts
 *
 * Genera el PDF de una SWEvaluation (Paso 6 del Sprint SW Eval Fase 1).
 *
 * Reglas de renderizado (decisión 10-jun-2026):
 *   - Renderiza las RESPUESTAS de la TS (data), NO los hints del sistema.
 *     referenceData del prefillSnapshot es provenance/audit — NO va impreso.
 *   - READ_ONLY autoritativo: los valores READ_ONLY se renderizan desde
 *     prefillSnapshot.prefill[key] (point-in-time inmutable), NO desde data.
 *     La identidad del documento legal es la del momento de creación.
 *   - DRAFT: watermark "BORRADOR" diagonal + bloque de firma reemplazado por
 *     "Documento sin firmar". Un documento legal sin firmar NO puede parecer
 *     firmado.
 *   - APPROVED: bloque firma con signerName + signerCollegiateNumber +
 *     approvedAt + signatureBase64 inline. Sin watermark.
 *   - Addendums al final, cada uno con su reason/fecha/createdBy/firma.
 *   - Footer HIPAA + paginación en cada página.
 *
 * Pure: no toca DB. Recibe todo lo necesario y devuelve ArrayBuffer.
 */

import jsPDF from 'jspdf';
import type { SWFormTemplateSchema, SWFormField } from './template-types';

export interface SWEvaluationPDFMeta {
    hq: {
        name: string;
        brandName: string | null;
        brandPrimary: string | null;
        logoUrl: string | null;
        address: string | null;
        billingAddress: string | null;
        phone: string | null;
        licenseNumber: string | null;
    };
    patient: {
        name: string;
        dateOfBirth: Date | null;
        roomNumber: string | null;
        status: string;
    };
    template: {
        name: string;
        version: number;
        schema: SWFormTemplateSchema;
    };
    evaluation: {
        id: string;
        status: 'DRAFT' | 'APPROVED' | 'ARCHIVED';
        data: Record<string, unknown>;
        prefillSnapshot: {
            prefill: Record<string, unknown>;
            referenceData: Record<string, unknown>;
            resolvedAt: string;
        };
        createdAt: Date;
        approvedAt: Date | null;
        signerName: string | null;
        signerCollegiateNumber: string | null;
        signatureBase64: string | null;
    };
    addendums: Array<{
        id: string;
        content: any;
        reason: string;
        createdAt: Date;
        createdByName: string | null;
        signatureBase64: string | null;
    }>;
    generatedAt: Date;
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function fmtDate(d: Date | string | null | undefined): string {
    if (!d) return '—';
    const date = d instanceof Date ? d : new Date(d);
    if (isNaN(date.getTime())) return '—';
    const dd = String(date.getUTCDate()).padStart(2, '0');
    const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${date.getUTCFullYear()}`;
}

function fmtDateTime(d: Date): string {
    return d.toLocaleString('es-PR', {
        timeZone: 'America/Puerto_Rico',
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true,
    });
}

/** Convierte hex "#RRGGBB" a [r, g, b]. */
function hexToRgb(hex: string | null | undefined): [number, number, number] {
    if (!hex) return [15, 23, 42]; // slate-900 default
    const h = hex.replace('#', '');
    if (h.length !== 6) return [15, 23, 42];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/**
 * Valor a renderizar para un field según la regla autoritativa:
 *   READ_ONLY → prefillSnapshot.prefill[key] (inmutable point-in-time)
 *   REFERENCE / NONE → data[key] (lo que la TS guardó/dejó)
 */
function valueForField(field: SWFormField, data: Record<string, unknown>, snapshot: SWEvaluationPDFMeta['evaluation']['prefillSnapshot']): unknown {
    if (field.prefillMode === 'READ_ONLY') {
        return snapshot?.prefill?.[field.key];
    }
    return data?.[field.key];
}

/** Formatea valor para display textual según el tipo del field. */
function formatValueForDisplay(field: SWFormField, value: unknown): string {
    if (value === null || value === undefined || value === '') return '—';

    if (field.type === 'date') {
        return fmtDate(value as any);
    }
    if (field.type === 'checkbox_group') {
        if (Array.isArray(value)) {
            return value.length > 0 ? value.join(', ') : '—';
        }
        // Object con boolean keys → listar los true
        if (typeof value === 'object') {
            const keys = Object.entries(value as Record<string, unknown>).filter(([, v]) => v === true).map(([k]) => k);
            return keys.length > 0 ? keys.join(', ') : '—';
        }
        return String(value);
    }
    if (field.type === 'narrative' || field.type === 'text' || field.type === 'single_select') {
        return String(value);
    }
    // table se renderiza aparte (no devuelve string)
    return JSON.stringify(value).slice(0, 200);
}

// ─── PDF GEN ─────────────────────────────────────────────────────────────

export function generateSWEvaluationPDF(meta: SWEvaluationPDFMeta): ArrayBuffer {
    const displayName = meta.hq.brandName || meta.hq.name;
    const isDraft = meta.evaluation.status !== 'APPROVED';
    const brandPrimary = hexToRgb(meta.hq.brandPrimary);

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const marginX = 14;
    const contentW = pageW - marginX * 2;

    let y = 16;

    const fit = (s: string, w: number): string => {
        if (!s) return '';
        if (doc.getTextWidth(s) <= w - 2) return s;
        let t = s;
        while (t.length > 1 && doc.getTextWidth(t + '…') > w - 2) t = t.slice(0, -1);
        return t + '…';
    };

    // ─── PAGE BREAK helper ──────────────────────────────────────────────
    const ensureSpace = (needed: number) => {
        if (y + needed > pageH - 16) {
            doc.addPage();
            y = 16;
        }
    };

    // ─── DRAW WATERMARK on every page if DRAFT (call after add a page) ──
    // Faint: opacidad ~0.12 + gris claro. Tiene que LEERSE "BORRADOR" pero
    // el texto del form de fondo debe quedar perfectamente legible.
    const drawWatermark = () => {
        if (!isDraft) return;
        const total = (doc.internal as any).pages?.length - 1 || 1;
        // GState con opacidad baja para texto translúcido sobre el contenido.
        const gsFaint = new (doc as any).GState({ opacity: 0.20 });
        const gsFull  = new (doc as any).GState({ opacity: 1 });
        for (let p = 1; p <= total; p++) {
            doc.setPage(p);
            (doc as any).setGState(gsFaint);
            doc.setTextColor(244, 63, 94); // rose-500 (rojo translúcido con opacity 0.20)
            doc.setFontSize(80);
            doc.setFont('helvetica', 'bold');
            doc.text('BORRADOR', pageW / 2, pageH / 2, { align: 'center', angle: 30 });
            (doc as any).setGState(gsFull);
        }
        doc.setTextColor(30, 41, 59);
        doc.setFont('helvetica', 'normal');
    };

    // ─── HEADER (membrete) ──────────────────────────────────────────────
    doc.setFillColor(brandPrimary[0], brandPrimary[1], brandPrimary[2]);
    doc.rect(0, 0, pageW, 26, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(displayName, marginX, 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(meta.template.name, marginX, 18);
    doc.setFontSize(7);
    const addrLine = [
        meta.hq.address || meta.hq.billingAddress,
        meta.hq.licenseNumber ? `Lic. ${meta.hq.licenseNumber}` : null,
        meta.hq.phone ? `Tel. ${meta.hq.phone}` : null,
    ].filter(Boolean).join(' · ');
    if (addrLine) doc.text(addrLine, marginX, 22);

    // Bloque derecho — fecha + status
    doc.setFontSize(8);
    doc.text(`Estado: ${meta.evaluation.status}`, pageW - marginX, 12, { align: 'right' });
    doc.text(`Creada: ${fmtDate(meta.evaluation.createdAt)}`, pageW - marginX, 16, { align: 'right' });
    doc.text(`Plantilla v${meta.template.version}`, pageW - marginX, 20, { align: 'right' });
    doc.text(`Impresa: ${fmtDate(meta.generatedAt)}`, pageW - marginX, 24, { align: 'right' });

    y = 34;

    // ─── PATIENT BLOCK ──────────────────────────────────────────────────
    doc.setTextColor(30, 41, 59);
    doc.setFillColor(241, 245, 249); // slate-100
    doc.rect(marginX, y - 4, contentW, 14, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(meta.patient.name, marginX + 2, y + 1);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const patLine = [
        meta.patient.dateOfBirth ? `FN: ${fmtDate(meta.patient.dateOfBirth)}` : null,
        meta.patient.roomNumber ? `Hab: ${meta.patient.roomNumber}` : null,
        `Status: ${meta.patient.status}`,
    ].filter(Boolean).join('   ·   ');
    doc.text(patLine, marginX + 2, y + 6);
    y += 16;

    // ─── SECTIONS ───────────────────────────────────────────────────────
    for (const section of meta.template.schema.sections) {
        ensureSpace(12);

        // Title bar de la sección
        doc.setFillColor(brandPrimary[0], brandPrimary[1], brandPrimary[2]);
        doc.rect(marginX, y - 4, contentW, 6, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text(section.title, marginX + 2, y);
        doc.setTextColor(30, 41, 59);
        doc.setFont('helvetica', 'normal');
        y += 5;

        for (const field of section.fields) {
            const value = valueForField(field, meta.evaluation.data, meta.evaluation.prefillSnapshot);

            // ── Render por tipo ──
            if (field.type === 'table') {
                // Tabla con columns + rows dinámicas (array de objects) o fixed rows
                ensureSpace(8 + (field.rows?.length ?? Math.min(Array.isArray(value) ? value.length : 0, 10)) * 5);

                doc.setFont('helvetica', 'bold');
                doc.setFontSize(8);
                doc.text(field.label, marginX + 2, y);
                y += 4;

                const cols = field.columns ?? [];
                const colW = contentW / Math.max(cols.length, 1);

                // Header de columnas
                doc.setFillColor(248, 250, 252);
                doc.rect(marginX, y - 3, contentW, 5, 'F');
                doc.setFontSize(7);
                doc.setTextColor(71, 85, 105);
                cols.forEach((c, i) => doc.text(c.label, marginX + 1 + i * colW, y));
                y += 4;
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(30, 41, 59);

                // Rows: si hay value array → usar; si hay field.rows → usar como concept fijo
                const rows: any[] = Array.isArray(value) ? value : (field.rows ?? []).map(r => ({ concept: r }));

                if (rows.length === 0) {
                    doc.setFontSize(7);
                    doc.setTextColor(148, 163, 184);
                    doc.text('(sin entradas)', marginX + 2, y);
                    doc.setTextColor(30, 41, 59);
                    y += 4;
                } else {
                    doc.setFontSize(7);
                    for (const row of rows.slice(0, 30)) {
                        ensureSpace(5);
                        cols.forEach((c, i) => {
                            const cellRaw = (row as any)[c.key];
                            let cellStr: string;
                            if (c.type === 'boolean') cellStr = cellRaw ? 'Sí' : 'No';
                            else if (c.type === 'currency' && cellRaw != null) cellStr = `$${Number(cellRaw).toFixed(2)}`;
                            else cellStr = cellRaw == null || cellRaw === '' ? '—' : String(cellRaw);
                            doc.text(fit(cellStr, colW), marginX + 1 + i * colW, y);
                        });
                        y += 4;
                    }
                }
                y += 3;
                continue;
            }

            if (field.type === 'narrative') {
                ensureSpace(10);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(8);
                doc.text(field.label, marginX + 2, y);
                y += 4;
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(8);
                const text = formatValueForDisplay(field, value);
                const lines = doc.splitTextToSize(text, contentW - 4);
                for (const line of lines as string[]) {
                    ensureSpace(4);
                    doc.text(line, marginX + 2, y);
                    y += 4;
                }
                y += 2;
                continue;
            }

            // text / date / single_select / checkbox_group → 1 línea label : valor
            ensureSpace(5);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            const labelW = 65;
            doc.text(field.label + ':', marginX + 2, y);
            doc.setFont('helvetica', 'normal');
            const display = formatValueForDisplay(field, value);
            const lines = doc.splitTextToSize(display, contentW - labelW - 6) as string[];
            doc.text(lines[0] ?? '—', marginX + 2 + labelW, y);
            y += 4;
            // Si splitTextToSize generó más de 1 línea (texto largo), renderizar resto
            for (let i = 1; i < lines.length; i++) {
                ensureSpace(4);
                doc.text(lines[i], marginX + 2 + labelW, y);
                y += 4;
            }
        }
        y += 2;
    }

    // ─── BLOQUE FIRMA ──────────────────────────────────────────────────
    ensureSpace(40);
    y += 4;
    doc.setDrawColor(brandPrimary[0], brandPrimary[1], brandPrimary[2]);
    doc.setLineWidth(0.4);
    doc.line(marginX, y, pageW - marginX, y);
    y += 5;

    if (meta.evaluation.status === 'APPROVED') {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text('Evaluado por: Trabajador Social', marginX + 2, y);
        y += 5;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(`Nombre: ${meta.evaluation.signerName ?? '—'}`, marginX + 2, y); y += 4;
        doc.text(`Lic. Núm.: ${meta.evaluation.signerCollegiateNumber ?? '—'}`, marginX + 2, y); y += 4;
        doc.text(`Fecha aprobación: ${meta.evaluation.approvedAt ? fmtDateTime(meta.evaluation.approvedAt) : '—'}`, marginX + 2, y); y += 4;

        if (meta.evaluation.signatureBase64) {
            try {
                doc.addImage(meta.evaluation.signatureBase64, 'PNG', marginX + 2, y, 50, 18);
                y += 20;
            } catch {
                // signatureBase64 inválida (no es PNG) — solo texto
                doc.setFont('helvetica', 'italic');
                doc.text('(firma adjunta en sistema)', marginX + 2, y);
                doc.setFont('helvetica', 'normal');
                y += 4;
            }
        }
    } else {
        // DRAFT → bloque de "sin firmar" + watermark se dibuja al final
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(244, 63, 94);
        doc.text('DOCUMENTO SIN FIRMAR — BORRADOR', marginX + 2, y);
        doc.setTextColor(30, 41, 59);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        y += 5;
        doc.text('Esta evaluación está en estado DRAFT. No tiene valor legal.', marginX + 2, y);
        y += 4;
    }

    // ─── ADDENDUMS ──────────────────────────────────────────────────────
    if (meta.addendums.length > 0) {
        ensureSpace(20);
        y += 6;
        doc.setFillColor(brandPrimary[0], brandPrimary[1], brandPrimary[2]);
        doc.rect(marginX, y - 4, contentW, 6, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text('Adendos / Correcciones posteriores', marginX + 2, y);
        doc.setTextColor(30, 41, 59);
        doc.setFont('helvetica', 'normal');
        y += 6;

        for (const a of meta.addendums) {
            ensureSpace(15);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.text(`Adendo · ${fmtDateTime(a.createdAt)}`, marginX + 2, y); y += 4;
            doc.setFont('helvetica', 'normal');
            doc.text(`Razón: ${a.reason}`, marginX + 2, y); y += 4;
            if (a.createdByName) { doc.text(`Por: ${a.createdByName}`, marginX + 2, y); y += 4; }

            const contentStr = typeof a.content === 'string'
                ? a.content
                : (a.content?.text ?? JSON.stringify(a.content, null, 2));
            const lines = doc.splitTextToSize(contentStr, contentW - 4) as string[];
            for (const line of lines) {
                ensureSpace(4);
                doc.text(line, marginX + 2, y);
                y += 4;
            }

            if (a.signatureBase64) {
                try {
                    doc.addImage(a.signatureBase64, 'PNG', marginX + 2, y, 40, 14);
                    y += 16;
                } catch { y += 2; }
            }
            y += 3;
        }
    }

    // ─── DRAW WATERMARK (al final, sobre todas las páginas) ─────────────
    drawWatermark();

    // ─── FOOTER en cada página ──────────────────────────────────────────
    const pageCount = (doc.internal as any).pages?.length - 1 || 1;
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(6.5);
        doc.setTextColor(148, 163, 184);
        const footerY = pageH - 6;
        doc.text(
            `Documento generado por Zéndity para ${displayName}. Contiene PHI — su descarga queda registrada en el audit log bajo HIPAA Audit Controls (45 CFR §164.312(b)).`,
            marginX, footerY,
            { maxWidth: contentW - 30 },
        );
        doc.text(`Página ${i} de ${pageCount}`, pageW - marginX, footerY, { align: 'right' });
    }

    return doc.output('arraybuffer');
}
