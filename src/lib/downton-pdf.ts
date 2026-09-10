/**
 * LA HOJA DE DOWNTON, IMPRESA.
 *
 * Pedida por Andrés el 10-sep-2026: "sería bueno poder imprimirla en caso de
 * que fuera necesario." El caso real es el de siempre en un hogar — la
 * inspección que pide el expediente en papel, el médico que quiere verla, la
 * familia que pregunta en qué se basa el protocolo del residente.
 *
 * Una página, siempre. Con los once ítems y lo que se marcó en cada uno, no
 * solo el puntaje: un papel que dice "5 puntos, riesgo alto" y no enseña de
 * dónde salen los 5 no sirve para defender nada.
 *
 * SIN GLIFOS RAROS. jsPDF con helvetica no tiene ☐ ni →: los imprime como
 * basura y sin avisar. Ya pasó tres veces en este proyecto. Aquí las casillas
 * se dibujan con rectángulos y la marca es una X.
 */
import jsPDF from 'jspdf';
import {
    ITEMS, GRUPOS, CORTE_RIESGO_ALTO, MESES_ENTRE_EVALUACIONES,
    type EvaluacionDownton,
} from '@/lib/downton';

const TINTA: [number, number, number] = [18, 33, 29];
const GRIS: [number, number, number] = [100, 116, 139];
const TEAL: [number, number, number] = [15, 110, 86];
const ROJO: [number, number, number] = [190, 24, 60];
const LINEA: [number, number, number] = [221, 228, 223];

const M = 16;          // margen
const W = 210;         // A4 ancho

export interface DatosHoja {
    residente: string;
    habitacion?: string | null;
    sede: string;
    evaluacion: EvaluacionDownton;
    evaluadoPor: string;
    evaluadoEl: Date;
    proximaRevision: Date | null;
}

const fecha = (d: Date) =>
    d.toLocaleDateString('es-PR', { day: 'numeric', month: 'long', year: 'numeric' });

