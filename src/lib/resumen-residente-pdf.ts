/**
 * EL PAPEL QUE VA CON EL RESIDENTE AL HOSPITAL
 * ────────────────────────────────────────────
 * Sustituye a DOS documentos que hacían el mismo trabajo a medias.
 *
 * El 07-sep se construyó una "hoja de traslado" clínicamente correcta —alergias
 * arriba en rojo, diagnósticos, medicamentos, a quién llamar— con PDF de verdad.
 * Al probarla en emergencias, el hogar prefirió el "resumen del residente", que
 * es más viejo y peor hecho técnicamente. Tenían razón, y la razón importa:
 *
 *   EN EMERGENCIAS PRIMERO ADMITEN A LA PERSONA Y DESPUÉS LA TRATAN. Para
 *   admitirla piden la tarjeta del plan médico y una identificación. La hoja
 *   clínica llevaba el NOMBRE del plan; el resumen lleva LA FOTO DE LA TARJETA,
 *   que es lo que se entrega en la ventanilla. En Cupey 28 de 32 residentes
 *   tienen esa imagen guardada.
 *
 * Así que este documento es el contenido del resumen con el motor de la hoja:
 * PDF real —texto seleccionable, nombre en todas las hojas, "Página 2 de 3"—
 * en vez de la captura de pantalla con html2canvas que partía las filas por la
 * mitad y solo ponía el nombre en la primera hoja.
 *
 * LAS TARJETAS QUE FALTAN NO SON UN FALLO. Se suben según las consiguen las
 * familias, y a veces no las consiguen. El papel dice "no se ha recibido" y no
 * grita: quien está en la ventanilla necesita saber que no la busque, no que
 * alguien hizo algo mal.
 *
 * LAS ALERGIAS SIGUEN PRIMERO Y EN ROJO. Un campo vacío dice NO DOCUMENTADO y
 * dice que hay que preguntar — nunca "sin alergias conocidas".
 */
import jsPDF from 'jspdf';
import { dosisODejarloEnBlanco } from '@/lib/dosis';
import { aFahrenheit } from '@/lib/vitals-thresholds';

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

export interface ResumenMeta {
    nombre: string;
    habitacion?: string | null;
    fechaNacimiento?: string | null;
    edad?: string | null;
    foto?: string | null;
    dieta?: string | null;
    grupoColor?: string | null;
    /** Ya resuelto por src/lib/alergias.ts. Nunca vacío. */
    alergias: string;
    alergiasSinDocumentar: boolean;
    diagnosticos?: string | null;
    historialMedico?: string | null;
    /** Lo que escribió quien traslada. Va arriba, junto a las alergias. */
    motivoDelTraslado?: string | null;
    seguro: {
        plan?: string | null;
        poliza?: string | null;
        medicare?: string | null;
        medicaid?: string | null;
        ssnUltimos4?: string | null;
        hospitalPreferido?: string | null;
    };
    direccionPrevia?: string | null;
    medicamentos: { nombre: string; dosis: string | null; via: string | null; frecuencia: string | null; horario: string | null }[];
    vitales: { fecha: string; sistolica: number; diastolica: number; pulso: number; temperatura: number; glucosa: number | null; oxigeno: number | null; medidoPor: string | null }[];
    familia: { nombre: string; telefono: string | null; parentesco: string | null }[];
    /**
     * data:image/... — se suben según las consiguen las familias.
     *
     * `datos` va IMPRESO junto a la foto de la tarjeta. Las fotos se toman con
     * un móvil y muchas veces el número no se lee por resolución; si el número
     * solo vive en la imagen, la tarjeta no sirve para admitir a nadie.
     */
    tarjetas: { etiqueta: string; imagen: string | null; datos?: { campo: string; valor: string | null }[] }[];
    hogar: { nombre: string; telefono?: string | null; direccion?: string | null; logo?: string | null };
    generadoAt: Date;
}

