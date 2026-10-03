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
        meds: { total: number; administered: number; missed: number; omitted: number; refused: number; held: number; pending: number; compliancePct: number };
        /** `critical` = nivel LLAMAR de vitals-thresholds; `anomalos` incluye ANOTAR. */
        vitals: { total: number; critical: number; anomalos: number };
        /**
         * Separadas a proposito: el 85% de las filas son el boton de Rondas sin
         * lado escrito, y solo el 19% son de residentes con UPP. Ver la nota del
         * route.
         */
        rotaciones: { conDecubito: number; rondas: number; total: number };
        incidents: Record<string, number>;
    };
    operacional: {
        sessionsOpened: number; sessionsClosed: number; sessionsForcedClosed: number;
        absences: number;
        /**
         * El relevo medido contra los TURNOS, no contra los relevos firmados:
         * ese cociente era 1 por construccion. `pct` es null si no hubo turnos.
         */
        relevo: {
            turnos: number; conRelevo: number; sinRelevo: number;
            cerradosPorSupervision: number; pct: number | null;
        };
        /** Por ACTO, no por fila: 1.212 filas eran 119 reorganizaciones. */
        redistribuciones: {
            actos: number; residentesMovidos: number; turnosAfectados: number;
            porAusencia: number; porLlegadaTarde: number;
        };
    };
    personal: {
        totalStaff: number;
        /**
         * El equipo con nombre y con hechos, en orden alfabético.
         * Sustituye a `topStaff`/`bottomStaff`, que se ordenaban por el
         * complianceScore — ver la nota del render más abajo.
         */
        roster: Array<{
            name: string; role: string;
            turnos: number; cerrados: number; forzados: number;
            cursos: number; observaciones: number;
        }>;
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
        /**
         * El trimestre de donde sale ese promedio, p.ej. "2026-Q4". La encuesta
         * tiene su propio reloj y no es el del informe: va impreso para que no
         * se lea como si fuera de los ultimos 30 dias.
         */
        trimestreEncuesta: string;
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

/**
 * EL ROTULO DICE LA VENTANA DE VERDAD.
 *
 * Decia «RESUMEN DEL MES» y «RESUMEN DE LA SEMANA», que un director lee como
 * «septiembre» y «esta semana». El route no corta por mes ni por semana
 * natural: resta 30 y 7 dias de AHORA. Asi que el resumen «del mes» del 3 de
 * octubre es del 3 de septiembre al 3 de octubre — dos trozos de dos meses.
 *
 * La cabecera ya imprimia el rango exacto con fecha y hora debajo, asi que el
 * dato estaba; lo que mentia era el titulo, que es lo que se lee. El unico
 * bloque cortado por mes natural es el cierre financiero, y ese ya lo dice en
 * su propio rotulo: «CIERRE DE SEPTIEMBRE DE 2026 — MES COMPLETO».
 *
 * El del dia si es el dia: `todayStartAST()`, las 6 AM del dia clinico.
 */
const PERIOD_LABEL: Record<string, string> = {
    day: 'RESUMEN DEL DÍA',
    week: 'ÚLTIMOS 7 DÍAS',
    month: 'ÚLTIMOS 30 DÍAS',
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
    // `→` salia como «!'»: las helvetica que jsPDF trae de serie son WinAnsi y
    // no tienen la flecha. Lo que se imprime es basura, en la primera linea del
    // documento. Un guion la hace.
    doc.text(`Período: ${fmtDateTime(d.periodStart)}  --  ${fmtDateTime(d.periodEnd)}`, marginX + 6, y + 18.5);
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
    /**
     * Repartia `usableW / n` por entrada y escribia cada una en su x, sin
     * comprobar que cupiera. Al añadir «Sin administrar» el 03-oct-2026 fueron
     * seis columnas y el PDF imprimio «Meds administrados: 7399Sin
     * administrar: 273»: dos cifras pegadas, sin separacion, ilegibles.
     *
     * No se veia en ninguna comprobacion de tipos ni en el JSON. Se vio al
     * mirar el PDF.
     *
     * Ahora se miden las entradas y se reparte el sitio que de verdad hay: si
     * no cabe en una fila, se parte en dos. Un dato clinico que no se lee no
     * es un dato.
     */
    const detailLine = (entries: Array<{ label: string; value: string | number }>) => {
        const texto = (e: { label: string; value: string | number }) => `${e.label}: ${e.value}`;
        const anchoDe = (e: typeof entries[number]) => {
            doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
            return doc.getTextWidth(texto(e)) + 6;   // 6 mm de aire entre columnas
        };

        // Se parte en filas que quepan, en vez de encogerlas hasta solaparse.
        const filas: typeof entries[] = [];
        let fila: typeof entries = [];
        let ancho = 0;
        for (const e of entries) {
            const w = anchoDe(e);
            if (fila.length && ancho + w > usableW) { filas.push(fila); fila = []; ancho = 0; }
            fila.push(e); ancho += w;
        }
        if (fila.length) filas.push(fila);

        for (const f of filas) {
            pageBreakIfNeeded(6);
            let x = marginX;
            for (const e of f) {
                doc.setTextColor(100, 116, 139); doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
                doc.text(`${e.label}: `, x, y);
                const lw = doc.getTextWidth(`${e.label}: `);
                doc.setTextColor(30, 41, 59); doc.setFont('helvetica', 'bold');
                doc.text(String(e.value), x + lw, y);
                x += anchoDe(e);
            }
            y += 5;
        }
    };

    // ─── Censo y movimientos ─────────────────────────────────────────
    sectionHeader('CENSO Y MOVIMIENTOS');
    kpiRow([
        /* DOS de estas cinco son la foto de HOY y tres son acumulados del
           periodo. Antes solo una lo decia, y las cinco se leian en fila como
           si fueran lo mismo. Ahora cada subtitulo dice cual es. */
        { label: 'En el hogar', value: d.censo.activeNow, sub: 'Activos · hoy' },
        { label: 'En licencia', value: d.censo.leaveNow, sub: 'Hospital o permiso · hoy' },
        { label: 'Admisiones', value: d.censo.admisiones, sub: 'Nuevos en el período' },
        { label: 'Egresos', value: d.censo.egresos, sub: 'Altas en el período' },
        /* «Traslados a hospital» prometia mas de lo que el numero cuenta: de las 47
           notas del historico, 2 son fallecimientos y 2 citas programadas. Ver la
           nota del route. */
        { label: 'Salidas registradas', value: d.censo.hospitalizaciones, sub: 'Hospital, citas, diálisis' },
    ]);

    // ─── Clínico ─────────────────────────────────────────────────────
    sectionHeader('CLÍNICO');
    kpiRow([
        // 'Cumplimiento meds' salia aqui, en primera posicion y siempre al 100%.
        // Medido el 26-ago-2026: 22.211 administrados contra 1 omitido — es
        // administrados dividido entre administrados. Un 100% que no puede bajar
        // no informa, decora. Baja a la linea de detalle, con sus numeros
        // crudos al lado para que se pueda juzgar.
        { label: 'Vitales tomados', value: d.clinico.vitals.total, sub: `${d.clinico.vitals.critical} para llamar · ${d.clinico.vitals.anomalos} alterados` },
        /* «Rotaciones UPP 5212 / Posturales» eran dos cosas falsas: el 85% son
           rondas sin lado escrito y solo el 19% son de residentes con UPP. */
        { label: 'Cambios de decúbito', value: d.clinico.rotaciones.conDecubito, sub: `${d.clinico.rotaciones.rondas} rondas sin lado anotado` },
        { label: 'Observaciones HR', value:
            (d.clinico.incidents.OBSERVATION || 0) + (d.clinico.incidents.WARNING || 0) +
            (d.clinico.incidents.SUSPENSION || 0) + (d.clinico.incidents.TERMINATION || 0),
            sub: `OBS ${d.clinico.incidents.OBSERVATION || 0} · WARN ${d.clinico.incidents.WARNING || 0} · SUSP ${d.clinico.incidents.SUSPENSION || 0}` },
    ]);
    /* LAS «SIN ADMINISTRAR» FALTABAN, Y SON LA CATEGORIA GRANDE.
       Esta linea imprimia administrados, omitidos, rehusados, en espera y
       pendientes — todo menos MISSED. Medido el 03-oct-2026 en Cupey, 30 dias:
       5.040 administradas, 2 omitidas, 4 rehusadas, 1 en espera… y 189 MISSED
       que no salian en ninguna parte. El director archivaba un papel que decia
       que en un mes hubo DOS medicamentos sin dar. Hubo 191.
       El porcentaje de cumplimiento si las contaba, asi que el numero grande
       estaba bien; lo que faltaba era la linea que explica de donde sale. */
    detailLine([
        { label: 'Meds administrados', value: d.clinico.meds.administered },
        { label: 'Sin administrar', value: d.clinico.meds.missed },
        { label: 'Omitidos con motivo', value: d.clinico.meds.omitted },
        { label: 'Rehusados', value: d.clinico.meds.refused },
        { label: 'En espera', value: d.clinico.meds.held },
        { label: 'Aún sin vencer', value: d.clinico.meds.pending },
    ]);

    // ─── Operacional ─────────────────────────────────────────────────
    sectionHeader('OPERACIONAL');
    kpiRow([
        { label: 'Sesiones abiertas', value: d.operacional.sessionsOpened, sub: 'Clock-ins' },
        { label: 'Sesiones cerradas', value: d.operacional.sessionsClosed, sub: `${d.operacional.sessionsForcedClosed} forzadas` },
        /* «Marcadas isAbsent» era el nombre de la columna, no del hecho. Y el
           numero llevaba las de dos empleadas borradas: 4 impresas, 1 real. */
        { label: 'Ausencias del equipo', value: d.operacional.absences, sub: 'Horarios publicados' },
        /* Era «Relevos firmados / 100% completados»: firmado y completado son
           el mismo acto, asi que el cociente no podia ser otro. Ahora el
           denominador son los turnos, que si pueden quedarse sin relevo. */
        { label: 'Turnos sin relevo', value: d.operacional.relevo.sinRelevo,
          sub: `${d.operacional.relevo.cerradosPorSupervision} los cerró supervisión` },
        /* 1.212 «overrides creados» eran 119 reorganizaciones: la fila es por
           residente movido, y 764 de las 1.212 no cambiaban de grupo. */
        { label: 'Redistribuciones', value: d.operacional.redistribuciones.actos,
          sub: `${d.operacional.redistribuciones.turnosAfectados} turnos · ${d.operacional.redistribuciones.residentesMovidos} movidos` },
    ]);

    // ─── Personal ────────────────────────────────────────────────────
    sectionHeader('PERSONAL');
    kpiRow([
        { label: 'Equipo activo', value: d.personal.totalStaff, sub: 'CAREGIVER/NURSE/SUP' },
        // Antes: "Compliance promedio", el promedio del complianceScore. Es el
        // mismo número apagado del resto del informe, promediado — o sea el
        // promedio de una cifra invertida. Se sustituye por el cierre de turno,
        // que es un hecho y ya se calcula.
        { label: 'Turnos cerrados con el relevo',
          value: d.operacional.relevo.pct == null ? '—' : `${d.operacional.relevo.pct}%`,
          sub: `${d.operacional.relevo.conRelevo} de ${d.operacional.relevo.turnos}` },
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
            // Y el TRIMESTRE va en el mismo renglon. La encuesta tiene su
            // propio reloj: en un informe rotulado «ultimos 30 dias», o peor
            // en el de un dia, este promedio no es del periodo que se esta
            // leyendo. Al tercer dia de octubre, es de un trimestre de tres
            // dias. Decirlo cuesta siete caracteres.
            sub: `${d.familias.encuestasRespondidas}/${d.familias.encuestasEnviadas} respondieron · ${d.familias.trimestreEncuesta}`,
        },
        {
            label: 'Familias informadas',
            value: d.familias.conFamilia === 0 ? '—' : `${d.familias.actualizadas}/${d.familias.conFamilia}`,
            sub: 'Actualización clínica en el periodo',
        },
    ]);

    /**
     * ─── EL EQUIPO, CON NOMBRE Y CON HECHOS ──────────────────────────
     *
     * Esto eran dos listas, "TOP PERFORMERS" y "A SEGUIR", ordenadas por el
     * complianceScore. Ese número está apagado desde el 09-sep-2026 porque
     * está invertido: medido el 13-sep, Yedaira González —la que más documenta
     * del piso, 517 notas en 30 días— tenía 25, y Caridad Veras —dieciséis días
     * en el hogar, cero notas— tenía 100. Las dos listas habrían impreso a cada
     * una en el lado contrario del que le toca.
     *
     * Un resumen ejecutivo SÍ nombra a su gente: es un documento administrativo
     * y ése es su trabajo. Lo que no puede es ordenarla por un número que
     * miente, porque un PDF se descarga, circula, y no se puede desdecir.
     *
     * Van los cuatro hechos, cada uno observable y ya registrado, sin fundirlos
     * en un índice. Orden alfabético a propósito: cualquier otro orden es un
     * ranking, y un ranking es una nota con otro nombre.
     */
    pageBreakIfNeeded(24 + d.personal.roster.length * 5);
    doc.setFillColor(15, 110, 86); doc.roundedRect(marginX, y, usableW, 5, 1, 1, 'F');
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
    doc.text('EQUIPO DEL PISO', marginX + 2, y + 3.5);
    y += 9;

    const colX = [
        marginX + 2,                    // nombre
        marginX + usableW - 74,         // puesto
        marginX + usableW - 40,         // turnos cerrados
        marginX + usableW - 20,         // cursos
        marginX + usableW - 6,          // observaciones
    ];
    doc.setTextColor(100, 116, 139); doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5);
    doc.text('NOMBRE', colX[0], y);
    doc.text('PUESTO', colX[1], y);
    doc.text('TURNOS CERRADOS', colX[2], y, { align: 'right' });
    doc.text('CURSOS', colX[3], y, { align: 'right' });
    doc.text('OBS.', colX[4], y, { align: 'right' });
    y += 1.5;
    doc.setDrawColor(226, 232, 240); doc.line(marginX, y, marginX + usableW, y);
    y += 4;

    const PUESTO: Record<string, string> = {
        CAREGIVER: 'Cuidadora', NURSE: 'Enfermería', SUPERVISOR: 'Supervisión',
    };

    if (d.personal.roster.length === 0) {
        doc.setTextColor(148, 163, 184); doc.setFont('helvetica', 'italic'); doc.setFontSize(8);
        doc.text('(sin personal de piso en el periodo)', colX[0], y);
        y += 6;
    }

    d.personal.roster.forEach(s => {
        pageBreakIfNeeded(6);
        doc.setTextColor(30, 41, 59); doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
        doc.text(fit(s.name, 62), colX[0], y);
        doc.setTextColor(100, 116, 139); doc.setFontSize(7.5);
        doc.text(PUESTO[s.role] ?? s.role, colX[1], y);

        // "22 de 24" y no un porcentaje: un mes flojo casi siempre es "vino
        // menos", no "lo hizo peor", y una tasa borra esa diferencia.
        doc.setTextColor(30, 41, 59); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
        doc.text(`${s.cerrados} de ${s.turnos}`, colX[2], y, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        doc.text(String(s.cursos), colX[3], y, { align: 'right' });
        doc.text(String(s.observaciones), colX[4], y, { align: 'right' });
        y += 5;

        // El cierre que hizo supervisión no es un turno que ella dejó abierto.
        if (s.forzados > 0) {
            doc.setTextColor(148, 163, 184); doc.setFont('helvetica', 'italic'); doc.setFontSize(6.5);
            doc.text(`${s.forzados} cerrado${s.forzados > 1 ? 's' : ''} por supervisión`, colX[0] + 3, y);
            y += 4;
        }
    });
    y += 3;

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
