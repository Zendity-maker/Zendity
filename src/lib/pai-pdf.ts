import jsPDF from 'jspdf';

// PDF del Plan Asistencial Individualizado (sep-2026).
//
// Antes el botón "Imprimir" abría una página con estilos `print:` de Tailwind y
// llamaba a window.print(): el navegador imprimía la pantalla y el usuario tenía
// que escoger "Guardar como PDF" a mano. Además varias clases estaban rotas
// (`print:border-blacklack`, `print:border-black-2` no existen), así que los
// bordes se perdían justo al imprimir.
//
// jsPDF nativo, mismo enfoque que incident-report-pdf.ts y exec-report-pdf.ts:
// texto nítido, saltos de página controlados y un archivo que se descarga.

export type PaiRisk = { area?: string; finding?: string; priority?: string };
export type PaiGoal = {
    objective?: string; action?: string; responsible?: string;
    frequency?: string; indicator?: string;
};
export type PaiService = {
    serviceName?: string; description?: string; price?: string; category?: string;
};

export type PaiPDFData = {
    hqName: string;
    patientName: string;
    roomNumber?: string | null;
    dateOfBirth?: string | null;
    supportSource?: string | null;
    type?: string | null;
    status?: string | null;
    startDate?: string | null;
    nextReview?: string | null;
    clinicalSummary?: string | null;
    cognitiveLevel?: string | null;
    mobility?: string | null;
    continence?: string | null;
    dietDetails?: string | null;
    interdisciplinarySummary?: string | null;
    risks?: PaiRisk[];
    goals?: PaiGoal[];
    recommendedServices?: PaiService[];
    familyEducation?: string | null;
    preferences?: string | null;
    monitoringMethod?: string | null;
    revisionCriteria?: string | null;
    signedByName?: string | null;
    signedAt?: string | null;
    signatureBase64?: string | null;
};

const TIPO_LABEL: Record<string, string> = {
    INITIAL: 'Inicial', QUARTERLY: 'Trimestral', REVISION: 'Revisión',
};
const ESTADO_LABEL: Record<string, string> = {
    DRAFT: 'Borrador — sin firmar', APPROVED: 'Vigente — firmado', ARCHIVED: 'Archivado',
};

function fmtDate(iso?: string | null): string {
    if (!iso) return 'No definida';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return 'No definida';
    return d.toLocaleDateString('es-PR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function edad(iso?: string | null): string {
    if (!iso) return 'N/D';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return 'N/D';
    const hoy = new Date();
    let a = hoy.getFullYear() - d.getFullYear();
    const m = hoy.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < d.getDate())) a--;
    return `${a} años`;
}

/**
 * Construye el documento y lo devuelve sin guardarlo. Separado de
 * `generatePaiPDF` para poder verificar la salida real —paginas, texto— sin
 * depender del navegador. Ver scripts de prueba.
 */
