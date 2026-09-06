/**
 * VER EL CORREO SEMANAL SIN MANDARLO.
 *
 *     npx tsx scripts/previsualizar-reporte.ts [enfermeria|supervision|direccion]
 *
 * Escribe el cuerpo en /tmp/correo-<canal>.html y lo abre. Existe porque hasta
 * hoy la unica forma de comprobar un cambio de texto en este correo era
 * mandarselo a Celia y a Andres, y un correo que solo se prueba mandandolo se
 * prueba poco.
 *
 * Ademas comprueba la regla que no se puede romper: NINGUN nombre de residente
 * en el cuerpo del correo. Los nombres van en el PDF adjunto.
 *
 * Solo lee. No manda nada y no escribe en la base.
 */
import { prisma } from '../src/lib/prisma';
import { construirReporte } from '../src/lib/reporte-enfermeria';
import { construirReporteSupervision } from '../src/lib/reporte-supervision';
import { construirReporteDireccion } from '../src/lib/reporte-direccion';
import { construirCorreo } from '../src/lib/enviar-reporte';
import { novedadesVigentes, type CanalNovedad } from '../src/lib/novedades';
import { writeFileSync } from 'fs';

const CANALES = {
    enfermeria:  { construir: construirReporte,             entrada: 'Enfermería',            recurso: 'ReporteEnfermeria' },
    supervision: { construir: construirReporteSupervision,   entrada: 'Triage & Supervisión',  recurso: 'ReporteSupervision' },
    direccion:   { construir: construirReporteDireccion,     entrada: 'Insights',              recurso: 'ReporteDireccion' },
} as const;

async function main() {
    const canal = (process.argv[2] ?? 'enfermeria') as CanalNovedad;
    if (!(canal in CANALES)) {
        console.error('Canal inválido. Usa: enfermeria | supervision | direccion');
        process.exit(1);
    }
    const cfg = CANALES[canal];

    const sedes = await prisma.headquarters.findMany({
        where: { isActive: true }, select: { id: true, name: true },
    });

    for (const sede of sedes) {
        const reporte = await cfg.construir(sede.id, sede.name);

        // Las dos razones por las que enviarReporte NO manda. Se dicen aquí
        // también, porque si no, esto enseñaría un correo que nunca sale.
        if (reporte.residentesActivos === 0) { console.log(`— ${sede.name}: no se envía (sin residentes activos)`); continue; }
        if (reporte.totalPendiente === 0)    { console.log(`— ${sede.name}: no se envía (nada pendiente)`); continue; }

        const { subject, html } = construirCorreo(reporte, {
            rutaCron: `/api/cron/reporte-${canal}`, recurso: cfg.recurso, entrada: cfg.entrada, canal,
        });

        // NINGÚN nombre de residente en el cuerpo. Se comprueba contra los
        // residentes reales de la sede, no contra una lista escrita a mano.
        const residentes = await prisma.patient.findMany({
            where: { headquartersId: sede.id, status: 'ACTIVE' }, select: { name: true },
        });
        const fugas = [...new Set(
            residentes.flatMap(r => r.name.split(/\s+/))
                .filter(palabra => palabra.length > 3 && html.includes(palabra)),
        )];

        const ruta = `/tmp/correo-${canal}-${sede.name.replace(/\s+/g, '-').toLowerCase()}.html`;
        writeFileSync(ruta, html);

        console.log(`\n== ${sede.name}`);
        console.log(`   asunto     ${subject}`);
        console.log(`   pendiente  ${reporte.totalPendiente} · residentes ${reporte.residentesActivos}`);
        console.log(`   novedades  ${novedadesVigentes(canal).length} vigentes hoy`);
        console.log(`   PHI        ${fugas.length === 0 ? 'limpio — ningún nombre en el cuerpo' : `FUGA: ${fugas.join(', ')}`}`);
        console.log(`   cuerpo     ${ruta}`);
    }
}

main().finally(() => prisma.$disconnect());
