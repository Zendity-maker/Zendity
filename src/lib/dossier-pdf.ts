/**
 * EL DOSSIER QUE SE LE ENTREGA AL MÉDICO QUE VISITA
 * ─────────────────────────────────────────────────
 * Dos páginas. No "normalmente dos": dos, con tope duro.
 *
 * POR QUÉ DOS. El médico geriatra ve a varios residentes en una mañana. Un
 * dossier de nueve páginas no se lee: se hojea, y hojear un documento clínico
 * es peor que no tenerlo, porque quien lo hojea cree que lo leyó. Antes esto
 * imprimía TODAS las lecturas de vitales del mes —la mediana en Cupey es 57 por
 * residente— y salían siete u ocho páginas de tabla, casi toda normal.
 *
 * QUÉ SE QUEDÓ Y QUÉ SE FUE. La regla es: va lo que cambia una decisión.
 *
 *   página 1   alergias · señales de alarma · diagnósticos · medicamentos
 *   página 2   el mes: vitales FUERA DE RANGO, caídas, alertas, análisis
 *
 * Las lecturas normales de vitales NO se imprimen. Se imprime cuántas hubo y el
 * promedio. Un médico no necesita 45 filas diciendo 120/80; necesita las 12 que
 * se salieron y la fecha exacta, que es lo que le deja cruzarlas con un cambio
 * de medicamento.
 *
 * LO QUE NO CUPO SE DICE. Si algo se corta, sale escrito al pie de la página 2
 * con el número. Una lista que se recorta en silencio es peor que una lista
 * larga: el médico no tiene forma de saber que le falta algo.
 *
 * POR QUÉ NO ES UNA CAPTURA DE PANTALLA. Antes esto era html2canvas: una imagen
 * larga cortada en trozos. El texto no se podía seleccionar, las filas se
 * partían por la mitad en el corte, y el nombre del residente salía solo en la
 * hoja 1 — el mismo problema de la hoja de traslado. Aquí el nombre va en las
 * dos hojas y el texto es texto.
 */
import jsPDF from 'jspdf';

const ROJO: [number, number, number] = [190, 18, 60];
const ROJO_BG: [number, number, number] = [254, 226, 226];
const AMBAR: [number, number, number] = [180, 83, 9];
const AMBAR_BG: [number, number, number] = [255, 251, 235];
const TEAL: [number, number, number] = [15, 110, 86];
const INK: [number, number, number] = [31, 45, 58];
const MUTED: [number, number, number] = [100, 116, 139];
const LINE: [number, number, number] = [226, 232, 240];
const ZEBRA: [number, number, number] = [248, 250, 252];

const M = 14;
const PAGINAS = 2;
/**
 * Cuántas lecturas fuera de rango se listan.
 *
 * Medido contra Cupey: hay residentes con 37 de 59 lecturas fuera de rango. Sin
 * tope, esa tabla se comía la página 2 entera y el análisis de Zendi se cortaba
 * en 7 de 33 dossiers. Y a quien tiene 37 de 59 fuera de rango no le ayuda la
 * lista: le ayuda el patrón. La tabla dice cuántas hubo y enseña las más
 * recientes; nunca finge ser la lista completa.
 */
const FILAS_FUERA_DE_RANGO = 12;

export interface VitalDossier {
    date: string;
    systolic: number;
    diastolic: number;
    heartRate: number;
    temperature: number;
    measuredBy: string | null;
    isAbnormal: boolean;
}

export interface MedDossier {
    name: string;
    dosage: string | null;
    route: string | null;
    frequency: string | null;
    scheduleTimes: string | null;
}

export interface DossierMeta {
    nombre: string;
    habitacion?: string | null;
    grupoColor?: string | null;
    dieta?: string | null;
    /** Texto ya resuelto por src/lib/alergias.ts. Nunca vacío. */
    alergias: string;
    alergiasSinDocumentar: boolean;
    diagnosticos?: string | null;
    señalesDeAlarma: string[];
    vitales: VitalDossier[];
    promedio: { sys: number; dia: number; hr: number; temp: number } | null;
    medicamentos: MedDossier[];
    caidas: { date: string; severity: string | null; notes: string | null; interventions: string | null }[];
    alertas: { date: string; notes: string | null; author: string | null }[];
    /** El texto de Zendi, en markdown. */
    analisis: string;
    hogar: {
        nombre: string;
        telefono?: string | null;
        direccion?: string | null;
        /** data:image/... guardado en la sede. Es el membrete. */
        logo?: string | null;
    };
    generadoAt: Date;
    desde: Date;
}