export function generarHojaDownton(m: DatosHoja): jsPDF {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const texto = (c: [number, number, number]) => doc.setTextColor(c[0], c[1], c[2]);
    const relleno = (c: [number, number, number]) => doc.setFillColor(c[0], c[1], c[2]);
    const borde = (c: [number, number, number]) => doc.setDrawColor(c[0], c[1], c[2]);
    let y = M;

    /* ── Cabecera ───────────────────────────────────────────────────── */
    texto(TINTA);
    doc.setFont('helvetica', 'bold').setFontSize(15);
    doc.text('Evaluación de riesgo de caída', M, y);
    y += 6;
    texto(GRIS);
    doc.setFont('helvetica', 'normal').setFontSize(9.5);
    doc.text(`Índice de Downton · ${m.sede}`, M, y);
    y += 8;

    borde(LINEA); doc.setLineWidth(0.3);
    doc.line(M, y, W - M, y);
    y += 7;

    /* ── Quién y cuándo ─────────────────────────────────────────────── */
    texto(TINTA);
    doc.setFont('helvetica', 'bold').setFontSize(12.5);
    doc.text(m.residente + (m.habitacion ? `   ·   Hab. ${m.habitacion}` : ''), M, y);
    y += 6;
    texto(GRIS);
    doc.setFont('helvetica', 'normal').setFontSize(9.5);
    doc.text(`Evaluado el ${fecha(m.evaluadoEl)} por ${m.evaluadoPor}`, M, y);
    y += 4.6;
    if (m.proximaRevision) {
        doc.text(`Se repite el ${fecha(m.proximaRevision)} — cada ${MESES_ENTRE_EVALUACIONES} meses.`, M, y);
        y += 4.6;
    }
    y += 5;

    /* ── Los ítems, agrupados ───────────────────────────────────────── */
    for (const grupo of GRUPOS) {
        texto(GRIS);
        doc.setFont('helvetica', 'bold').setFontSize(8);
        doc.text(grupo.toUpperCase(), M, y);
        y += 5;

        for (const item of ITEMS.filter(i => i.grupo === grupo)) {
            const marcado = !!m.evaluacion.respuestas[item.clave];

            // La casilla, dibujada. Nada de caracteres de casilla.
            borde(marcado ? TEAL : LINEA);
            doc.setLineWidth(marcado ? 0.5 : 0.3);
            doc.rect(M, y - 3.2, 4, 4);
            if (marcado) {
                relleno(TEAL);
                doc.rect(M, y - 3.2, 4, 4, 'F');
                doc.setTextColor(255, 255, 255);
                doc.setFont('helvetica', 'bold').setFontSize(7);
                doc.text('X', M + 1.15, y - 0.2);
            }

            texto(marcado ? TINTA : GRIS);
            doc.setFont('helvetica', marcado ? 'bold' : 'normal').setFontSize(10);
            doc.text(item.texto, M + 7, y);
            y += 6.4;
        }
        y += 2.5;
    }

    /* ── El resultado ───────────────────────────────────────────────── */
    y += 2;
    const alto = m.evaluacion.nivel === 'HIGH';
    const nombreNivel = alto ? 'RIESGO ALTO'
        : m.evaluacion.nivel === 'MODERATE' ? 'RIESGO MODERADO' : 'RIESGO BAJO';

    relleno(alto ? [254, 226, 232] : [241, 247, 244]);
    doc.rect(M, y - 5, W - 2 * M, 16, 'F');
    texto(alto ? ROJO : TEAL);
    doc.setFont('helvetica', 'bold').setFontSize(20);
    doc.text(String(m.evaluacion.puntaje), M + 4, y + 4);
    doc.setFontSize(11);
    doc.text(nombreNivel, M + 18, y + 1);
    texto(GRIS);
    doc.setFont('helvetica', 'normal').setFontSize(8.5);
    doc.text(`de ${ITEMS.length} puntos posibles · desde ${CORTE_RIESGO_ALTO} es riesgo alto`, M + 18, y + 6);
    y += 20;

    /* ── La nota, si la hay ─────────────────────────────────────────── */
    if (m.evaluacion.nota) {
        texto(GRIS);
        doc.setFont('helvetica', 'bold').setFontSize(8);
        doc.text('NOTA DE QUIEN EVALUÓ', M, y);
        y += 5;
        texto(TINTA);
        // El font se fija ANTES de medir: splitTextToSize mide con el que esté
        // activo, y medir con otro parte el texto donde no toca.
        doc.setFont('helvetica', 'normal').setFontSize(10);
        const lineas = doc.splitTextToSize(m.evaluacion.nota, W - 2 * M) as string[];
        lineas.slice(0, 6).forEach(l => { doc.text(l, M, y); y += 5; });
        y += 3;
    }

    /* ── Firma ──────────────────────────────────────────────────────── */
    y = Math.max(y + 6, 250);
    borde(LINEA); doc.setLineWidth(0.3);
    doc.line(M, y, M + 70, y);
    doc.line(W - M - 70, y, W - M, y);
    texto(GRIS);
    doc.setFont('helvetica', 'normal').setFontSize(8);
    doc.text('Quien evaluó', M, y + 4);
    doc.text('Enfermería', W - M - 70, y + 4);

    /* ── Pie: de dónde salió este papel ─────────────────────────────── */
    texto(GRIS);
    doc.setFontSize(7.5);
    doc.text(
        `Generado por Zéndity el ${fecha(m.evaluadoEl)}. Los once ítems son los del índice de Downton.`,
        M, 288,
    );

    return doc;
}

export function nombreDeArchivo(residente: string, el: Date): string {
    // Las tildes y la ñ se transliteran, no se borran: `[^\w]` convertía a
    // "María de los Ángeles" en "Mara_de_los_ngeles", que no es el nombre de
    // nadie y en una carpeta de expedientes no se encuentra.
    const limpio = residente.trim()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '_')
        .replace(/[^A-Za-z0-9_]/g, '');
    return `Riesgo_Caida_${limpio}_${el.toISOString().slice(0, 10)}.pdf`;
}
