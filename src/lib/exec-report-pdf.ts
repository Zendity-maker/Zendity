import jsPDF from 'jspdf';

export type ExecReportData = {
    hqName: string;
    directorName: string;
    period: 'day' | 'week' | 'month';
    periodStart: string;
    periodEnd: string;
    censo: {
        activeNow: number; leaveNow: number;
        admisiones: number; egresos: number; hospitalizaciones: number;
    };
    clinico: {
        meds: { total: number; administered: number; omitted: number; refused: number; held: number; pending: number; compliancePct: number };
        vitals: { total: number; critical: number };
        rotations: number;
        incidents: Record<string, number>;
    };
    operacional: {
        sessionsOpened: number; sessionsClosed: number; sessionsForcedClosed: number;
        absences: number;
        handovers: { total: number; completed: number; completedPct: number };
        overridesCreated: number;
    };
    personal: {
        totalStaff: number;
        avgCompliance: number;
        topStaff: Array<{ name: string; role: string; score: number }>;
        bottomStaff: Array<{ name: string; role: string; score: number }>;
        hrIncidents: Record<string, number>;
    };
};

const PERIOD_LABEL: Record<string, string> = {
    day: 'RESUMEN DEL DÍA',
    week: 'RESUMEN DE LA SEMANA',
    month: 'RESUMEN DEL MES',
};

function fmtDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('es-PR', { timeZone: 'America/Puerto_Rico', day: '2-digit', month: 'long', year: 'numeric' });
}
function fmtDateTime(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleString('es-PR', { timeZone: 'America/Puerto_Rico', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/**
 * PDF del Resumen Ejecutivo (Día/Semana/Mes) — descarga 1-clic desde el dashboard.
 * Layout: letter portrait, 5 secciones (Resumen · Censo · Clínico · Operacional · Personal).
 */
export function generateExecReportPDF(d: ExecReportData): void {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const marginX = 12;
    const usableW = pageW - 2 * marginX;
    let y = 14;

    const fit = (s: string, w: number): string => {
        if (!s) return '';
        if (doc.getTextWidth(s) <= w - 1.5) return s;
        let t = s;
        while (t.length > 1 && doc.getTextWidth(t + '…') > w - 1.5) t = t.slice(0, -1);
        return t + '…';
    };

    const pageBreakIfNeeded = (need: number) => {
        if (y + need > pageH - 12) { doc.addPage(); y = 14; }
    };

    // ─── Header ──────────────────────────────────────────────────────
    doc.setFillColor(15, 23, 42); doc.rect(marginX, y, usableW, 22, 'F');
    doc.setTextColor(29, 158, 117); doc.setFont('helvetica', 'bold'); doc.setFontSize(18);
    doc.text('ZÉNDITY', marginX + 6, y + 9);
    doc.setTextColor(203, 213, 225); doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    doc.text(`${d.hqName} — ${PERIOD_LABEL[d.period]}`, marginX + 6, y + 14);
    doc.setTextColor(148, 163, 184); doc.setFontSize(8);
    doc.text(`Período: ${fmtDateTime(d.periodStart)}  →  ${fmtDateTime(d.periodEnd)}`, marginX + 6, y + 18.5);
    y += 26;

    doc.setTextColor(100, 116, 139); doc.setFontSize(8);
    doc.text(`Generado: ${fmtDateTime(new Date().toISOString())}   ·   Director: ${d.directorName}`, marginX, y);
    y += 6;

    // Helper: section header (teal bar)
    const sectionHeader = (title: string) => {
        pageBreakIfNeeded(12);
        doc.setFillColor(15, 110, 86); doc.rect(marginX, y - 4, usableW, 6, 'F');
        doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
        doc.text(title, marginX + 2, y);
        y += 6;
    };

    // Helper: KPI tile row (n tiles)
    const kpiRow = (tiles: Array<{ label: string; value: string | number; sub?: string }>) => {
        pageBreakIfNeeded(20);
        const tileW = (usableW - (tiles.length - 1) * 3) / tiles.length;
        tiles.forEach((t, i) => {
            const x = marginX + i * (tileW + 3);
            doc.setFillColor(248, 250, 252); doc.roundedRect(x, y, tileW, 16, 1.5, 1.5, 'F');
            doc.setDrawColor(226, 232, 240); doc.roundedRect(x, y, tileW, 16, 1.5, 1.5, 'S');
            doc.setTextColor(100, 116, 139); doc.setFont('helvetica', 'bold'); doc.setFontSize(7);
            doc.text(t.label.toUpperCase(), x + 3, y + 4.5);
            doc.setTextColor(15, 110, 86); doc.setFontSize(14);
            doc.text(String(t.value), x + 3, y + 11);
            if (t.sub) {
                doc.setTextColor(148, 163, 184); doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
                doc.text(fit(t.sub, tileW - 4), x + 3, y + 14.5);
            }
        });
        y += 18;
    };

    // Helper: línea de detalle "label: value"
    const detailLine = (entries: Array<{ label: string; value: string | number }>) => {
        pageBreakIfNeeded(6);
        const part = usableW / entries.length;
        entries.forEach((e, i) => {
            const x = marginX + i * part;
            doc.setTextColor(100, 116, 139); doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
            doc.text(`${e.label}: `, x, y);
            const lw = doc.getTextWidth(`${e.label}: `);
            doc.setTextColor(30, 41, 59); doc.setFont('helvetica', 'bold');
            doc.text(String(e.value), x + lw, y);
        });
        y += 5;
    };

    // ─── Censo y movimientos ─────────────────────────────────────────
    sectionHeader('CENSO Y MOVIMIENTOS');
    kpiRow([
        { label: 'En piso', value: d.censo.activeNow, sub: 'Residentes ACTIVE' },
        { label: 'En licencia', value: d.censo.leaveNow, sub: 'TEMPORARY_LEAVE' },
        { label: 'Admisiones', value: d.censo.admisiones, sub: 'Nuevos en período' },
        { label: 'Egresos', value: d.censo.egresos, sub: 'Discharged' },
        { label: 'Hospitalizaciones', value: d.censo.hospitalizaciones, sub: 'A hospital' },
    ]);

    // ─── Clínico ─────────────────────────────────────────────────────
    sectionHeader('CLÍNICO');
    kpiRow([
        { label: 'Cumplimiento meds', value: `${d.clinico.meds.compliancePct}%`, sub: `${d.clinico.meds.administered}/${d.clinico.meds.total} administrados` },
        { label: 'Vitales tomados', value: d.clinico.vitals.total, sub: `${d.clinico.vitals.critical} críticos` },
        { label: 'Rotaciones UPP', value: d.clinico.rotations, sub: 'Posturales' },
        { label: 'Observaciones HR', value:
            (d.clinico.incidents.OBSERVATION || 0) + (d.clinico.incidents.WARNING || 0) +
            (d.clinico.incidents.SUSPENSION || 0) + (d.clinico.incidents.TERMINATION || 0),
            sub: `OBS ${d.clinico.incidents.OBSERVATION || 0} · WARN ${d.clinico.incidents.WARNING || 0} · SUSP ${d.clinico.incidents.SUSPENSION || 0}` },
    ]);
    detailLine([
        { label: 'Omitidos', value: d.clinico.meds.omitted },
        { label: 'Rehusados', value: d.clinico.meds.refused },
        { label: 'En espera', value: d.clinico.meds.held },
        { label: 'Pendientes', value: d.clinico.meds.pending },
    ]);

    // ─── Operacional ─────────────────────────────────────────────────
    sectionHeader('OPERACIONAL');
    kpiRow([
        { label: 'Sesiones abiertas', value: d.operacional.sessionsOpened, sub: 'Clock-ins' },
        { label: 'Sesiones cerradas', value: d.operacional.sessionsClosed, sub: `${d.operacional.sessionsForcedClosed} forzadas` },
        { label: 'Ausencias', value: d.operacional.absences, sub: 'Marcadas isAbsent' },
        { label: 'Relevos firmados', value: d.operacional.handovers.completed, sub: `${d.operacional.handovers.completedPct}% completados` },
        { label: 'Redistribuciones', value: d.operacional.overridesCreated, sub: 'Overrides creados' },
    ]);

    // ─── Personal ────────────────────────────────────────────────────
    sectionHeader('PERSONAL');
    kpiRow([
        { label: 'Equipo activo', value: d.personal.totalStaff, sub: 'CAREGIVER/NURSE/SUP' },
        { label: 'Compliance promedio', value: `${d.personal.avgCompliance}`, sub: 'Score 0-100' },
        { label: 'Observaciones aplicadas', value:
            (d.personal.hrIncidents.OBSERVATION || 0) + (d.personal.hrIncidents.WARNING || 0) +
            (d.personal.hrIncidents.SUSPENSION || 0) + (d.personal.hrIncidents.TERMINATION || 0),
            sub: 'Aplicadas + pendientes' },
    ]);

    // Top / Bottom staff
    pageBreakIfNeeded(40);
    const halfW = (usableW - 4) / 2;
    const renderStaffList = (title: string, list: Array<{ name: string; role: string; score: number }>, x: number, color: [number, number, number]) => {
        doc.setFillColor(color[0], color[1], color[2]); doc.roundedRect(x, y, halfW, 5, 1, 1, 'F');
        doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
        doc.text(title, x + 2, y + 3.5);
        let ly = y + 9;
        if (list.length === 0) {
            doc.setTextColor(148, 163, 184); doc.setFont('helvetica', 'italic'); doc.setFontSize(8);
            doc.text('(sin datos)', x + 2, ly);
        }
        list.forEach(s => {
            doc.setTextColor(30, 41, 59); doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
            doc.text(fit(s.name, halfW - 12), x + 2, ly);
            doc.setTextColor(15, 110, 86); doc.setFont('helvetica', 'bold');
            doc.text(String(s.score), x + halfW - 8, ly);
            ly += 5;
        });
    };
    renderStaffList('TOP PERFORMERS', d.personal.topStaff, marginX, [16, 185, 129]);
    renderStaffList('A SEGUIR', d.personal.bottomStaff, marginX + halfW + 4, [239, 68, 68]);
    y += 9 + Math.max(d.personal.topStaff.length, d.personal.bottomStaff.length, 1) * 5 + 4;

    // ─── Footer ──────────────────────────────────────────────────────
    pageBreakIfNeeded(10);
    doc.setDrawColor(226, 232, 240); doc.line(marginX, pageH - 14, pageW - marginX, pageH - 14);
    doc.setTextColor(148, 163, 184); doc.setFont('helvetica', 'italic'); doc.setFontSize(7);
    doc.text(`Generado por Zéndity — app.zendity.com   ·   Documento operativo confidencial   ·   ${d.hqName}`, marginX, pageH - 10);

    const periodSlug = d.period === 'day' ? 'Dia' : d.period === 'week' ? 'Semana' : 'Mes';
    const fileDate = new Date().toISOString().slice(0, 10);
    doc.save(`Resumen_Ejecutivo_${periodSlug}_${d.hqName.replace(/[^a-zA-Z0-9]/g, '_')}_${fileDate}.pdf`);
}
