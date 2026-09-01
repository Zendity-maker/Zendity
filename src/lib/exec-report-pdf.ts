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
        /** Formación continua: cuántos del equipo van al día con su meta de cursos. */
        formacionAlDiaPct: number | null;
    };
    /**
     * Lo que el hogar mira de sí mismo hacia fuera.
     *
     * Todo lo demás en este informe cuenta ACTIVIDAD — lo que el hogar hizo.
     * Esto cuenta PERCEPCIÓN y COMUNICACIÓN: lo que la familia siente y lo que
     * el hogar le contó. Un resumen ejecutivo sin esto describe una operación,
     * no un servicio.
     */
    familias: {
        /** Promedio 1-5 del trimestre. Nulo si nadie ha respondido. */
        satisfaccion: number | null;
        encuestasRespondidas: number;
        encuestasEnviadas: number;
        /** Residentes cuya familia recibió una actualización clínica en el periodo. */
        actualizadas: number;
        /** Residentes con familia registrada — el denominador honesto. */
        conFamilia: number;
    };
    /**
     * Cierre del mes. Nulo salvo en el periodo mensual: en la vista de día o
     * semana, un gasto mensual contra siete días de actividad da un margen
     * absurdo que nadie detecta hasta decidir algo con él.
     */
    cierre?: {
        mes: string;
        facturado: number;
        cobrado: number;
        pendiente: number;
        vencido: number;
        gastos: { categoria: string; monto: number }[];
        totalGastos: number;
        margen: number;
    } | null;
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
    // Fix (jul-2026): la barra teal se dibuja en `y - 4` (retrocede 4mm). El
    // kpiRow previo solo dejaba 2mm de margen, así que la barra de la sección
    // siguiente caía sobre los sub-textos de los KPIs anteriores ("Residentes
    // ACTIVE", etc.) — se veían como franjas tapando palabras. Se añade padding
    // superior (y += 5) y se reserva más alto en el salto de página.
    const sectionHeader = (title: string) => {
        pageBreakIfNeeded(17);
        y += 5;
        doc.setFillColor(15, 110, 86); doc.rect(marginX, y - 4, usableW, 6, 'F');
        doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
        doc.text(title, marginX + 2, y);
        y += 6;
    };

    // Helper: KPI tile row (n tiles)
    const kpiRow = (tiles: Array<{ label: string; value: string | number; sub?: string }>) => {
        pageBreakIfNeeded(20);
        const tileW = (usableW - (tiles.length - 1) * 3) / tiles.length;

        /**
         * La etiqueta se PARTE en hasta dos lineas; antes se dibujaba de una
         * pieza sin ajustar al ancho, asi que una etiqueta larga se salia de su
         * tarjeta y se metia en la de al lado. El subtitulo si usaba fit(); la
         * etiqueta no.
         *
         * Se parte en vez de truncar porque el nombre completo es el punto:
         * "Satisfaccion por encuesta directa a los familiares" dice de donde
         * sale el numero, y cortado a "Satisfaccion por encue..." no dice nada.
         *
         * La altura de TODAS las tarjetas de la fila se iguala a la que mas
         * lineas necesite, para que la fila no quede escalonada.
         */
        doc.setFont('helvetica', 'bold'); doc.setFontSize(7);
        const lineas = tiles.map(t => doc.splitTextToSize(t.label.toUpperCase(), tileW - 6).slice(0, 2) as string[]);
        const maxLineas = Math.max(...lineas.map(l => l.length));
        const alto = 16 + (maxLineas - 1) * 3;

        tiles.forEach((t, i) => {
            const x = marginX + i * (tileW + 3);
            doc.setFillColor(248, 250, 252); doc.roundedRect(x, y, tileW, alto, 1.5, 1.5, 'F');
            doc.setDrawColor(226, 232, 240); doc.roundedRect(x, y, tileW, alto, 1.5, 1.5, 'S');
            doc.setTextColor(100, 116, 139); doc.setFont('helvetica', 'bold'); doc.setFontSize(7);
            lineas[i].forEach((ln, k) => doc.text(ln, x + 3, y + 4.5 + k * 3));
            const yValor = y + 11 + (maxLineas - 1) * 3;
            doc.setTextColor(15, 110, 86); doc.setFontSize(14);
            doc.text(String(t.value), x + 3, yValor);
            if (t.sub) {
                doc.setTextColor(148, 163, 184); doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
                doc.text(fit(t.sub, tileW - 4), x + 3, yValor + 3.5);
            }
        });
        y += alto + 2;
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
        // 'Cumplimiento meds' salia aqui, en primera posicion y siempre al 100%.
        // Medido el 26-ago-2026: 22.211 administrados contra 1 omitido — es
        // administrados dividido entre administrados. Un 100% que no puede bajar
        // no informa, decora. Baja a la linea de detalle, con sus numeros
        // crudos al lado para que se pueda juzgar.
        { label: 'Vitales tomados', value: d.clinico.vitals.total, sub: `${d.clinico.vitals.critical} críticos` },
        { label: 'Rotaciones UPP', value: d.clinico.rotations, sub: 'Posturales' },
        { label: 'Observaciones HR', value:
            (d.clinico.incidents.OBSERVATION || 0) + (d.clinico.incidents.WARNING || 0) +
            (d.clinico.incidents.SUSPENSION || 0) + (d.clinico.incidents.TERMINATION || 0),
            sub: `OBS ${d.clinico.incidents.OBSERVATION || 0} · WARN ${d.clinico.incidents.WARNING || 0} · SUSP ${d.clinico.incidents.SUSPENSION || 0}` },
    ]);
    detailLine([
        { label: 'Meds administrados', value: d.clinico.meds.administered },
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
        // La formacion no estaba en ningun resumen. Un hogar cuyo personal se
        // forma es distinto de uno que no, y ese dato no salia por ninguna
        // parte — el complianceScore no lo refleja: las dos personas con score
        // 100 tenian CERO cursos.
        { label: 'Formaciones en Zéndity Academy', value: d.personal.formacionAlDiaPct == null ? '—' : `${d.personal.formacionAlDiaPct}%`, sub: 'Al día · meta 1 curso/mes' },
        { label: 'Observaciones aplicadas', value:
            (d.personal.hrIncidents.OBSERVATION || 0) + (d.personal.hrIncidents.WARNING || 0) +
            (d.personal.hrIncidents.SUSPENSION || 0) + (d.personal.hrIncidents.TERMINATION || 0),
            sub: 'Aplicadas + pendientes' },
    ]);

    // ─── Familias ────────────────────────────────────────────────────
    // Todo lo anterior cuenta ACTIVIDAD: lo que el hogar hizo. Esta seccion
    // cuenta PERCEPCION y COMUNICACION — lo que la familia siente y lo que se
    // le contó. Un resumen ejecutivo sin esto describe una operacion, no un
    // servicio.
    pageBreakIfNeeded(30);
    sectionHeader('FAMILIAS');
    kpiRow([
        {
            label: 'Satisfacción por encuesta directa a los familiares',
            value: d.familias.satisfaccion == null ? '—' : `${d.familias.satisfaccion}/5`,
            // La tasa de respuesta va SIEMPRE al lado del promedio. Un 4.8 de
            // dos respuestas sobre diecinueve no dice nada del hogar; dice que
            // diecisiete no contestaron, y esa es la noticia.
            sub: `${d.familias.encuestasRespondidas}/${d.familias.encuestasEnviadas} respondieron`,
        },
        {
            label: 'Familias informadas',
            value: d.familias.conFamilia === 0 ? '—' : `${d.familias.actualizadas}/${d.familias.conFamilia}`,
            sub: 'Actualización clínica en el periodo',
        },
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

    /**
     * ─── Cierre del mes ──────────────────────────────────────────────
     *
     * Va AL FINAL, y es deliberado. Si el dinero abre el documento, el resumen
     * deja de ser de operación y pasa a ser un estado de resultados con notas
     * clínicas pegadas. Un director lee primero cómo se cuidó y después cómo
     * cerró el mes; invertir ese orden cambia lo que el documento es.
     *
     * Solo en el periodo mensual: ver la nota del tipo.
     */
    if (d.cierre) {
        const c = d.cierre;
        const money = (n: number) =>
            `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

        pageBreakIfNeeded(60);
        sectionHeader(`CIERRE DE ${c.mes.toUpperCase()} — MES COMPLETO`);

        kpiRow([
            { label: 'Ingreso comercial', value: money(c.facturado), sub: 'Facturado en el mes' },
            { label: 'Gastos operativos', value: money(c.totalGastos), sub: `${c.gastos.length} categorías` },
            {
                label: 'Margen',
                value: money(c.margen),
                // Se dice si el margen esta COMPLETO. Con 36% de lo facturado
                // sin cobrar, un margen positivo puede no haber entrado todavia
                // — y eso decide si se puede gastar o no.
                sub: c.facturado > 0
                    ? `${Math.round((c.cobrado / c.facturado) * 100)}% del ingreso ya cobrado`
                    : 'Sin facturación en el mes',
            },
        ]);

        detailLine([
            { label: 'Cobrado', value: money(c.cobrado) },
            { label: 'Pendiente', value: money(c.pendiente) },
            { label: 'Vencido', value: money(c.vencido) },
        ]);
        y += 2;

        if (c.gastos.length > 0) {
            pageBreakIfNeeded(8 + c.gastos.length * 4.5);
            doc.setTextColor(100, 116, 139); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
            doc.text('GASTOS POR CATEGORÍA', marginX, y);
            y += 4;
            const ETIQUETA: Record<string, string> = {
                PAYROLL: 'Nómina', RENT: 'Renta', FOOD: 'Alimentos',
                UTILITIES: 'Servicios', INSURANCE: 'Seguros', OTHER: 'Otros',
                MAINTENANCE: 'Mantenimiento', SUPPLIES: 'Suministros',
            };
            c.gastos.forEach(g => {
                const pct = c.totalGastos > 0 ? g.monto / c.totalGastos : 0;
                doc.setTextColor(30, 41, 59); doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
                doc.text(ETIQUETA[g.categoria] ?? g.categoria, marginX, y);
                // Barra proporcional: la lista de numeros no dice donde se va el
                // dinero; la barra si, de un vistazo.
                const barW = (usableW - 60) * pct;
                doc.setFillColor(203, 213, 225);
                doc.roundedRect(marginX + 34, y - 2.6, barW, 3, 0.6, 0.6, 'F');
                doc.setFont('helvetica', 'bold');
                doc.text(money(g.monto), pageW - marginX, y, { align: 'right' });
                doc.setTextColor(148, 163, 184); doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
                doc.text(`${Math.round(pct * 100)}%`, pageW - marginX - 22, y, { align: 'right' });
                y += 4.5;
            });
            y += 2;
        }
    }

    // ─── Footer ──────────────────────────────────────────────────────
    pageBreakIfNeeded(10);
    doc.setDrawColor(226, 232, 240); doc.line(marginX, pageH - 14, pageW - marginX, pageH - 14);
    doc.setTextColor(148, 163, 184); doc.setFont('helvetica', 'italic'); doc.setFontSize(7);
    doc.text(`Generado por Zéndity — app.zendity.com   ·   Documento operativo confidencial   ·   ${d.hqName}`, marginX, pageH - 10);

    const periodSlug = d.period === 'day' ? 'Dia' : d.period === 'week' ? 'Semana' : 'Mes';
    const fileDate = new Date().toISOString().slice(0, 10);
    doc.save(`Resumen_Ejecutivo_${periodSlug}_${d.hqName.replace(/[^a-zA-Z0-9]/g, '_')}_${fileDate}.pdf`);
}
