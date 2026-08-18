import jsPDF from 'jspdf';

/**
 * Paquete de Continuidad Operativa — se entrega cuando Zendity suspende una
 * sede por facturación.
 *
 * Razón de existir: la suspensión corta el sistema y la operación continúa en
 * papel. Pero documentar en papel exige SABER qué administrar — 250+
 * medicamentos con horario, alergias y cuidados especiales no están en la
 * cabeza de nadie. Sin este paquete, "manual" significa de memoria, y ahí
 * ocurre el error de medicación con una persona vulnerable.
 *
 * No es una lista: es el juego de documentos con el que un hogar opera una
 * semana sin sistema —referencia clínica, MAR firmable y hojas de registro—
 * y con el que después puede transcribir todo de vuelta.
 *
 * Corta el servicio, no el cuidado.
 */

export type ContinuityMed = { name: string; dosage: string; times: string[]; instructions?: string | null };
export type ContinuityResident = {
    name: string;
    roomNumber: string | null;
    allergies: string | null;
    diet: string | null;
    meds: ContinuityMed[];
    alerts: string[];
};
export type ContinuityMeta = {
    hqName: string;
    generatedAt: Date;
    residents: ContinuityResident[];
};

// ── Paleta de marca ───────────────────────────────────────────────────
const TEAL: [number, number, number] = [15, 110, 86];
const TEAL_LT: [number, number, number] = [29, 158, 117];
const INK: [number, number, number] = [31, 45, 58];
const MUTED: [number, number, number] = [100, 116, 139];
const LINE: [number, number, number] = [226, 232, 240];
const ZEBRA: [number, number, number] = [248, 250, 252];
const DANGER: [number, number, number] = [190, 18, 60];
const DANGER_BG: [number, number, number] = [254, 226, 226];
const WARN: [number, number, number] = [180, 83, 9];
const WARN_BG: [number, number, number] = [254, 243, 199];