/** Markdown a bloques. jsPDF no entiende asteriscos ni almohadillas. */
function bloques(md: string): { tipo: 'titulo' | 'parrafo' | 'viñeta'; texto: string }[] {
    const out: { tipo: 'titulo' | 'parrafo' | 'viñeta'; texto: string }[] = [];
    for (const cruda of md.split('\n')) {
        const l = cruda.trim();
        if (!l) continue;
        const limpia = l.replace(/\*\*/g, '').replace(/`/g, '').trim();
        if (/^#{1,6}\s/.test(l)) { out.push({ tipo: 'titulo', texto: limpia.replace(/^#{1,6}\s*/, '') }); continue; }
        if (/^[-*+]\s/.test(l)) { out.push({ tipo: 'viñeta', texto: limpia.replace(/^[-*+]\s*/, '') }); continue; }
        // "1. Resumen Ejecutivo" — el formato que pide el prompt es un titulo.
        if (/^\d+\.\s+[A-ZÁÉÍÓÚÑ]/.test(limpia) && limpia.length < 70) { out.push({ tipo: 'titulo', texto: limpia }); continue; }
        out.push({ tipo: 'parrafo', texto: limpia });
    }
    return out;
}

const fecha = (iso: string) =>
    new Date(iso).toLocaleDateString('es-PR', { day: '2-digit', month: 'short', timeZone: 'America/Puerto_Rico' });
const fechaHora = (iso: string) =>
    new Date(iso).toLocaleString('es-PR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Puerto_Rico' });

/**
 * Devuelve el documento sin guardarlo, para poder CONTAR LAS PÁGINAS en una
 * prueba. El tope de dos páginas que promete la cabecera de este archivo se
 * comprueba con scripts/verificar-dossier.ts contra los residentes reales; sin
 * esta separación habría que creerse el tope en vez de medirlo.
 *
 * Devuelve también `omitido` —lo que no cupo— para que la prueba pueda medir el
 * precio del tope. "Cabe en dos páginas" no significa nada si para lograrlo se
 * está tirando media historia clínica por la borda sin decirlo.
 */
export function construirDossierPDF(m: DossierMeta): { doc: jsPDF; omitido: string[] } {
    const doc = new jsPDF({ unit: 'mm', format: 'letter' });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();

    const setFill = (c: [number, number, number]) => doc.setFillColor(c[0], c[1], c[2]);
    const setText = (c: [number, number, number]) => doc.setTextColor(c[0], c[1], c[2]);
    const setDraw = (c: [number, number, number]) => doc.setDrawColor(c[0], c[1], c[2]);

    let pagina = 0;
    let y = 0;
    /** Lo que no cupo. Se imprime al pie de la última página. */
    const omitido: string[] = [];
    /**
     * Espacio reservado abajo. En la última hoja cabe además el aviso de lo que
     * no cupo y el bloque de procedencia — de dónde salen estos números y con
     * qué se llevan.
     */
    const SUELO = () => H - (pagina === PAGINAS ? 48 : 19);

    const abrirPagina = () => {
        pagina++;
        if (pagina > 1) doc.addPage();
        const alto = pagina === 1 ? 26 : 16;
        setFill(INK);
        doc.rect(0, 0, W, alto, 'F');
        setText([255, 255, 255]);
        doc.setFont('helvetica', 'bold').setFontSize(pagina === 1 ? 15 : 11);
        doc.text(m.nombre, M, pagina === 1 ? 11 : 8.5);
        doc.setFont('helvetica', 'normal').setFontSize(8);
        const sub = [
            m.habitacion ? `Hab. ${m.habitacion}` : null,
            m.grupoColor ? `Grupo ${m.grupoColor}` : null,
            m.dieta ? `Dieta: ${m.dieta}` : null,
        ].filter(Boolean).join('  ·  ');
        doc.text(sub, M, pagina === 1 ? 18 : 13);
        doc.setFont('helvetica', 'bold').setFontSize(8);
        doc.text('DOSSIER MÉDICO MENSUAL', W - M, pagina === 1 ? 11 : 8.5, { align: 'right' });
        doc.setFont('helvetica', 'normal').setFontSize(7.5);
        doc.text(m.hogar.nombre, W - M, pagina === 1 ? 18 : 13, { align: 'right' });
        y = pagina === 1 ? 32 : 22;

        /**
         * EL MEMBRETE DEL HOGAR, EN LA PÁGINA 1.
         *
         * Este papel se queda en la oficina del médico. Quien lo archive tiene
         * que poder saber de qué hogar vino sin leerlo entero: logo, nombre,
         * dirección y teléfono, arriba, como cualquier carta con membrete.
         *
         * El logo es un data-URI guardado en la sede, así que va dentro del
         * documento — no se descarga de ningún sitio y no puede fallar por red.
         * Si la sede no tiene logo, el nombre ocupa su sitio y ya está.
         */
        if (pagina === 1) {
            const bandaAlta = 15;
            let x = M;
            if (m.hogar.logo) {
                try {
                    // getImageProperties no esta en los tipos de jsPDF 5.x.
                    const props = (doc as unknown as {
                        getImageProperties: (d: string) => { width: number; height: number };
                    }).getImageProperties(m.hogar.logo);
                    const alto = 11;
                    const ancho = Math.min(46, (props.width / props.height) * alto);
                    doc.addImage(m.hogar.logo, M, y - 1, ancho, alto);
                    x = M + ancho + 5;
                } catch {
                    // Un logo ilegible no puede tumbar el documento clínico.
                }
            }
            setText(INK);
            doc.setFont('helvetica', 'bold').setFontSize(11);
            doc.text(m.hogar.nombre, x, y + 4);
            doc.setFont('helvetica', 'normal').setFontSize(7.5);
            setText(MUTED);
            const contacto = [m.hogar.direccion, m.hogar.telefono].filter(Boolean).join('  ·  ');
            if (contacto) doc.text(contacto, x, y + 8.5);
            setDraw(TEAL);
            doc.setLineWidth(0.7);
            doc.line(M, y + bandaAlta - 2, W - M, y + bandaAlta - 2);
            doc.setLineWidth(0.2);
            y += bandaAlta + 3;
        }
    };

    /**
     * Reserva `mm`. Salta de página SOLO si queda página a la que saltar; en la
     * última devuelve false y quien llama registra lo que no cupo. Sin esto el
     * tope de dos páginas sería una intención, no un tope.
     */
    const sitio = (mm: number): boolean => {
        if (y + mm <= SUELO()) return true;
        if (pagina >= PAGINAS) return false;
        abrirPagina();
        return true;
    };

    const titulo = (t: string, color: [number, number, number] = TEAL): boolean => {
        if (!sitio(14)) return false;
        setText(color);
        doc.setFont('helvetica', 'bold').setFontSize(8);
        doc.text(t.toUpperCase(), M, y);
        setDraw(color);
        doc.setLineWidth(0.4);
        doc.line(M, y + 1.5, W - M, y + 1.5);
        doc.setLineWidth(0.2);
        y += 6;
        return true;
    };

    /** Devuelve cuántas líneas NO cupieron. */
    const parrafo = (t: string, tam = 9, color: [number, number, number] = INK, estilo: 'normal' | 'bold' = 'normal'): number => {
        setText(color);
        doc.setFont('helvetica', estilo).setFontSize(tam);
        const lineas = doc.splitTextToSize(t, W - 2 * M) as string[];
        for (let i = 0; i < lineas.length; i++) {
            if (!sitio(tam * 0.52)) return lineas.length - i;
            doc.text(lineas[i], M, y);
            y += tam * 0.48;
        }
        y += 2;
        return 0;
    };

    /* ══ PÁGINA 1 ══════════════════════════════════════════════════════ */
    abrirPagina();

    /* Alergias. Lo primero, siempre, y nunca ausente: un hueco no puede
       parecerse a "no tiene alergias". */
    {
        const c = m.alergiasSinDocumentar ? AMBAR : ROJO;
        const bg = m.alergiasSinDocumentar ? AMBAR_BG : ROJO_BG;
        const ls = doc.splitTextToSize(m.alergias, W - 2 * M - 10) as string[];
        const alto = 11 + ls.length * 4.6;
        setFill(bg); setDraw(c); doc.setLineWidth(0.6);
        doc.rect(M, y, W - 2 * M, alto, 'FD');
        doc.setLineWidth(0.2);
        setText(c);
        doc.setFont('helvetica', 'bold').setFontSize(8);
        doc.text('ALERGIAS', M + 4, y + 5.5);
        doc.setFontSize(m.alergiasSinDocumentar ? 9 : 12);
        let yy = y + 12;
        for (const l of ls) { doc.text(l, M + 4, yy); yy += 4.6; }
        y += alto + 5;
    }

    /* Señales de alarma: lo que el sistema calculó, no lo que opinó. */
    if (m.señalesDeAlarma.length && titulo('Señales de alarma del mes', ROJO)) {
        setText(ROJO);
        doc.setFont('helvetica', 'bold').setFontSize(9.5);
        for (const s of m.señalesDeAlarma) {
            if (!sitio(5)) { omitido.push(`${m.señalesDeAlarma.length} señales de alarma`); break; }
            doc.text(`•  ${s}`, M + 1, y);
            y += 4.8;
        }
        y += 3;
    }

    if (m.diagnosticos && titulo('Cuadro clínico base')) {
        const t = m.diagnosticos.split('\n').map(l => l.replace(/^-\s*/, '').trim()).filter(Boolean).join(' · ');
        parrafo(t, 9, INK);
    }

    /* Medicamentos: van completos. Es lo que el médico vino a revisar. */
    if (m.medicamentos.length && titulo(`Plan farmacológico activo — ${m.medicamentos.length} medicamentos`)) {
        const cols = [M, M + 58, M + 82, M + 100, M + 128];
        const cab = () => {
            setFill(INK); doc.rect(M, y - 3.6, W - 2 * M, 5.6, 'F');
            setText([255, 255, 255]);
            doc.setFont('helvetica', 'bold').setFontSize(7);
            ['MEDICAMENTO', 'DOSIS', 'VÍA', 'FRECUENCIA', 'HORARIO'].forEach((t, i) => doc.text(t, cols[i] + 1.5, y));
            y += 4.5;
        };
        cab();
        let i = 0;
        for (; i < m.medicamentos.length; i++) {
            if (!sitio(5.2)) break;
            if (y < 30) cab(); // cambió de página: repetir la cabecera
            const md = m.medicamentos[i];
            if (i % 2 === 0) { setFill(ZEBRA); doc.rect(M, y - 3.4, W - 2 * M, 5, 'F'); }
            setText(INK);
            doc.setFont('helvetica', 'bold').setFontSize(7.5);
            doc.text((doc.splitTextToSize(md.name, 55) as string[])[0], cols[0] + 1.5, y);
            doc.setFont('helvetica', 'normal');
            doc.text(md.dosage ?? '—', cols[1] + 1.5, y);
            doc.text(md.route ?? '—', cols[2] + 1.5, y);
            doc.text(md.frequency ?? '—', cols[3] + 1.5, y);
            doc.text((doc.splitTextToSize(md.scheduleTimes ?? '—', W - M - cols[4] - 3) as string[])[0], cols[4] + 1.5, y);
            y += 5;
        }
        if (i < m.medicamentos.length) omitido.push(`${m.medicamentos.length - i} medicamentos`);
        y += 3;
    }

    /**
     * El hueco de la página 1 se usa, no se disimula.
     *
     * La página 1 es la hoja de cabecera —quién es y qué puede matarlo— y casi
     * siempre sobra media hoja, porque los medicamentos de un residente de aquí
     * caben de sobra. Un espacio en blanco al pie de un documento clínico que
     * alguien lee CON el residente delante tiene un uso obvio: escribir. El
     * médico visitante anota ahí y el papel vuelve al expediente con lo suyo.
     *
     * Solo si sobra de verdad (40 mm). Si no, no se fuerza.
     */
    if (SUELO() - y > 40) {
        titulo('Notas del médico visitante', MUTED);
        const arriba = y;
        const abajo = SUELO() - 2;
        setDraw(LINE);
        for (let ly = arriba + 4; ly < abajo; ly += 8) doc.line(M, ly, W - M, ly);
        setText(MUTED);
        doc.setFont('helvetica', 'italic').setFontSize(7);
        doc.text('Esta hoja vuelve al expediente del residente.', M, abajo + 0.5);
        y = abajo;
    }

    /* ══ PÁGINA 2 — el mes ═════════════════════════════════════════════ */
    if (pagina < PAGINAS) { abrirPagina(); }

    /* Vitales: el promedio y SOLO lo que se salió de rango. */
    {
        const fuera = m.vitales.filter(v => v.isAbnormal);
        const normales = m.vitales.length - fuera.length;
        if (titulo(`Signos vitales — ${m.vitales.length} lecturas en 30 días`)) {
            setText(MUTED);
            doc.setFont('helvetica', 'normal').setFontSize(8.5);
            const resumen = m.promedio
                ? `Promedio del mes: ${m.promedio.sys}/${m.promedio.dia} mmHg · FC ${m.promedio.hr} bpm · ${m.promedio.temp} °F`
                : 'Sin lecturas registradas en el periodo.';
            doc.text(resumen, M, y); y += 4.2;
            const listadas = fuera.slice(-FILAS_FUERA_DE_RANGO);
            doc.setFontSize(8);
            doc.text(
                fuera.length === 0
                    ? `Las ${normales} lecturas del mes están dentro de rango. No se listan.`
                    : listadas.length < fuera.length
                        ? `${fuera.length} fuera de rango — abajo las ${listadas.length} más recientes. Las ${normales} restantes están dentro de rango.`
                        : `${fuera.length} fuera de rango, listadas abajo. Las ${normales} restantes están dentro de rango y no se listan.`,
                M, y,
            );
            y += 5.5;

            if (listadas.length) {
                const cols = [M, M + 42, M + 72, M + 96, M + 124];
                setFill(ROJO); doc.rect(M, y - 3.6, W - 2 * M, 5.6, 'F');
                setText([255, 255, 255]);
                doc.setFont('helvetica', 'bold').setFontSize(7);
                ['FECHA', 'PRESIÓN', 'FREC. CARD.', 'TEMP.', 'MEDIDO POR'].forEach((t, i) => doc.text(t, cols[i] + 1.5, y));
                y += 4.5;
                let i = 0;
                for (; i < listadas.length; i++) {
                    if (!sitio(5)) break;
                    const v = listadas[i];
                    setFill(ROJO_BG); doc.rect(M, y - 3.4, W - 2 * M, 4.8, 'F');
                    setText(ROJO);
                    doc.setFont('helvetica', 'bold').setFontSize(7.5);
                    doc.text(fechaHora(v.date), cols[0] + 1.5, y);
                    doc.text(`${v.systolic}/${v.diastolic}`, cols[1] + 1.5, y);
                    doc.text(`${v.heartRate} bpm`, cols[2] + 1.5, y);
                    doc.text(`${v.temperature} °F`, cols[3] + 1.5, y);
                    doc.setFont('helvetica', 'normal');
                    doc.text((doc.splitTextToSize(v.measuredBy ?? '—', W - M - cols[4] - 3) as string[])[0], cols[4] + 1.5, y);
                    y += 4.8;
                }
                if (i < listadas.length) omitido.push(`${listadas.length - i} lecturas fuera de rango`);
            }
            y += 3;
        }
    }

    if (m.caidas.length && titulo(`Caídas reportadas — ${m.caidas.length}`, AMBAR)) {
        let i = 0;
        for (; i < m.caidas.length; i++) {
            const c = m.caidas[i];
            const txt = (c.notes || c.interventions || '').trim();
            if (!sitio(8)) break;
            setText(AMBAR);
            doc.setFont('helvetica', 'bold').setFontSize(8);
            doc.text(`${fecha(c.date)}${c.severity ? ` — ${c.severity}` : ''}`, M, y); y += 3.8;
            if (txt) { if (parrafo(txt, 8, INK) > 0) { i++; break; } } else { y += 1.5; }
        }
        if (i < m.caidas.length) omitido.push(`${m.caidas.length - i} caídas`);
        y += 2;
    }

    if (m.alertas.length && titulo(`Alertas clínicas — ${m.alertas.length}`, ROJO)) {
        let i = 0;
        for (; i < m.alertas.length; i++) {
            const a = m.alertas[i];
            if (!sitio(8)) break;
            setText(ROJO);
            doc.setFont('helvetica', 'bold').setFontSize(8);
            doc.text(`${fecha(a.date)}${a.author ? ` — ${a.author}` : ''}`, M, y); y += 3.8;
            if (a.notes && parrafo(a.notes.trim(), 8, INK) > 0) { i++; break; }
        }
        if (i < m.alertas.length) omitido.push(`${m.alertas.length - i} alertas clínicas`);
        y += 2;
    }

    if (m.analisis.trim() && titulo('Análisis de Zendi')) {
        const bs = bloques(m.analisis);
        let cortado = false;
        for (const b of bs) {
            if (cortado) break;
            if (b.tipo === 'titulo') {
                if (!sitio(6)) { cortado = true; break; }
                setText(TEAL);
                doc.setFont('helvetica', 'bold').setFontSize(8.5);
                doc.text(b.texto, M, y); y += 4.4;
            } else {
                const t = b.tipo === 'viñeta' ? `•  ${b.texto}` : b.texto;
                if (parrafo(t, 8.5, INK) > 0) cortado = true;
            }
        }
        if (cortado) omitido.push('parte del análisis de Zendi');
    }

    /* ── Pie de las dos hojas ──────────────────────────────────────────── */
    const total = pagina;
    for (let p = 1; p <= total; p++) {
        doc.setPage(p);
        if (p === total) {
            if (omitido.length) {
                setFill(AMBAR_BG); setDraw(AMBAR); doc.setLineWidth(0.4);
                doc.rect(M, H - 46, W - 2 * M, 7.5, 'FD');
                doc.setLineWidth(0.2);
                setText(AMBAR);
                doc.setFont('helvetica', 'bold').setFontSize(6.8);
                doc.text(
                    `NO CUPO EN ESTAS DOS PÁGINAS: ${omitido.join(', ')}. Está completo en el expediente del hogar.`,
                    M + 3, H - 41.5,
                );
            }

            /**
             * DE DÓNDE SALEN ESTOS NÚMEROS.
             *
             * Este documento se queda en la oficina del médico, y ahí es donde
             * alguien se pregunta si fiarse de él. La respuesta honesta también
             * es la presentación de Zéndity: nada de esto se transcribió a
             * mano — cada dato lleva hora y nombre de quien lo registró.
             *
             * Va DESPUÉS de todo lo clínico y en cuerpo pequeño: es
             * procedencia, no publicidad. El hogar manda arriba; esto es el pie.
             */
            setFill([248, 250, 252]);
            doc.rect(M, H - 37, W - 2 * M, 21, 'F');
            setDraw(TEAL); doc.setLineWidth(0.7);
            doc.line(M, H - 37, W - M, H - 37);
            doc.setLineWidth(0.2);
            setText(TEAL);
            doc.setFont('helvetica', 'bold').setFontSize(9);
            doc.text('ZÉNDITY', M + 3, H - 31.5);
            setText(MUTED);
            doc.setFont('helvetica', 'normal').setFontSize(6.8);
            doc.text('zendity.com', M + 3, H - 27.5);
            setText(INK);
            doc.setFont('helvetica', 'normal').setFontSize(7);
            const explica = doc.splitTextToSize(
                `Los datos de este documento no se transcribieron a mano: salen del expediente digital con el que ${m.hogar.nombre} lleva la administración de medicamentos, los signos vitales y el plan de cuido de cada residente. Cada signo vital, cada dosis y cada nota guarda la hora y el nombre de quien la registró. Las lecturas de este mes se contaron solas; el resumen final lo redactó Zendi, la inteligencia clínica de la plataforma, sobre esos mismos datos.`,
                W - 2 * M - 38,
            ) as string[];
            let yz = H - 32.5;
            for (const ln of explica.slice(0, 5)) { doc.text(ln, M + 32, yz); yz += 3.3; }
        }

        setDraw(LINE);
        doc.line(M, H - 13, W - M, H - 13);
        setText(MUTED);
        doc.setFont('helvetica', 'normal').setFontSize(7);
        doc.text(`${m.nombre} · ${m.hogar.nombre}${m.hogar.telefono ? ` · ${m.hogar.telefono}` : ''}`, M, H - 9);
        doc.text(
            `${m.desde.toLocaleDateString('es-PR', { day: '2-digit', month: 'short', timeZone: 'America/Puerto_Rico' })} – ${m.generadoAt.toLocaleDateString('es-PR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Puerto_Rico' })}`,
            W / 2, H - 9, { align: 'center' },
        );
        doc.setFont('helvetica', 'bold');
        doc.text(`Página ${p} de ${total}`, W - M, H - 9, { align: 'right' });
    }

    return { doc, omitido };
}

/** Nombre del archivo que ve quien descarga. */
export function dossierFileName(nombre: string): string {
    const limpio = nombre.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40);
    return `Dossier_Medico_${limpio}_${new Date().toISOString().slice(0, 10)}.pdf`;
}

/** Genera y descarga. Es lo que llama el botón de la pantalla. */
export function descargarDossierPDF(m: DossierMeta): void {
    construirDossierPDF(m).doc.save(dossierFileName(m.nombre));
}
