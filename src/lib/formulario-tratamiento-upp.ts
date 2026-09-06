/**
 * EL PLAN DE TRATAMIENTO, EN PAPEL, PARA QUE LO ESCRIBA QUIEN LO DECIDE
 * ────────────────────────────────────────────────────────────────────
 * La enfermera del home care viene, cura, y el tratamiento se lo lleva puesto.
 * El hogar hace continuidad de un plan que nunca vio escrito: la cuidadora que
 * cambia un apósito a las tres de la mañana no tiene qué leer, y quien registra
 * la curación tampoco.
 *
 * Esto es una hoja para que ELLA lo deje escrito antes de irse, la firme, y se
 * entregue en enfermería. De ahí se transcribe al sistema en un minuto.
 *
 * POR QUÉ EN PAPEL Y NO UNA PANTALLA. Ella no tiene cuenta en Zéndity, viene de
 * otra organización, y pedirle que aprenda un sistema ajeno para dejar cuatro
 * líneas es la forma de que no deje ninguna. Cuando se active la tableta de
 * servicios externos esto se podrá capturar allí; hasta entonces, papel.
 *
 * VA PRERRELLENADO CON LO QUE EL HOGAR YA SABE —residente, dónde está la úlcera,
 * estadio— para que ella no escriba lo que ya está escrito y para que no haya
 * dos versiones de la misma úlcera. Lo que se le pide es lo único que solo ella
 * puede dar: qué producto, cada cuánto, cómo se limpia, qué vigilar.
 *
 * EL ESTADIO LO PUEDE CORREGIR. Es lo suyo, y si el hogar lo clasificó mal, el
 * papel tiene que dejarla decirlo en vez de obligarla a firmar debajo.
 */
import jsPDF from 'jspdf';

const TEAL: [number, number, number] = [15, 110, 86];
const INK: [number, number, number] = [31, 45, 58];
const MUTED: [number, number, number] = [100, 116, 139];
const LINE: [number, number, number] = [203, 213, 225];
const ROJO: [number, number, number] = [190, 18, 60];
const ROJO_BG: [number, number, number] = [254, 226, 226];
const M = 16;

export interface FormularioUpp {
    hogar: { nombre: string; telefono?: string | null; direccion?: string | null; logo?: string | null };
    /** Nulo = hoja en blanco, para tener sueltas impresas. */
    residente?: {
        nombre: string;
        habitacion?: string | null;
        localizacion: string;
        estadio: number;
        identificadaAt: Date;
        /** Lo que ya hubiera escrito, para que ella corrija en vez de repetir. */
        planActual?: string | null;
    } | null;
    generadoAt: Date;
}

