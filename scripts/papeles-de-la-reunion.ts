/**
 * LOS PAPELES DE LA REUNIÓN DEL LUNES
 *
 *     npx tsx scripts/papeles-de-la-reunion.ts [carpeta]
 *
 * Tres cosas, contra la base de producción de verdad:
 *
 *   1. HOJA DE RUTA DE LA PIEL — los reportes que esperan decisión de Celia,
 *      cada uno con la nota literal de quien lo vio y sitio para escribir qué
 *      encontró. Es un documento de TRABAJO: se llena con el residente delante.
 *   2. FORMULARIOS DE TRATAMIENTO — uno por úlcera abierta, prerrellenado, para
 *      que la enfermera del home care deje el plan escrito. Más dos en blanco.
 *   3. Las guías por rol salen aparte: scripts/guia-cambios-sep2026-b.ts
 *
 * TODO LLEVA NOMBRES: es PHI. Se imprime para la reunión y se archiva o se
 * destruye. No se manda por correo.
 */
import { writeFileSync } from 'fs';
import { join } from 'path';
import jsPDF from 'jspdf';
import { prisma } from '../src/lib/prisma';
import { generarFormularioUppPDF } from '../src/lib/formulario-tratamiento-upp';

const HQ = 'a792f420-07a5-4088-8097-5ef47ca05ac8';
const TEAL: [number, number, number] = [15, 110, 86];
const INK: [number, number, number] = [31, 45, 58];
const MUTED: [number, number, number] = [100, 116, 139];
const LINE: [number, number, number] = [203, 213, 225];
const AMBAR_BG: [number, number, number] = [255, 251, 235];
const AMBAR: [number, number, number] = [180, 83, 9];
const M = 16;

interface Fila {
    nombre: string;
    habitacion: string | null;
    nota: string;
    porQuien: string;
    fecha: Date;
    dias: number;
}

function hojaDeRuta(hogar: string, filas: Fila[], generadoAt: Date): jsPDF {
    const doc = new jsPDF({ unit: 'mm', format: 'letter' });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const setFill = (c: [number, number, number]) => doc.setFillColor(c[0], c[1], c[2]);
    const setText = (c: [number, number, number]) => doc.setTextColor(c[0], c[1], c[2]);
    const setDraw = (c: [number, number, number]) => doc.setDrawColor(c[0], c[1], c[2]);

    let pagina = 0;
    let y = 0;

    const abrir = () => {
        if (pagina > 0) doc.addPage();
        pagina++;
        setFill(INK);
        doc.rect(0, 0, W, pagina === 1 ? 24 : 15, 'F');
        setText([255, 255, 255]);
        doc.setFont('helvetica', 'bold').setFontSize(pagina === 1 ? 14 : 10);
        doc.text('PIEL REPORTADA — PENDIENTE DE DECIDIR', M, pagina === 1 ? 11 : 9);
        doc.setFont('helvetica', 'normal').setFontSize(pagina === 1 ? 8 : 7);
        doc.text(hogar, M, pagina === 1 ? 18 : 13);
        doc.setFontSize(7.5);
        doc.text(generadoAt.toLocaleDateString('es-PR', { dateStyle: 'long', timeZone: 'America/Puerto_Rico' }), W - M, pagina === 1 ? 11 : 9, { align: 'right' });
        y = pagina === 1 ? 30 : 21;
    };

    abrir();

    setText(INK);
    doc.setFont('helvetica', 'normal').setFontSize(9.5);
    for (const ln of doc.splitTextToSize(
        'Cada línea es algo que alguien del piso vio y escribió, y que nunca llegó al módulo de úlceras. '
        + 'No son úlceras hasta que usted las vea: un texto de mayo no dice si hay lesión ni en qué estadio. '
        + 'Lo que sí dice es que alguien miró y le pareció que había algo.',
        W - 2 * M) as string[]) { doc.text(ln, M, y); y += 4.6; }
    y += 4;

    filas.forEach((f, i) => {
        const notaLineas = doc.splitTextToSize(`"${f.nota}"`, W - 2 * M - 8) as string[];
        const alto = 30 + notaLineas.length * 4.3 + 26;
        if (y + alto > H - 18) abrir();

        setDraw(LINE); doc.setLineWidth(0.4);
        doc.rect(M, y, W - 2 * M, alto - 4);
        doc.setLineWidth(0.2);

        setText(INK);
        doc.setFont('helvetica', 'bold').setFontSize(12);
        doc.text(`${i + 1}.  ${f.nombre}`, M + 4, y + 8);
        setText(MUTED);
        doc.setFont('helvetica', 'normal').setFontSize(8);
        doc.text(
            [f.habitacion ? `Hab. ${f.habitacion}` : null,
             `reportado por ${f.porQuien}`,
             f.fecha.toLocaleDateString('es-PR', { day: '2-digit', month: 'long', timeZone: 'America/Puerto_Rico' })]
                .filter(Boolean).join('  ·  '),
            M + 4, y + 13.5,
        );
        // Los días son lo que duele y por eso van grandes y a la derecha.
        setText(f.dias >= 60 ? AMBAR : MUTED);
        doc.setFont('helvetica', 'bold').setFontSize(13);
        doc.text(`${f.dias} d`, W - M - 4, y + 9, { align: 'right' });

        let yy = y + 20;
        setFill(AMBAR_BG);
        doc.rect(M + 4, yy - 4, W - 2 * M - 8, notaLineas.length * 4.3 + 5, 'F');
        setText([120, 80, 10]);
        doc.setFont('helvetica', 'italic').setFontSize(8.5);
        for (const ln of notaLineas) { doc.text(ln, M + 7, yy); yy += 4.3; }
        yy += 5;

        setText(MUTED);
        doc.setFont('helvetica', 'bold').setFontSize(6.5);
        doc.text('QUÉ ENCONTRÓ', M + 4, yy);
        setDraw(LINE);
        doc.line(M + 4, yy + 5, W - M - 4, yy + 5);
        doc.line(M + 4, yy + 12, W - M - 4, yy + 12);
        yy += 18;
        doc.setFont('helvetica', 'bold').setFontSize(6.5);
        setText(MUTED);
        doc.text('DECISIÓN', M + 4, yy);
        // Las casillas se DIBUJAN. El caracter ☐ no existe en las fuentes
        // estandar de jsPDF y salia impreso como un "&".
        const casilla = (x: number) => { setDraw(INK); doc.setLineWidth(0.4); doc.rect(x, yy - 3.2, 3.6, 3.6); doc.setLineWidth(0.2); };
        doc.setFont('helvetica', 'normal').setFontSize(9);
        setText(INK);
        casilla(M + 26);
        doc.text('Es úlcera — estadio ____   localización ____________________', M + 31.5, yy);
        casilla(W - M - 36);
        doc.text('No es úlcera', W - M - 30.5, yy);

        y += alto;
    });

    setText(MUTED);
    doc.setFont('helvetica', 'italic').setFontSize(7.5);
    doc.text(
        'Al volver: lo marcado como úlcera se declara en Rotación / UPP, bloque morado. Lo descartado se cierra ahí mismo con su razón, y le llega a quien lo reportó.',
        M, H - 12,
    );
    setText(TEAL);
    doc.setFont('helvetica', 'bold').setFontSize(7.5);
    doc.text('ZÉNDITY', W - M, H - 7, { align: 'right' });
    setText(MUTED);
    doc.setFont('helvetica', 'normal');
    doc.text(`${hogar} · documento clínico con datos de residentes`, M, H - 7);

    return doc;
}

