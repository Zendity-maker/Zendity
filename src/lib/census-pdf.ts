import jsPDF from 'jspdf';

export type CensusRow = {
    name: string;
    roomNumber: string;
    dateOfBirth: string | null;
    colorGroup: string;
    insurancePlanName: string | null;
    insurancePolicyNumber: string | null;
    medicareNumber: string | null;
    diet: string | null;
    status: string;
    leaveType: string | null;
};

export type CensusMeta = {
    hqName: string;
    total: number;
    activeCount: number;
    leaveCount: number;
    census: CensusRow[];
};

const COLOR_HEX: Record<string, [number, number, number]> = {
    RED: [239, 68, 68], YELLOW: [245, 158, 11], BLUE: [59, 130, 246],
    GREEN: [16, 185, 129], ALL: [100, 116, 139], UNASSIGNED: [203, 213, 225],
};
const COLOR_LABEL: Record<string, string> = {
    RED: 'Rojo', YELLOW: 'Amarillo', BLUE: 'Azul', GREEN: 'Verde', ALL: 'Todos', UNASSIGNED: 'Sin grupo',
};

function fmtDOB(iso: string | null): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${d.getUTCFullYear()}`;
}

/**
 * Genera y descarga el PDF del censo de residentes (1-clic) desde el navegador.
 * Tabla landscape con: # · Hab · Residente · Fecha Nac · Grupo (chip de color) ·
 * Plan Médico (+# póliza) · Medicare # · Alimentación · Estado.
 */
export function generateCensusPDF(meta: CensusMeta): void {
    const { hqName, total, activeCount, leaveCount, census } = meta;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });
    const pageH = doc.internal.pageSize.getHeight();
    const marginX = 10;

    const cols = [
        { label: '#', w: 8 },
        { label: 'Hab.', w: 14 },
        { label: 'Residente', w: 50 },
        { label: 'Fecha Nac.', w: 22 },
        { label: 'Grupo', w: 24 },
        { label: 'Plan Médico (# póliza)', w: 62 },
        { label: 'Medicare #', w: 30 },
        { label: 'Alimentación', w: 30 },
        { label: 'Estado', w: 18 },
    ];
    const colX: number[] = [];
    let cx = marginX;
    cols.forEach(c => { colX.push(cx); cx += c.w; });
    const tableRight = cx;

    // Trunca un texto para que quepa en `w` mm (margen interno ~3mm).
    const fit = (s: string, w: number): string => {
        if (!s) return '';
        if (doc.getTextWidth(s) <= w - 3) return s;
        let t = s;
        while (t.length > 1 && doc.getTextWidth(t + '…') > w - 3) t = t.slice(0, -1);
        return t + '…';
    };

    let y = 14;

    const drawHeader = () => {
        doc.setTextColor(15, 110, 86); doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
        doc.text('ZÉNDITY', marginX, y);
        doc.setTextColor(100, 116, 139); doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
        doc.text(`${hqName} — Censo de Residentes`, marginX, y + 5);
        const today = new Date().toLocaleDateString('es-PR', { timeZone: 'America/Puerto_Rico', day: '2-digit', month: 'long', year: 'numeric' });
        doc.text(`Fecha: ${today}   ·   Total: ${total} (${activeCount} en piso · ${leaveCount} en hospital)`, marginX, y + 10);
        y += 16;
    };

    const drawTableHead = () => {
        doc.setFillColor(241, 245, 249); doc.rect(marginX, y - 4, tableRight - marginX, 7, 'F');
        doc.setTextColor(51, 65, 85); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
        cols.forEach((c, i) => doc.text(c.label, colX[i] + 1.5, y));
        y += 5;
    };

    drawHeader();
    drawTableHead();
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(30, 41, 59);

    const rowH = 6;
    census.forEach((p, idx) => {
        if (y > pageH - 12) {
            doc.addPage();
            y = 14;
            drawTableHead();
            doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(30, 41, 59);
        }
        const onLeave = p.status === 'TEMPORARY_LEAVE';
        if (onLeave) { doc.setFillColor(255, 247, 237); doc.rect(marginX, y - 4, tableRight - marginX, rowH, 'F'); }

        doc.setTextColor(148, 163, 184); doc.text(String(idx + 1), colX[0] + 1.5, y);
        doc.setTextColor(30, 41, 59); doc.setFont('helvetica', 'bold'); doc.text(fit(p.roomNumber, cols[1].w), colX[1] + 1.5, y);
        doc.setFont('helvetica', 'normal'); doc.text(fit(p.name, cols[2].w), colX[2] + 1.5, y);
        doc.text(fmtDOB(p.dateOfBirth), colX[3] + 1.5, y);

        const rgb = COLOR_HEX[p.colorGroup] || COLOR_HEX.UNASSIGNED;
        doc.setFillColor(rgb[0], rgb[1], rgb[2]);
        doc.roundedRect(colX[4] + 1.5, y - 3, 3, 3, 0.5, 0.5, 'F');
        doc.text(fit(COLOR_LABEL[p.colorGroup] || p.colorGroup, cols[4].w - 5), colX[4] + 6, y);

        const plan = p.insurancePlanName
            ? p.insurancePlanName + (p.insurancePolicyNumber ? ` · ${p.insurancePolicyNumber}` : '')
            : '—';
        doc.text(fit(plan, cols[5].w), colX[5] + 1.5, y);
        doc.text(fit(p.medicareNumber || '—', cols[6].w), colX[6] + 1.5, y);
        doc.text(fit(p.diet || '—', cols[7].w), colX[7] + 1.5, y);

        if (onLeave) { doc.setTextColor(154, 52, 18); doc.text('Hospital', colX[8] + 1.5, y); }
        else { doc.setTextColor(100, 116, 139); doc.text('En piso', colX[8] + 1.5, y); }
        doc.setTextColor(30, 41, 59);

        doc.setDrawColor(238, 242, 246); doc.line(marginX, y + 1.5, tableRight, y + 1.5);
        y += rowH;
    });

    const fileDate = new Date().toISOString().slice(0, 10);
    doc.save(`Censo_${hqName.replace(/[^a-zA-Z0-9]/g, '_')}_${fileDate}.pdf`);
}