export function construirResumenResidentePDF(m: ResumenMeta): jsPDF {
    const doc = new jsPDF({ unit: 'mm', format: 'letter' });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const setFill = (c: [number, number, number]) => doc.setFillColor(c[0], c[1], c[2]);
    const setText = (c: [number, number, number]) => doc.setTextColor(c[0], c[1], c[2]);
    const setDraw = (c: [number, number, number]) => doc.setDrawColor(c[0], c[1], c[2]);
    const props = (d: string) => (doc as unknown as {
        getImageProperties: (x: string) => { width: number; height: number };
    }).getImageProperties(d);

    let pagina = 0;
    let y = 0;

    /** El nombre en CADA hoja: este papel se separa en una camilla. */
    const abrirPagina = () => {
        if (pagina > 0) doc.addPage();
        pagina++;
        setFill(INK);
        doc.rect(0, 0, W, pagina === 1 ? 26 : 16, 'F');
        setText([255, 255, 255]);
        doc.setFont('helvetica', 'bold').setFontSize(pagina === 1 ? 15 : 11);
        doc.text(m.nombre, M, pagina === 1 ? 11 : 8.5);
        doc.setFont('helvetica', 'normal').setFontSize(8);
        doc.text([
            m.habitacion ? `Hab. ${m.habitacion}` : null,
            m.edad ? `${m.edad}` : null,
            m.fechaNacimiento,
        ].filter(Boolean).join('  ·  '), M, pagina === 1 ? 18 : 13);
        doc.setFont('helvetica', 'bold').setFontSize(8);
        doc.text('RESUMEN DEL RESIDENTE', W - M, pagina === 1 ? 11 : 8.5, { align: 'right' });
        doc.setFont('helvetica', 'normal').setFontSize(7.5);
        doc.text(m.hogar.nombre, W - M, pagina === 1 ? 18 : 13, { align: 'right' });
        y = pagina === 1 ? 32 : 22;
    };

    const pie = () => {
        setDraw(LINE);
        doc.line(M, H - 13, W - M, H - 13);
        setText(MUTED);
        doc.setFont('helvetica', 'normal').setFontSize(7);
        /**
         * La izquierda se RECORTA para no llegar al centro. Con un nombre largo
         * y el telefono, el texto pisaba la fecha centrada y salia
         * "787-239-6858e septiembre de 2026". El pie es lo ultimo que alguien
         * mira, y por eso es donde estos choques pasan desapercibidos.
         */
        const izquierda = `${m.nombre} · ${m.hogar.nombre}${m.hogar.telefono ? ` · ${m.hogar.telefono}` : ''}`;
        doc.text((doc.splitTextToSize(izquierda, W / 2 - M - 14) as string[])[0], M, H - 8.5);
        doc.text(
            // Ni "09/08/2026" —que se lee 9 de agosto o 8 de septiembre segun
            // quien lo mire— ni la fecha larga, que no cabe. Mes en letra.
            m.generadoAt.toLocaleString('es-PR', {
                day: '2-digit', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit', timeZone: 'America/Puerto_Rico',
            }),
            W / 2 + 6, H - 8.5, { align: 'center' },
        );
    };

    /**
     * El pie NO se pinta aquí. Lo pinta el bucle final, que es el único que
     * sabe cuántas páginas hay en total para poner "Página N de M". Pintarlo
     * en los dos sitios imprimía el pie DOS VECES, uno encima de otro — se veía
     * como una línea emborronada y en el PDF salía el texto duplicado.
     */
    const sitio = (mm: number) => { if (y + mm > H - 18) abrirPagina(); };

    const titulo = (t: string, color: [number, number, number] = TEAL) => {
        sitio(12);
        setText(color);
        doc.setFont('helvetica', 'bold').setFontSize(8);
        doc.text(t.toUpperCase(), M, y);
        setDraw(color); doc.setLineWidth(0.4);
        doc.line(M, y + 1.5, W - M, y + 1.5);
        doc.setLineWidth(0.2);
        y += 6;
    };

    const parrafo = (t: string, tam = 9.5, color: [number, number, number] = INK, estilo: 'normal' | 'bold' = 'normal') => {
        setText(color);
        doc.setFont('helvetica', estilo).setFontSize(tam);
        for (const ln of doc.splitTextToSize(t, W - 2 * M) as string[]) {
            sitio(tam * 0.55);
            doc.text(ln, M, y);
            y += tam * 0.5;
        }
        y += 2;
    };

    abrirPagina();

    /* ── Motivo del traslado, si lo hay. Lo primero que se lee. ────────── */
    if (m.motivoDelTraslado?.trim()) {
        const ls = doc.splitTextToSize(m.motivoDelTraslado.trim(), W - 2 * M - 10) as string[];
        const alto = 11 + ls.length * 4.6;
        setFill(ROJO_BG); setDraw(ROJO); doc.setLineWidth(0.6);
        doc.rect(M, y, W - 2 * M, alto, 'FD'); doc.setLineWidth(0.2);
        setText(ROJO);
        doc.setFont('helvetica', 'bold').setFontSize(8);
        doc.text('MOTIVO DEL TRASLADO', M + 4, y + 5.5);
        doc.setFontSize(11);
        let yy = y + 12;
        for (const l of ls) { doc.text(l, M + 4, yy); yy += 4.6; }
        y += alto + 5;
    }

    /* ── Alergias. Siempre, y nunca ausentes. ──────────────────────────── */
    {
        const c = m.alergiasSinDocumentar ? AMBAR : ROJO;
        const bg = m.alergiasSinDocumentar ? AMBAR_BG : ROJO_BG;
        const ls = doc.splitTextToSize(m.alergias, W - 2 * M - 10) as string[];
        const alto = 11 + ls.length * 4.8;
        setFill(bg); setDraw(c); doc.setLineWidth(0.6);
        doc.rect(M, y, W - 2 * M, alto, 'FD'); doc.setLineWidth(0.2);
        setText(c);
        doc.setFont('helvetica', 'bold').setFontSize(8);
        doc.text('ALERGIAS', M + 4, y + 5.5);
        doc.setFontSize(m.alergiasSinDocumentar ? 9.5 : 13);
        let yy = y + 12;
        for (const l of ls) { doc.text(l, M + 4, yy); yy += 4.8; }
        y += alto + 5;
    }

    /* ── Quién es: foto + identificación ───────────────────────────────── */
    {
        const altoFoto = 28;
        let x = M;
        if (m.foto) {
            try {
                const p = props(m.foto);
                const ancho = (p.width / p.height) * altoFoto;
                doc.addImage(m.foto, M, y, ancho, altoFoto);
                x = M + ancho + 6;
            } catch { /* una foto ilegible no tumba el papel */ }
        }
        const campos: [string, string][] = [
            ['Dieta', m.dieta || '—'],
            ['Grupo', m.grupoColor || '—'],
            ['Plan médico', m.seguro.plan || '—'],
            ['Hospital preferido', m.seguro.hospitalPreferido || 'No indicado'],
            ['Seguro social', m.seguro.ssnUltimos4 ? `···· ${m.seguro.ssnUltimos4}` : 'No registrado'],
            ['Medicare', m.seguro.medicare || (m.seguro.medicaid ? `Medicaid ${m.seguro.medicaid}` : 'No registrado')],
        ];
        const anchoCol = (W - M - x) / 2 - 3;
        campos.forEach((c, i) => {
            const cx = x + (i % 2) * (anchoCol + 6);
            const cy = y + 5 + Math.floor(i / 2) * 8.5;
            setText(MUTED);
            doc.setFont('helvetica', 'bold').setFontSize(6.5);
            doc.text(c[0].toUpperCase(), cx, cy - 3.2);
            setText(INK);
            doc.setFont('helvetica', 'bold').setFontSize(9);
            doc.text((doc.splitTextToSize(c[1], anchoCol) as string[])[0], cx, cy + 0.8);
        });
        y += Math.max(altoFoto, 5 + 3 * 8.5) + 4;

        /**
         * LA PÓLIZA, GRANDE Y APARTE.
         *
         * Es el dato que teclean en la ventanilla del hospital, y las fotos de
         * las tarjetas casi nunca se leen: se toman con un móvil y el número
         * sale borroso. Si el número solo vive en la imagen, la tarjeta no
         * sirve para admitir a nadie. Aquí va en cuerpo grande, en su propia
         * caja, para que se lea de un vistazo y se pueda copiar.
         */
        setFill([241, 247, 244]); setDraw(TEAL); doc.setLineWidth(0.5);
        doc.rect(M, y, W - 2 * M, 13, 'FD'); doc.setLineWidth(0.2);
        setText(TEAL);
        doc.setFont('helvetica', 'bold').setFontSize(7);
        doc.text('NÚMERO DE PÓLIZA', M + 4, y + 5);
        setText(m.seguro.poliza ? INK : AMBAR);
        doc.setFont('helvetica', 'bold').setFontSize(m.seguro.poliza ? 14 : 9.5);
        doc.text(m.seguro.poliza || 'No está escrito en el expediente', M + 4, y + 10.5);
        if (m.seguro.plan) {
            setText(MUTED);
            doc.setFont('helvetica', 'normal').setFontSize(9);
            doc.text(m.seguro.plan, W - M - 4, y + 10, { align: 'right' });
        }
        y += 18;
        if (m.direccionPrevia) {
            setText(MUTED);
            doc.setFont('helvetica', 'normal').setFontSize(7.5);
            doc.text(`Dirección previa: ${m.direccionPrevia}`, M, y);
            y += 6;
        }
    }

    /* ── Diagnósticos ──────────────────────────────────────────────────── */
    titulo('Diagnósticos y condiciones');
    parrafo(
        m.diagnosticos?.trim()
            ? m.diagnosticos.split('\n').map(l => l.replace(/^-\s*/, '').trim()).filter(Boolean).join(' · ')
            : 'No documentados en el expediente.',
        9.5, m.diagnosticos?.trim() ? INK : MUTED,
    );
    if (m.historialMedico?.trim()) parrafo(m.historialMedico.trim(), 8.5, MUTED);

    /* ── Últimos vitales — lo que el hospital pregunta primero ─────────── */
    titulo('Últimos signos vitales');
    if (m.vitales.length === 0) {
        parrafo('Sin registros recientes.', 9, MUTED);
    } else {
        const cols = [M, M + 34, M + 62, M + 86, M + 110, M + 132];
        setFill(INK); doc.rect(M, y - 3.6, W - 2 * M, 5.6, 'F');
        setText([255, 255, 255]);
        doc.setFont('helvetica', 'bold').setFontSize(7);
        ['FECHA', 'PRESIÓN', 'PULSO', 'TEMP.', 'GLUCOSA', 'MEDIDO POR'].forEach((t, i) => doc.text(t, cols[i] + 1.5, y));
        y += 4.5;
        m.vitales.slice(0, 5).forEach((v, i) => {
            sitio(5.2);
            if (i % 2 === 0) { setFill(ZEBRA); doc.rect(M, y - 3.4, W - 2 * M, 5, 'F'); }
            setText(INK);
            doc.setFont('helvetica', 'normal').setFontSize(7.5);
            doc.text(new Date(v.fecha).toLocaleString('es-PR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Puerto_Rico' }), cols[0] + 1.5, y);
            doc.text(`${v.sistolica}/${v.diastolica}`, cols[1] + 1.5, y);
            doc.text(`${v.pulso} bpm`, cols[2] + 1.5, y);
            doc.text(`${aFahrenheit(v.temperatura) ?? '—'} °F`, cols[3] + 1.5, y);
            doc.text(v.glucosa != null ? String(v.glucosa) : '—', cols[4] + 1.5, y);
            doc.text((doc.splitTextToSize(v.medidoPor ?? '—', W - M - cols[5] - 3) as string[])[0], cols[5] + 1.5, y);
            y += 5;
        });
        y += 3;
    }

    /* ── Medicamentos ──────────────────────────────────────────────────── */
    titulo(`Medicamentos activos — ${m.medicamentos.length}`);
    if (m.medicamentos.length === 0) {
        parrafo('Sin medicamentos activos registrados en el eMAR.', 9, MUTED);
    } else {
        const cols = [M, M + 58, M + 80, M + 100, M + 128];
        const cab = () => {
            setFill(INK); doc.rect(M, y - 3.6, W - 2 * M, 5.6, 'F');
            setText([255, 255, 255]);
            doc.setFont('helvetica', 'bold').setFontSize(7);
            ['MEDICAMENTO', 'DOSIS', 'VÍA', 'FRECUENCIA', 'HORARIO'].forEach((t, i) => doc.text(t, cols[i] + 1.5, y));
            y += 4.5;
        };
        cab();
        m.medicamentos.forEach((md, i) => {
            const antes = pagina;
            sitio(5.2);
            if (pagina !== antes) cab();
            if (i % 2 === 0) { setFill(ZEBRA); doc.rect(M, y - 3.4, W - 2 * M, 5, 'F'); }
            setText(INK);
            doc.setFont('helvetica', 'bold').setFontSize(7.5);
            doc.text((doc.splitTextToSize(md.nombre, 55) as string[])[0], cols[0] + 1.5, y);
            doc.setFont('helvetica', 'normal');
            doc.text(dosisODejarloEnBlanco(md.dosis), cols[1] + 1.5, y);
            doc.text(md.via ?? '—', cols[2] + 1.5, y);
            doc.text(md.frecuencia ?? '—', cols[3] + 1.5, y);
            doc.text((doc.splitTextToSize(md.horario ?? '—', W - M - cols[4] - 3) as string[])[0], cols[4] + 1.5, y);
            y += 5;
        });
        y += 3;
    }

    /* ── A quién llamar ────────────────────────────────────────────────── */
    titulo('A quién llamar');
    if (m.familia.length === 0) {
        parrafo('No hay familiar registrado para este residente.', 9.5, AMBAR, 'bold');
    } else {
        m.familia.slice(0, 4).forEach(f => {
            sitio(6);
            setText(INK);
            doc.setFont('helvetica', 'bold').setFontSize(10);
            doc.text(`${f.nombre}${f.parentesco ? ` — ${f.parentesco}` : ''}`, M, y);
            doc.setFont('helvetica', 'normal').setFontSize(10);
            doc.text(f.telefono ?? 'sin teléfono', W - M, y, { align: 'right' });
            y += 6;
        });
        y += 2;
    }

    /* ── Las tarjetas, al final y cada una en su sitio ─────────────────── */
    const conImagen = m.tarjetas.filter(t => t.imagen);
    const sinImagen = m.tarjetas.filter(t => !t.imagen);
    if (conImagen.length > 0) {
        // Sin forzar página nueva. Forzarla dejaba una hoja con una sola línea
        // —"no hay familiar registrado"— y mandaba las tarjetas a la tercera.
        // `sitio` ya impide que una tarjeta se parta por la mitad.
        sitio(30);
        titulo('Documentos para admisión');
        setText(MUTED);
        doc.setFont('helvetica', 'normal').setFontSize(8);
        doc.text('Lo que pide la ventanilla del hospital.', M, y); y += 6;

        for (const t of conImagen) {
            const altoMax = 62;
            let ancho = W - 2 * M, alto = altoMax;
            try {
                const p = props(t.imagen!);
                const escala = Math.min((W - 2 * M) / p.width, altoMax / p.height);
                ancho = p.width * escala; alto = p.height * escala;
            } catch { continue; }
            const datos = (t.datos ?? []).filter(d => d.campo);
            sitio(alto + 14 + datos.length * 5);
            setText(INK);
            doc.setFont('helvetica', 'bold').setFontSize(9);
            doc.text(t.etiqueta, M, y); y += 4;
            try { doc.addImage(t.imagen!, M, y, ancho, alto); } catch { /* ilegible */ }
            y += alto + 4;
            // EL NÚMERO, ESCRITO. La foto casi nunca se lee.
            for (const d of datos) {
                setText(MUTED);
                doc.setFont('helvetica', 'bold').setFontSize(7);
                doc.text(d.campo.toUpperCase(), M, y);
                setText(d.valor ? INK : AMBAR);
                doc.setFont('helvetica', 'bold').setFontSize(d.valor ? 11 : 8.5);
                doc.text(d.valor || 'no está escrito en el expediente — solo en la foto', M + 34, y);
                y += 5;
            }
            y += 5;
        }
    }
    if (sinImagen.length > 0) {
        sitio(16);
        /**
         * QUE FALTE UNA TARJETA NO ES UN FALLO. Se suben según las consiguen
         * las familias y a veces no las consiguen. Quien está en la ventanilla
         * necesita saber que no la busque — no que alguien hizo algo mal.
         */
        setFill(ZEBRA); setDraw(LINE);
        doc.rect(M, y, W - 2 * M, 13, 'FD');
        setText(MUTED);
        doc.setFont('helvetica', 'normal').setFontSize(8);
        doc.text(`No se ha recibido: ${sinImagen.map(t => t.etiqueta.toLowerCase()).join(', ')}.`, M + 4, y + 5.5);
        doc.setFontSize(7.5);
        doc.text('El hogar las sube según la familia las consigue. No las busque en este documento.', M + 4, y + 10);
        y += 17;
    }

    /* ── Pie con paginación en todas ───────────────────────────────────── */
    const total = pagina;
    for (let p = 1; p <= total; p++) {
        doc.setPage(p);
        pie();
        setText(MUTED);
        doc.setFont('helvetica', 'bold').setFontSize(7);
        doc.text(`Página ${p} de ${total}`, W - M, H - 8.5, { align: 'right' });
    }
    return doc;
}

export function nombreResumenPDF(nombre: string): string {
    const limpio = nombre.trim().replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40);
    return `Resumen_${limpio}_${new Date().toISOString().slice(0, 10)}.pdf`;
}

export function descargarResumenResidentePDF(m: ResumenMeta): void {
    construirResumenResidentePDF(m).save(nombreResumenPDF(m.nombre));
}