const M = 12;
const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export function generateContinuityPDF(meta: ContinuityMeta): ArrayBuffer {
    const doc = new jsPDF({ unit: 'mm', format: 'letter' });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();

    const fecha = meta.generatedAt.toLocaleString('es-PR', {
        dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Puerto_Rico',
    });
    const totalMeds = meta.residents.reduce((s, r) => s + r.meds.length, 0);
    const conAlergia = meta.residents.filter(r => r.allergies).length;
    const conCuidados = meta.residents.filter(r => r.alerts.length > 0).length;

    // ══ Utilidades de dibujo ═══════════════════════════════════════════
    const setFill = (c: [number, number, number]) => doc.setFillColor(c[0], c[1], c[2]);
    const setText = (c: [number, number, number]) => doc.setTextColor(c[0], c[1], c[2]);
    const setDraw = (c: [number, number, number]) => doc.setDrawColor(c[0], c[1], c[2]);

    /** Encabezado de sección — se repite en cada página nueva. */
    function pageHeader(titulo: string, subtitulo?: string) {
        setFill(TEAL);
        doc.rect(0, 0, W, 17, 'F');
        setText([255, 255, 255]);
        doc.setFont('helvetica', 'bold').setFontSize(11);
        doc.text(titulo, M, 8);
        doc.setFont('helvetica', 'normal').setFontSize(7.5);
        doc.text(meta.hqName, M, 13);
        if (subtitulo) doc.text(subtitulo, W - M, 13, { align: 'right' });
        doc.text('CONTINUIDAD OPERATIVA', W - M, 8, { align: 'right' });
        return 24;
    }

    // ══ PÁGINA 1 — Portada e instrucciones ═════════════════════════════
    setFill(TEAL);
    doc.rect(0, 0, W, 62, 'F');
    setFill(TEAL_LT);
    doc.rect(0, 58, W, 4, 'F');

    setText([255, 255, 255]);
    doc.setFont('helvetica', 'bold').setFontSize(26);
    doc.text('Paquete de', M, 26);
    doc.text('Continuidad Operativa', M, 37);
    doc.setFont('helvetica', 'normal').setFontSize(11);
    doc.text(meta.hqName, M, 48);
    doc.setFontSize(8);
    doc.text(`Generado ${fecha}`, W - M, 48, { align: 'right' });

    let y = 74;

    // Aviso principal
    setFill(WARN_BG); setDraw(WARN);
    doc.setLineWidth(0.4);
    doc.roundedRect(M, y, W - M * 2, 24, 2, 2, 'FD');
    setText(WARN);
    doc.setFont('helvetica', 'bold').setFontSize(10);
    doc.text('El acceso a Zendity está suspendido por un asunto de facturación.', M + 5, y + 8);
    doc.setFont('helvetica', 'normal').setFontSize(8.5);
    doc.text('La operación del hogar NO se detiene. Continúen con estos documentos hasta que se restablezca.', M + 5, y + 14.5);
    doc.text('Todo lo registrado en papel deberá transcribirse al sistema al reactivarse el servicio.', M + 5, y + 20);
    y += 34;

    // Resumen en tarjetas
    const cards = [
        { n: String(meta.residents.length), l: 'Residentes' },
        { n: String(totalMeds), l: 'Medicamentos activos' },
        { n: String(conAlergia), l: 'Con alergias' },
        { n: String(conCuidados), l: 'Cuidados especiales' },
    ];
    const cw = (W - M * 2 - 9) / 4;
    cards.forEach((c, i) => {
        const x = M + i * (cw + 3);
        setFill(ZEBRA); setDraw(LINE);
        doc.setLineWidth(0.3);
        doc.roundedRect(x, y, cw, 20, 2, 2, 'FD');
        setText(TEAL);
        doc.setFont('helvetica', 'bold').setFontSize(16);
        doc.text(c.n, x + cw / 2, y + 9, { align: 'center' });
        setText(MUTED);
        doc.setFont('helvetica', 'normal').setFontSize(6.5);
        doc.text(c.l.toUpperCase(), x + cw / 2, y + 15.5, { align: 'center' });
    });
    y += 30;

    // Contenido del paquete
    setText(INK);
    doc.setFont('helvetica', 'bold').setFontSize(11);
    doc.text('Qué contiene este paquete', M, y);
    y += 7;
    const secciones = [
        ['1. Censo maestro', 'Todos los residentes con habitación, alergias, dieta y cuidados. Vista rápida para el cambio de turno.'],
        ['2. Ficha y MAR por residente', 'Una hoja por residente: sus datos clínicos y el registro de administración de medicamentos, con casilla por día y horario para inicialar.'],
        ['3. Registro diario de turno', 'Baños, comidas y cambios posturales. Fotocopiar una por turno.'],
        ['4. Signos vitales', 'Hoja de registro. Fotocopiar según necesidad.'],
        ['5. Reporte de incidente', 'Para caídas u otros eventos. Fotocopiar según necesidad.'],
    ];
    secciones.forEach(([t, d]) => {
        setText(TEAL);
        doc.setFont('helvetica', 'bold').setFontSize(8.5);
        doc.text(t, M + 2, y);
        setText(MUTED);
        doc.setFont('helvetica', 'normal').setFontSize(7.5);
        const lines = doc.splitTextToSize(d, W - M * 2 - 6);
        doc.text(lines, M + 2, y + 4);
        y += 4 + lines.length * 3.6 + 3.5;
    });

    y += 4;
    setFill(DANGER_BG); setDraw(DANGER);
    doc.setLineWidth(0.4);
    doc.roundedRect(M, y, W - M * 2, 17, 2, 2, 'FD');
    setText(DANGER);
    doc.setFont('helvetica', 'bold').setFontSize(8.5);
    doc.text('Antes de administrar cualquier medicamento, verifique la banda de ALERGIAS del residente.', M + 5, y + 7);
    doc.setFont('helvetica', 'normal').setFontSize(7.5);
    doc.text('Este documento contiene información clínica protegida (PHI). Manéjese conforme a HIPAA.', M + 5, y + 12.5);

    // ══ SECCIÓN 1 — Censo maestro ══════════════════════════════════════
    doc.addPage();
    y = pageHeader('Censo Maestro', `${meta.residents.length} residentes`);

    const cols = [
        { t: 'Hab.', w: 14 },
        { t: 'Residente', w: 52 },
        { t: 'Alergias', w: 46 },
        { t: 'Dieta', w: 32 },
        { t: 'Cuidados especiales', w: W - M * 2 - 144 },
    ];
    const drawCensoHead = () => {
        setFill(INK);
        doc.rect(M, y, W - M * 2, 7, 'F');
        setText([255, 255, 255]);
        doc.setFont('helvetica', 'bold').setFontSize(7);
        let x = M + 2;
        cols.forEach(c => { doc.text(c.t.toUpperCase(), x, y + 4.7); x += c.w; });
        y += 7;
    };
    drawCensoHead();

    doc.setFont('helvetica', 'normal').setFontSize(7);
    meta.residents.forEach((r, i) => {
        const cuidados = r.alerts.join(' · ') || '—';
        const cuidadoLines = doc.splitTextToSize(cuidados, cols[4].w - 3);
        const alergiaLines = doc.splitTextToSize(r.allergies || '—', cols[2].w - 3);
        const rowH = Math.max(6.5, cuidadoLines.length * 3.3 + 3, alergiaLines.length * 3.3 + 3);

        if (y + rowH > H - 16) { doc.addPage(); y = pageHeader('Censo Maestro', 'continuación'); drawCensoHead(); doc.setFont('helvetica', 'normal').setFontSize(7); }

        if (i % 2 === 0) { setFill(ZEBRA); doc.rect(M, y, W - M * 2, rowH, 'F'); }

        let x = M + 2;
        setText(INK);
        doc.setFont('helvetica', 'bold');
        doc.text(r.roomNumber || '—', x, y + 4.4); x += cols[0].w;
        doc.text(r.name.length > 30 ? r.name.slice(0, 29) + '…' : r.name, x, y + 4.4); x += cols[1].w;
        // Alergias resaltadas: es el dato que evita el daño más grave.
        if (r.allergies) setText(DANGER); else { setText(MUTED); doc.setFont('helvetica', 'normal'); }
        doc.text(alergiaLines, x, y + 4.4); x += cols[2].w;
        setText(MUTED); doc.setFont('helvetica', 'normal');
        doc.text(doc.splitTextToSize(r.diet || '—', cols[3].w - 3), x, y + 4.4); x += cols[3].w;
        doc.text(cuidadoLines, x, y + 4.4);

        y += rowH;
        setDraw(LINE); doc.setLineWidth(0.15);
        doc.line(M, y, W - M, y);
    });

    // ══ SECCIÓN 2 — Ficha + MAR por residente ══════════════════════════
    for (const r of meta.residents) {
        doc.addPage();
        y = pageHeader('Ficha y Registro de Medicamentos', `Hab. ${r.roomNumber || '—'}`);

        // Nombre
        setText(INK);
        doc.setFont('helvetica', 'bold').setFontSize(16);
        doc.text(r.name, M, y + 2);
        y += 9;

        // Banda de alergias — siempre presente, para que su ausencia también informe
        if (r.allergies) {
            setFill(DANGER_BG); setDraw(DANGER); doc.setLineWidth(0.5);
            doc.roundedRect(M, y, W - M * 2, 13, 1.5, 1.5, 'FD');
            setText(DANGER);
            doc.setFont('helvetica', 'bold').setFontSize(9);
            doc.text('ALERGIAS', M + 4, y + 5.5);
            doc.setFont('helvetica', 'normal').setFontSize(8.5);
            doc.text(doc.splitTextToSize(r.allergies, W - M * 2 - 30), M + 26, y + 5.5);
        } else {
            setFill(ZEBRA); setDraw(LINE); doc.setLineWidth(0.3);
            doc.roundedRect(M, y, W - M * 2, 13, 1.5, 1.5, 'FD');
            setText(MUTED);
            doc.setFont('helvetica', 'bold').setFontSize(9);
            doc.text('ALERGIAS', M + 4, y + 5.5);
            doc.setFont('helvetica', 'normal').setFontSize(8.5);
            doc.text('Ninguna registrada — verificar con la familia antes de administrar.', M + 26, y + 5.5);
        }
        y += 17;

        // Cuidados y dieta
        const info: [string, string][] = [
            ['Dieta', r.diet || 'Sin indicación especial'],
            ['Cuidados', r.alerts.length ? r.alerts.join(' · ') : 'Sin cuidados especiales registrados'],
        ];
        info.forEach(([k, v]) => {
            setText(TEAL);
            doc.setFont('helvetica', 'bold').setFontSize(7.5);
            doc.text(k.toUpperCase(), M, y);
            setText(INK);
            doc.setFont('helvetica', 'normal').setFontSize(8);
            const lines = doc.splitTextToSize(v, W - M * 2 - 24);
            doc.text(lines, M + 22, y);
            y += Math.max(5, lines.length * 3.8 + 1.5);
        });
        y += 3;

        // ── MAR semanal ────────────────────────────────────────────────
        setText(INK);
        doc.setFont('helvetica', 'bold').setFontSize(10);
        doc.text('Registro de Administración (MAR)', M, y);
        setText(MUTED);
        doc.setFont('helvetica', 'normal').setFontSize(7);
        doc.text('Inicial + hora en cada casilla al administrar', W - M, y, { align: 'right' });
        y += 4;

        const cMed = 60, cHora = 22;
        const cDia = (W - M * 2 - cMed - cHora) / 7;

        setFill(INK);
        doc.rect(M, y, W - M * 2, 7, 'F');
        setText([255, 255, 255]);
        doc.setFont('helvetica', 'bold').setFontSize(6.5);
        doc.text('MEDICAMENTO', M + 2, y + 4.6);
        doc.text('HORARIO', M + cMed + 2, y + 4.6);
        DIAS.forEach((d, i) => doc.text(d, M + cMed + cHora + cDia * i + cDia / 2, y + 4.6, { align: 'center' }));
        y += 7;

        if (r.meds.length === 0) {
            setFill(ZEBRA); doc.rect(M, y, W - M * 2, 10, 'F');
            setText(MUTED);
            doc.setFont('helvetica', 'italic').setFontSize(8);
            doc.text('Sin medicamentos activos registrados.', W / 2, y + 6.3, { align: 'center' });
            y += 10;
        } else {
            r.meds.forEach((m, i) => {
                // Una fila por horario: cada toma se firma por separado, como
                // en un MAR real.
                const horarios = m.times.length ? m.times : ['—'];
                horarios.forEach((h, hi) => {
                    const rowH = 8;
                    if (y + rowH > H - 16) {
                        doc.addPage();
                        y = pageHeader('Registro de Administración (cont.)', `${r.name} · Hab. ${r.roomNumber || '—'}`);
                        setFill(INK); doc.rect(M, y, W - M * 2, 7, 'F');
                        setText([255, 255, 255]); doc.setFont('helvetica', 'bold').setFontSize(6.5);
                        doc.text('MEDICAMENTO', M + 2, y + 4.6);
                        doc.text('HORARIO', M + cMed + 2, y + 4.6);
                        DIAS.forEach((d, di) => doc.text(d, M + cMed + cHora + cDia * di + cDia / 2, y + 4.6, { align: 'center' }));
                        y += 7;
                    }
                    if ((i + hi) % 2 === 0) { setFill(ZEBRA); doc.rect(M, y, W - M * 2, rowH, 'F'); }

                    setText(INK);
                    doc.setFont('helvetica', hi === 0 ? 'bold' : 'normal').setFontSize(7);
                    const label = hi === 0 ? `${m.name} ${m.dosage}` : '';
                    doc.text(doc.splitTextToSize(label, cMed - 4), M + 2, y + 5);
                    setText(TEAL);
                    doc.setFont('helvetica', 'bold').setFontSize(7.5);
                    doc.text(h, M + cMed + 2, y + 5);

                    // Casillas firmables
                    setDraw(LINE); doc.setLineWidth(0.25);
                    for (let d = 0; d < 7; d++) {
                        doc.rect(M + cMed + cHora + cDia * d + 1, y + 1.2, cDia - 2, rowH - 2.4, 'S');
                    }
                    y += rowH;
                });
                if (m.instructions) {
                    setText(MUTED);
                    doc.setFont('helvetica', 'italic').setFontSize(6.5);
                    doc.text(`↳ ${m.instructions}`, M + 4, y + 3);
                    y += 5;
                }
            });
        }

        // Notas del turno
        y += 4;
        if (y < H - 40) {
            setText(TEAL);
            doc.setFont('helvetica', 'bold').setFontSize(7.5);
            doc.text('NOTAS / OBSERVACIONES', M, y);
            y += 3;
            setDraw(LINE); doc.setLineWidth(0.2);
            while (y < H - 18) { doc.line(M, y + 5, W - M, y + 5); y += 7; }
        }
    }

    // ══ SECCIÓN 3-5 — Plantillas de registro ═══════════════════════════
    plantillaTurno(doc, W, H, pageHeader);
    plantillaVitales(doc, W, H, pageHeader);
    plantillaIncidente(doc, W, H, pageHeader);

    // ══ Pie en todas las páginas ═══════════════════════════════════════
    // jsPDF v2: internal.pages es la fuente canónica del conteo.
    const pages = (doc.internal as any).pages?.length - 1 || 1;
    for (let i = 1; i <= pages; i++) {
        doc.setPage(i);
        setDraw(LINE); doc.setLineWidth(0.3);
        doc.line(M, H - 11, W - M, H - 11);
        doc.setFont('helvetica', 'normal').setFontSize(6.5);
        setText(MUTED);
        doc.text(`${meta.hqName} · Continuidad operativa · Información clínica protegida (PHI) — HIPAA`, M, H - 7);
        doc.text(`${i} / ${pages}`, W - M, H - 7, { align: 'right' });
    }

    return doc.output('arraybuffer');
}

