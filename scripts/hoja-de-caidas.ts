/**
 * LAS CAÍDAS QUE ESTÁN EN UNA NOTA Y NO EN EL MÓDULO
 *
 *     npx tsx scripts/hoja-de-caidas.ts [carpeta]
 *
 * El chequeo CAIDAS_FUERA_DEL_MODULO ya las señala cada lunes en el reporte de
 * enfermería, con nombre. Lo que no puede hacer el sistema es registrarlas: para
 * eso hace falta saber dónde ocurrió, si estaba consciente, si sangraba y qué se
 * hizo — y eso solo lo sabe quien estuvo, o quien pueda preguntárselo.
 *
 * Esta hoja lleva la NOTA LITERAL de cada una y los huecos exactos que pide el
 * formulario de la app, para llenarla a mano y transcribirla de una sentada.
 *
 * NO DECIDE SI FUE CAÍDA. Trae candidatas —la búsqueda por texto no distingue
 * "se cayó" de "casi se cae", y "postura encorvada para evitar caídas" no es un
 * evento— así que la primera casilla de cada una es esa pregunta. Marcar "no
 * fue caída" es una respuesta legítima y también hay que anotarla.
 */
import { writeFileSync } from 'fs';
import { join } from 'path';
import { prisma } from '../src/lib/prisma';
import { generarHojaDeTrabajo, type ItemDeTrabajo } from '../src/lib/hoja-de-trabajo-pdf';

const HQ = 'a792f420-07a5-4088-8097-5ef47ca05ac8';
const DIAS = 30;
const CAIDA = /\bca[ií]d[ao]s?\b|\bse cay[oó]\b|\bse resbal|\bse tropez|\bcay[oó] al\b/i;

async function main() {
    const destino = process.argv[2] ?? '.';
    const desde = new Date(Date.now() - DIAS * 86400000);
    const sede = await prisma.headquarters.findUniqueOrThrow({ where: { id: HQ }, select: { name: true } });

    const logs = await prisma.dailyLog.findMany({
        where: { patient: { headquartersId: HQ }, createdAt: { gte: desde } },
        select: {
            createdAt: true, notes: true,
            patient: { select: { id: true, name: true, roomNumber: true } },
            author: { select: { name: true } },
        },
        orderBy: { createdAt: 'asc' },
    });
    const candidatas = logs.filter(l => CAIDA.test(l.notes ?? ''));

    // Las que YA están en el módulo no van a la hoja: registrar dos veces la
    // misma caída es tan falso como no registrarla.
    const registradas = await prisma.fallIncident.findMany({
        where: { patient: { headquartersId: HQ }, incidentDate: { gte: desde } },
        select: { patientId: true, incidentDate: true },
    });
    const sinRegistrar = candidatas.filter(l =>
        !registradas.some(f => f.patientId === l.patient.id
            && Math.abs(f.incidentDate.getTime() - l.createdAt.getTime()) < 2 * 86400000),
    );

    if (sinRegistrar.length === 0) {
        console.log('No hay caídas en notas sin su registro. Nada que imprimir.');
        return;
    }

    const items: ItemDeTrabajo[] = sinRegistrar.map(l => {
        const dias = Math.floor((Date.now() - l.createdAt.getTime()) / 86400000);
        return {
            titulo: l.patient.name.trim(),
            subtitulo: [
                l.patient.roomNumber ? `Hab. ${l.patient.roomNumber}` : null,
                `escrito por ${(l.author?.name ?? 'personal').trim()}`,
                l.createdAt.toLocaleString('es-PR', { day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'America/Puerto_Rico' }),
            ].filter(Boolean).join('  ·  '),
            cita: (l.notes ?? '').replace(/^\[[^\]]+\]\s*/, '').replace(/\s+/g, ' ').trim(),
            marca: `${dias} d`,
            marcaUrgente: dias >= 14,
            campos: [
                { etiqueta: '¿Fue una caída?', opciones: ['Sí', 'No — no se registra'] },
                // Emparejados de dos en dos: sin esto cada caída ocupaba una
                // hoja entera y cuatro caídas eran cuatro páginas.
                { etiqueta: '¿Estaba consciente?', opciones: ['Sí', 'No'], corto: true },
                { etiqueta: '¿Hubo sangrado?', opciones: ['Sí', 'No'], corto: true },
                { etiqueta: '¿Dónde ocurrió?', lineas: 1, corto: true },
                { etiqueta: 'Dolor de 0 a 10', lineas: 1, corto: true },
                { etiqueta: 'Qué se hizo', lineas: 2 },
            ],
        };
    });

    const doc = generarHojaDeTrabajo({
        titulo: 'Caídas por registrar',
        hogar: sede.name,
        entradilla:
            `Cada una es una caída que alguien escribió en una nota de turno y que NO está en el módulo `
            + `de caídas. Mientras no esté, no cuenta para su riesgo de caídas, no dispara la revisión, y el `
            + `número que da el hogar es falso. Son candidatas: la búsqueda por texto no distingue una caída `
            + `de un amago, así que la primera pregunta de cada una es si lo fue.`,
        cierre:
            'Al volver: las marcadas como caída se registran en la app — botón de Caída en la tableta, o '
            + 'Incidentes. Las marcadas "no fue caída" también se anotan, para que la próxima revisión no las '
            + 'vuelva a levantar.',
        items,
        generadoAt: new Date(),
    });

    const ruta = join(destino, 'hoja-caidas-por-registrar.pdf');
    writeFileSync(ruta, Buffer.from(doc.output('arraybuffer')));
    console.log(`${sinRegistrar.length} caídas candidatas  ->  ${ruta}`);
    sinRegistrar.forEach(l => console.log(`   ${l.createdAt.toISOString().slice(0,10)} ${l.patient.name.trim()}`));
}
main().finally(() => prisma.$disconnect());