export function buildPaiPDF(d: PaiPDFData): jsPDF {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const marginX = 14;
    const usableW = pageW - 2 * marginX;
    let y = 14;

    const pageBreakIfNeeded = (need: number) => {
        if (y + need > pageH - 18) { doc.addPage(); y = 16; }
    };

    const paragraph = (text: string, opts?: { size?: number; color?: [number, number, number]; bold?: boolean; italic?: boolean }) => {
        const size = opts?.size ?? 10;
        const color = opts?.color ?? [30, 41, 59];
        doc.setFont('helvetica', opts?.italic ? 'italic' : opts?.bold ? 'bold' : 'normal');
        doc.setFontSize(size);
        doc.setTextColor(color[0], color[1], color[2]);
        for (const line of doc.splitTextToSize(text?.trim() || '—', usableW)) {
            pageBreakIfNeeded(6);
            doc.text(line, marginX, y);
            y += size * 0.52;
        }
        y += 1.5;
    };

    const sectionHeader = (title: string) => {
        pageBreakIfNeeded(18);
        y += 4;
        doc.setFillColor(15, 110, 86);
        doc.rect(marginX, y - 4, usableW, 6, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text(title.toUpperCase(), marginX + 2, y);
        y += 8;
    };

    const campo = (etiqueta: string, valor?: string | null) => {
        pageBreakIfNeeded(10);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(15, 110, 86);
        doc.text(etiqueta, marginX, y);
        y += 4.2;
        paragraph(valor?.trim() || 'No registrado', { size: 10 });
    };

    /** Tabla con anchos proporcionales, wrap por celda y salto de página con encabezado repetido. */
    const tabla = (encabezados: string[], anchos: number[], filas: string[][]) => {
        const cols = anchos.map(f => usableW * f);
        const dibujarEncabezado = () => {
            pageBreakIfNeeded(12);
            doc.setFillColor(226, 232, 240);
            doc.rect(marginX, y - 4, usableW, 6, 'F');
            doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(30, 41, 59);
            let x = marginX + 1.5;
            encabezados.forEach((h, i) => { doc.text(h, x, y); x += cols[i]; });
            y += 6;
        };
        dibujarEncabezado();

        filas.forEach((fila, idx) => {
            const celdas = fila.map((c, i) => doc.splitTextToSize(c?.trim() || '—', cols[i] - 3));
            const alto = Math.max(...celdas.map(c => c.length)) * 4 + 3;
            if (y + alto > pageH - 18) { doc.addPage(); y = 16; dibujarEncabezado(); }
            if (idx % 2 === 1) {
                doc.setFillColor(248, 250, 252);
                doc.rect(marginX, y - 3.5, usableW, alto, 'F');
            }
            doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(30, 41, 59);
            let x = marginX + 1.5;
            celdas.forEach((c, i) => {
                c.forEach((linea: string, j: number) => doc.text(linea, x, y + j * 4));
                x += cols[i];
            });
            y += alto;
            doc.setDrawColor(226, 232, 240);
            doc.line(marginX, y - 2.5, marginX + usableW, y - 2.5);
        });
        y += 3;
    };

    // ─── Encabezado ──────────────────────────────────────────────────────────
    doc.setFillColor(11, 37, 64);
    doc.rect(marginX, y, usableW, 24, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
    doc.text('PLAN ASISTENCIAL INDIVIDUALIZADO', marginX + 4, y + 9);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    doc.setTextColor(168, 220, 198);
    doc.text(`Zéndity · ${d.hqName}`, marginX + 4, y + 15.5);
    doc.setFontSize(8);
    doc.text(
        `${TIPO_LABEL[d.type ?? ''] ?? 'Inicial'} · ${ESTADO_LABEL[d.status ?? ''] ?? 'Borrador'}`,
        marginX + 4, y + 20.5,
    );
    y += 32;

    // ─── 1. Identificación ───────────────────────────────────────────────────
    sectionHeader('1. Identificación y perfil');
    tabla(
        ['Residente', 'Edad', 'Habitación', 'Fuente de apoyo principal'],
        [0.30, 0.12, 0.15, 0.43],
        [[d.patientName, edad(d.dateOfBirth), d.roomNumber || 'N/A', d.supportSource || 'Sin familiar registrado']],
    );
    tabla(
        ['Fecha de inicio', 'Próxima revisión'],
        [0.5, 0.5],
        [[fmtDate(d.startDate), fmtDate(d.nextReview)]],
    );

    // ─── 2. Resumen clínico funcional ────────────────────────────────────────
    sectionHeader('2. Resumen clínico funcional');
    campo('Resumen clínico', d.clinicalSummary);
    tabla(
        ['Nivel cognitivo', 'Movilidad', 'Continencia', 'Dieta / vía de alimentación'],
        [0.25, 0.25, 0.2, 0.3],
        [[d.cognitiveLevel || '—', d.mobility || '—', d.continence || '—', d.dietDetails || '—']],
    );
    if (d.interdisciplinarySummary?.trim()) {
        campo('Directrices para el equipo interdisciplinario', d.interdisciplinarySummary);
    }

    // ─── 3. Riesgos ──────────────────────────────────────────────────────────
    sectionHeader('3. Riesgos y prioridades de atención');
    const risks = d.risks ?? [];
    if (risks.length) {
        tabla(
            ['Prioridad', 'Área', 'Hallazgo'],
            [0.14, 0.22, 0.64],
            risks.map(r => [r.priority || '—', r.area || '—', r.finding || '—']),
        );
    } else {
        paragraph('No se han registrado riesgos en este plan.', { italic: true, color: [148, 163, 184] });
    }

    // ─── 4. Objetivos ────────────────────────────────────────────────────────
    sectionHeader('4. Objetivos e intervención');
    const goals = d.goals ?? [];
    if (goals.length) {
        tabla(
            ['Objetivo', 'Acción', 'Responsable', 'Frecuencia', 'Indicador'],
            [0.22, 0.29, 0.16, 0.14, 0.19],
            goals.map(g => [g.objective || '—', g.action || '—', g.responsible || '—', g.frequency || '—', g.indicator || '—']),
        );
    } else {
        paragraph('No se han registrado objetivos en este plan.', { italic: true, color: [148, 163, 184] });
    }

    // ─── 5. Seguimiento ──────────────────────────────────────────────────────
    sectionHeader('5. Seguimiento, educación y preferencias');
    campo('Preferencias del residente', d.preferences);
    campo('Educación a la familia', d.familyEducation);
    campo('Método de monitoreo', d.monitoringMethod);
    campo('Criterios de revisión', d.revisionCriteria);

    // ─── 6. Recomendaciones ──────────────────────────────────────────────────
    // Servicios que el hogar NO presta con su personal actual. Van como
    // sugerencia a la familia, nunca como tarea asignada al hogar.
    const servicios = d.recommendedServices ?? [];
    if (servicios.length) {
        sectionHeader('6. Recomendaciones adicionales (sugerencias)');
        paragraph(
            'Servicios que podrían mejorar la calidad de vida del residente y que no forman parte '
            + 'del cuidado que presta el hogar con su personal actual. Se ofrecen como sugerencia a la familia.',
            { size: 8.5, italic: true, color: [100, 116, 139] },
        );
        tabla(
            ['Servicio', 'Por qué se sugiere', 'Costo'],
            [0.24, 0.58, 0.18],
            servicios.map(s => [s.serviceName || '—', s.description || '—', s.price || 'A convenir']),
        );
    }

    // ─── Firma ───────────────────────────────────────────────────────────────
    pageBreakIfNeeded(46);
    y += 6;
    sectionHeader('Firma clínica');
    // Un plan esta firmado cuando su estado lo dice o cuando tiene fecha de
    // firma. NO se decide por la firma grafica: la pantalla del PAI no captura
    // trazo, asi que `signatureBase64` es null incluso en planes aprobados y el
    // PDF imprimia "pendiente de firma clinica" sobre un plan vigente.
    const estaFirmado = d.status === 'APPROVED' || !!d.signedAt;

    if (estaFirmado) {
        if (d.signatureBase64) {
            try {
                doc.addImage(d.signatureBase64, 'PNG', marginX, y, 55, 22);
            } catch {
                doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(148, 163, 184);
                doc.text('[firma registrada]', marginX, y + 12);
            }
            y += 24;
        } else {
            // Sin trazo: la firma es la aprobacion registrada en el sistema, con
            // nombre y fecha. Se dice tal cual en vez de fingir una rubrica.
            y += 10;
        }
        doc.setDrawColor(203, 213, 225);
        doc.line(marginX, y, marginX + 75, y);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(15, 110, 86);
        doc.text(d.signedByName || 'Aprobado', marginX, y + 4.5);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(100, 116, 139);
        doc.text(`Aprobado clínicamente en Zéndity · ${fmtDate(d.signedAt)}`, marginX, y + 9);
        y += 16;
    } else {
        doc.setDrawColor(203, 213, 225);
        doc.line(marginX, y + 16, marginX + 65, y + 16);
        doc.setFont('helvetica', 'italic'); doc.setFontSize(8.5); doc.setTextColor(180, 83, 9);
        doc.text('Pendiente de firma clínica — este plan aún no está vigente.', marginX, y + 20);
        y += 26;
    }

    // ─── Pie en todas las páginas ────────────────────────────────────────────
    const generado = new Date().toLocaleString('es-PR', {
        day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
    });
    // jsPDF v2: internal.pages es la fuente canónica del conteo (mismo patrón
    // que continuity-pdf.ts y director-census-pdf.ts).
    const total = (doc.internal as any).pages?.length - 1 || 1;
    for (let i = 1; i <= total; i++) {
        doc.setPage(i);
        doc.setDrawColor(226, 232, 240);
        doc.line(marginX, pageH - 12, pageW - marginX, pageH - 12);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(148, 163, 184);
        doc.text(`${d.patientName} · Generado ${generado}`, marginX, pageH - 8);
        doc.text(`Página ${i} de ${total}`, pageW - marginX, pageH - 8, { align: 'right' });
        doc.text('Documento clínico confidencial — Zéndity', pageW / 2, pageH - 8, { align: 'center' });
    }

    return doc;
}

/** Nombre del archivo que ve el usuario al descargar. */
export function paiPDFFileName(patientName: string): string {
    const safeName = patientName.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40);
    return `PAI_${safeName}_${new Date().toISOString().slice(0, 10)}.pdf`;
}

/** Genera y descarga. Es lo que llama el boton de la pantalla. */
export function generatePaiPDF(d: PaiPDFData): void {
    buildPaiPDF(d).save(paiPDFFileName(d.patientName));
}