// ── Plantillas en blanco ──────────────────────────────────────────────

type HeaderFn = (t: string, s?: string) => number;

function campoFecha(doc: jsPDF, W: number, y: number): number {
    doc.setDrawColor(LINE[0], LINE[1], LINE[2]); doc.setLineWidth(0.3);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.setFont('helvetica', 'bold').setFontSize(7.5);
    doc.text('FECHA', M, y);
    doc.line(M + 14, y + 0.8, M + 60, y + 0.8);
    doc.text('TURNO', M + 68, y);
    doc.line(M + 83, y + 0.8, M + 120, y + 0.8);
    doc.text('RESPONSABLE', M + 128, y);
    doc.line(M + 158, y + 0.8, W - M, y + 0.8);
    return y + 9;
}

/** Tabla en blanco genérica: encabezados + N filas para escribir a mano. */
function tablaBlanco(doc: jsPDF, W: number, H: number, y: number, headers: { t: string; w: number }[], filas: number): number {
    doc.setFillColor(INK[0], INK[1], INK[2]);
    doc.rect(M, y, W - M * 2, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold').setFontSize(6.5);
    let x = M + 2;
    headers.forEach(h => { doc.text(h.t.toUpperCase(), x, y + 4.6); x += h.w; });
    y += 7;

    doc.setDrawColor(LINE[0], LINE[1], LINE[2]); doc.setLineWidth(0.25);
    for (let f = 0; f < filas; f++) {
        if (y > H - 20) break;
        if (f % 2 === 0) { doc.setFillColor(ZEBRA[0], ZEBRA[1], ZEBRA[2]); doc.rect(M, y, W - M * 2, 8, 'F'); }
        let cx = M;
        headers.forEach(h => { doc.line(cx, y, cx, y + 8); cx += h.w; });
        doc.line(W - M, y, W - M, y + 8);
        doc.line(M, y + 8, W - M, y + 8);
        y += 8;
    }
    return y;
}

function plantillaTurno(doc: jsPDF, W: number, H: number, header: HeaderFn) {
    doc.addPage();
    let y = header('Registro Diario de Turno', 'Fotocopiar una por turno');
    y = campoFecha(doc, W, y);
    const wRes = 46, rest = (W - M * 2 - wRes) / 5;
    y = tablaBlanco(doc, W, H, y, [
        { t: 'Residente', w: wRes },
        { t: 'Desayuno', w: rest },
        { t: 'Almuerzo', w: rest },
        { t: 'Cena', w: rest },
        { t: 'Baño', w: rest },
        { t: 'Cambios posturales (horas)', w: rest },
    ], 26);
}

function plantillaVitales(doc: jsPDF, W: number, H: number, header: HeaderFn) {
    doc.addPage();
    let y = header('Registro de Signos Vitales', 'Fotocopiar según necesidad');
    y = campoFecha(doc, W, y);
    const wRes = 44, rest = (W - M * 2 - wRes) / 7;
    y = tablaBlanco(doc, W, H, y, [
        { t: 'Residente', w: wRes },
        { t: 'Hora', w: rest },
        { t: 'Temp.', w: rest },
        { t: 'P/A', w: rest },
        { t: 'FC', w: rest },
        { t: 'Sat. O2', w: rest },
        { t: 'Glucosa', w: rest },
        { t: 'Inicial', w: rest },
    ], 26);
}

function plantillaIncidente(doc: jsPDF, W: number, H: number, header: HeaderFn) {
    doc.addPage();
    let y = header('Reporte de Incidente', 'Una hoja por evento');
    y = campoFecha(doc, W, y);

    const bloques: [string, number][] = [
        ['Residente involucrado', 1],
        ['Lugar y hora del incidente', 1],
        ['Descripción de lo ocurrido', 5],
        ['Estado del residente / lesiones observadas', 3],
        ['Acciones tomadas', 3],
        ['Notificaciones (familia, médico, supervisor) — nombre, hora y medio', 3],
    ];
    doc.setLineWidth(0.25);
    bloques.forEach(([t, lineas]) => {
        if (y > H - 30) { doc.addPage(); y = header('Reporte de Incidente', 'continuación'); }
        doc.setTextColor(TEAL[0], TEAL[1], TEAL[2]);
        doc.setFont('helvetica', 'bold').setFontSize(7.5);
        doc.text(t.toUpperCase(), M, y);
        y += 3;
        doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
        for (let i = 0; i < lineas; i++) { doc.line(M, y + 5, W - M, y + 5); y += 7; }
        y += 3;
    });

    // Firmas
    y = Math.min(y + 6, H - 30);
    doc.setDrawColor(MUTED[0], MUTED[1], MUTED[2]); doc.setLineWidth(0.4);
    const half = (W - M * 2 - 10) / 2;
    doc.line(M, y, M + half, y);
    doc.line(M + half + 10, y, W - M, y);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.setFont('helvetica', 'normal').setFontSize(7);
    doc.text('Reportado por (nombre y firma)', M, y + 4);
    doc.text('Supervisor / Director (nombre y firma)', M + half + 10, y + 4);
}