export function generarFormularioUppPDF(f: FormularioUpp): jsPDF {
    const doc = new jsPDF({ unit: 'mm', format: 'letter' });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const setFill = (c: [number, number, number]) => doc.setFillColor(c[0], c[1], c[2]);
    const setText = (c: [number, number, number]) => doc.setTextColor(c[0], c[1], c[2]);
    const setDraw = (c: [number, number, number]) => doc.setDrawColor(c[0], c[1], c[2]);

    let y = 0;

    /* ── Membrete del hogar ──────────────────────────────────────────── */
    setFill(INK);
    doc.rect(0, 0, W, 22, 'F');
    setText([255, 255, 255]);
    doc.setFont('helvetica', 'bold').setFontSize(13);
    doc.text('PLAN DE TRATAMIENTO DE ÚLCERA', M, 10);
    doc.setFont('helvetica', 'normal').setFontSize(8);
    doc.text('A completar por la enfermera de servicios externos / home care', M, 16.5);
    doc.setFont('helvetica', 'bold').setFontSize(9);
    doc.text(f.hogar.nombre, W - M, 10, { align: 'right' });
    doc.setFont('helvetica', 'normal').setFontSize(7.5);
    doc.text([f.hogar.direccion, f.hogar.telefono].filter(Boolean).join(' · '), W - M, 16.5, { align: 'right' });
    y = 28;

    if (f.hogar.logo) {
        try {
            const props = (doc as unknown as { getImageProperties: (d: string) => { width: number; height: number } })
                .getImageProperties(f.hogar.logo);
            const alto = 10;
            doc.addImage(f.hogar.logo, M, y - 2, (props.width / props.height) * alto, alto);
            y += alto + 2;
        } catch { /* un logo ilegible no puede tumbar la hoja */ }
    }

    /* ── Quién y cuál úlcera ─────────────────────────────────────────── */
    const campo = (etiqueta: string, valor: string | null, x: number, ancho: number) => {
        setText(MUTED);
        doc.setFont('helvetica', 'bold').setFontSize(7);
        doc.text(etiqueta.toUpperCase(), x, y);
        setDraw(LINE);
        doc.setLineWidth(0.3);
        doc.line(x, y + 6.5, x + ancho, y + 6.5);
        if (valor) {
            setText(INK);
            doc.setFont('helvetica', 'bold').setFontSize(11);
            doc.text(doc.splitTextToSize(valor, ancho)[0] as string, x, y + 5);
        }
    };

    const r = f.residente ?? null;
    campo('Residente', r?.nombre ?? null, M, 108);
    campo('Habitación', r?.habitacion ?? null, M + 114, W - M - (M + 114));
    y += 14;
    campo('Localización de la úlcera', r?.localizacion ?? null, M, 108);
    campo('Estadio', r ? String(r.estadio) : null, M + 114, 20);
    campo('Fecha', null, M + 140, W - M - (M + 140));
    y += 12;

    if (r) {
        setText(MUTED);
        doc.setFont('helvetica', 'italic').setFontSize(7.5);
        doc.text(
            `Identificada el ${r.identificadaAt.toLocaleDateString('es-PR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'America/Puerto_Rico' })}`
            + '. Si el estadio no coincide con lo que usted observa, corríjalo — su clasificación es la que vale.',
            M, y,
        );
        y += 6;
    } else {
        y += 2;
    }

    /* ── Lo que solo ella puede dar ──────────────────────────────────── */
    const bloque = (titulo: string, ayuda: string, lineas: number) => {
        setText(TEAL);
        doc.setFont('helvetica', 'bold').setFontSize(8.5);
        const T = titulo.toUpperCase();
        doc.text(T, M, y);
        // El ancho se mide CON LA FUENTE DEL TÍTULO. Medirlo después de cambiar
        // a la cursiva de 7 daba un ancho menor y la ayuda se comía el título.
        const anchoTitulo = doc.getTextWidth(T);
        setText(MUTED);
        doc.setFont('helvetica', 'italic').setFontSize(7);
        doc.text(ayuda, M + anchoTitulo + 5, y);
        y += 5.5;
        setDraw(LINE);
        doc.setLineWidth(0.25);
        for (let i = 0; i < lineas; i++) { doc.line(M, y, W - M, y); y += 7; }
        y += 3;
    };

    bloque('Producto y material', 'qué apósito, qué solución, qué se aplica', 2);
    bloque('Frecuencia', 'cada cuántos días, o cuándo cambiarlo', 1);
    bloque('Técnica de limpieza', 'cómo se limpia antes de tapar', 2);
    bloque('Qué vigilar y cuándo llamar', 'señales que obligan a avisarle antes de la próxima visita', 3);

    /* ── Lo que el hogar puede y no puede hacer ──────────────────────── */
    setFill(ROJO_BG); setDraw(ROJO);
    doc.setLineWidth(0.6);
    doc.rect(M, y, W - 2 * M, 20, 'FD');
    doc.setLineWidth(0.2);
    setText(ROJO);
    doc.setFont('helvetica', 'bold').setFontSize(8);
    doc.text('QUÉ PUEDE HACER EL PERSONAL DEL HOGAR ENTRE SUS VISITAS', M + 4, y + 6);
    doc.setFont('helvetica', 'normal').setFontSize(8);
    doc.text(
        'Las cuidadoras limpian y tapan cuando el apósito se ensucia o se despega, y lo registran. NO aplican',
        M + 4, y + 11.5,
    );
    doc.text(
        'tratamiento. Si algo de lo anterior cambia eso, escríbalo aquí:',
        M + 4, y + 16,
    );
    y += 23;
    setDraw(LINE);
    doc.setLineWidth(0.25);
    for (let i = 0; i < 2; i++) { doc.line(M, y, W - M, y); y += 7; }
    y += 4;

    /* ── Firma ───────────────────────────────────────────────────────── */
    setDraw(LINE);
    doc.setLineWidth(0.3);
    const mitad = (W - 2 * M - 8) / 2;
    doc.line(M, y + 14, M + mitad, y + 14);
    doc.line(M + mitad + 8, y + 14, W - M, y + 14);
    setText(MUTED);
    doc.setFont('helvetica', 'bold').setFontSize(7);
    doc.text('NOMBRE Y LICENCIA DE LA ENFERMERA', M, y + 18);
    doc.text('FIRMA', M + mitad + 8, y + 18);
    y += 24;
    doc.line(M, y + 14, M + mitad, y + 14);
    doc.line(M + mitad + 8, y + 14, W - M, y + 14);
    doc.text('AGENCIA / HOME CARE', M, y + 18);
    doc.text('PRÓXIMA VISITA', M + mitad + 8, y + 18);

    /* ── Qué hacer con esta hoja ─────────────────────────────────────── */
    setText(INK);
    doc.setFont('helvetica', 'bold').setFontSize(8);
    doc.text('ENTREGAR ESTA HOJA EN ENFERMERÍA DEL HOGAR.', M, H - 22);
    setText(MUTED);
    doc.setFont('helvetica', 'normal').setFontSize(7.5);
    doc.text(
        'Enfermería lo transcribe al expediente digital el mismo día, y a partir de ahí cualquier cuidadora que',
        M, H - 18,
    );
    doc.text(
        'tenga que cambiar el apósito lo lee en su tableta antes de tocar al residente.',
        M, H - 14.5,
    );
    setDraw(LINE);
    doc.line(M, H - 11, W - M, H - 11);
    doc.setFontSize(7);
    doc.text(
        `${f.hogar.nombre}${f.hogar.telefono ? ` · ${f.hogar.telefono}` : ''}`,
        M, H - 7,
    );
    setText(TEAL);
    doc.setFont('helvetica', 'bold');
    doc.text('ZÉNDITY · zendity.com', W - M, H - 7, { align: 'right' });

    return doc;
}

/** El nombre del archivo que ve quien lo descarga. */
export function nombreFormularioUpp(residente: string | null | undefined): string {
    const limpio = (residente ?? 'en-blanco').trim().replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40);
    return `Plan_Tratamiento_UPP_${limpio}_${new Date().toISOString().slice(0, 10)}.pdf`;
}

/** Genera y descarga. Es lo que llama el botón de la pantalla. */
export function descargarFormularioUppPDF(f: FormularioUpp): void {
    generarFormularioUppPDF(f).save(nombreFormularioUpp(f.residente?.nombre));
}