async function main() {
    const destino = process.argv[2] ?? '.';
    const sede = await prisma.headquarters.findUniqueOrThrow({
        where: { id: HQ },
        select: { name: true, phone: true, address: true, billingAddress: true, logoUrl: true },
    });
    const hogar = {
        nombre: sede.name,
        telefono: sede.phone,
        direccion: sede.address ?? sede.billingAddress,
        logo: sede.logoUrl,
    };
    const ahora = new Date();

    /* 1 — La hoja de ruta */
    const piel = await prisma.cambioDeCondicion.findMany({
        where: { headquartersId: HQ, area: 'PIEL', revisadoAt: null },
        orderBy: { reportadoAt: 'asc' },
        select: { descripcion: true, reportadoAt: true, reportadoPorId: true,
            patient: { select: { name: true, roomNumber: true } } },
    });
    const autores = await prisma.user.findMany({
        where: { id: { in: [...new Set(piel.map(p => p.reportadoPorId))] } },
        select: { id: true, name: true },
    });
    const quien = new Map(autores.map(a => [a.id, a.name]));
    const filas: Fila[] = piel.map(p => ({
        nombre: p.patient.name.trim(),
        habitacion: p.patient.roomNumber,
        nota: p.descripcion.trim(),
        porQuien: (quien.get(p.reportadoPorId) ?? 'personal').trim(),
        fecha: p.reportadoAt,
        dias: Math.floor((Date.now() - p.reportadoAt.getTime()) / 86400000),
    }));

    if (filas.length) {
        const ruta = join(destino, 'hoja-de-ruta-piel.pdf');
        writeFileSync(ruta, Buffer.from(hojaDeRuta(sede.name, filas, ahora).output('arraybuffer')));
        console.log(`Hoja de ruta            ${filas.length} residentes  ->  ${ruta}`);
    } else {
        console.log('Hoja de ruta            no hay reportes de piel pendientes');
    }

    /* 2 — Un formulario por úlcera abierta, prerrellenado */
    const ulceras = await prisma.pressureUlcer.findMany({
        where: { patient: { headquartersId: HQ }, status: { in: ['ACTIVE', 'HEALING'] } },
        select: { bodyLocation: true, stage: true, identifiedAt: true, planTratamiento: true,
            patient: { select: { name: true, roomNumber: true } } },
        orderBy: { stage: 'desc' },
    });
    for (const u of ulceras) {
        const doc = generarFormularioUppPDF({
            hogar,
            residente: {
                nombre: u.patient.name.trim(),
                habitacion: u.patient.roomNumber,
                localizacion: u.bodyLocation,
                estadio: u.stage,
                identificadaAt: u.identifiedAt,
                planActual: u.planTratamiento,
            },
            generadoAt: ahora,
        });
        const slug = u.patient.name.trim().split(/\s+/).slice(0, 2).join('-').toLowerCase().replace(/[^a-z0-9-]/g, '');
        const ruta = join(destino, `tratamiento-${slug}.pdf`);
        writeFileSync(ruta, Buffer.from(doc.output('arraybuffer')));
        console.log(`Formulario              ${u.patient.name.trim().padEnd(24)} E${u.stage}  ->  ${ruta}`);
    }

    /* 3 — Dos en blanco, para las que aparezcan */
    const blanco = join(destino, 'tratamiento-EN-BLANCO.pdf');
    writeFileSync(blanco, Buffer.from(generarFormularioUppPDF({ hogar, residente: null, generadoAt: ahora }).output('arraybuffer')));
    console.log(`Formulario en blanco    para imprimir sueltas  ->  ${blanco}`);

    console.log('\nTodo lleva nombres de residentes: es PHI. Para la reunión, no por correo.');
}
main().finally(() => prisma.$disconnect());
