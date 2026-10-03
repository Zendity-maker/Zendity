/**
 * MIRAR EL PDF DEL RESUMEN EJECUTIVO SIN DESCARGARLO.
 *
 * ═══ POR QUÉ EXISTE ═══
 *
 * El 03-oct-2026 se corrigieron seis cifras de este informe. `tsc --noEmit`
 * pasó limpio, el JSON del endpoint traía los números correctos, y el PDF salía
 * con tres defectos que **solo se ven mirándolo**:
 *
 *   · «Meds administrados: 7399Sin administrar: 273» — dos cifras pegadas, sin
 *     separación. `detailLine` repartía el ancho sin comprobar que cupiera.
 *   · «Período: 03 sept 2026 !' 03 oct 2026» — la flecha `→` no existe en las
 *     helvetica que jsPDF trae de serie. En la primera línea del documento.
 *   · Tres subtítulos cortados a media palabra.
 *
 * Ninguno de los tres se ve en el JSON, ni en los tipos, ni en la base. El
 * informe es un PDF que el director descarga y archiva: la única comprobación
 * que vale es abrirlo.
 *
 * ═══ EL TRUCO, QUE NO ES OBVIO ═══
 *
 * `generateExecReportPDF` termina en `doc.save(...)`, que en el navegador abre
 * una descarga y en Node no hace nada útil. Parchear `jsPDF.prototype.save` NO
 * basta: jsPDF define sus métodos en `jsPDF.API` y los copia al construir, así
 * que el parche del prototype se pierde. Hay que parchear los dos.
 *
 * ═══ CÓMO SE USA ═══
 *
 *     # 1. Sacar el payload del endpoint (en la consola del navegador, con
 *     #    sesión abierta contra el servidor de desarrollo):
 *     #      await (await fetch('/api/corporate/exec-report?period=month')).json()
 *     #    y guardarlo en un .json
 *
 *     npx tsx scripts/ver-resumen-ejecutivo.ts payload.json salida.pdf
 *     qlmanage -t -s 1700 -o . salida.pdf     # a PNG, para mirarlo
 *
 * El PDF lleva nombres de residentes y de personal: se genera FUERA del repo
 * (`/*.pdf` está en .gitignore por esto mismo) y no se versiona.
 */
import { readFileSync, writeFileSync } from 'fs';
import { jsPDF } from 'jspdf';

const [, , entrada, salida] = process.argv;
if (!entrada || !salida) {
    console.error('Uso: npx tsx scripts/ver-resumen-ejecutivo.ts <payload.json> <salida.pdf>');
    process.exit(1);
}

const escribir = function (this: jsPDF) {
    writeFileSync(salida, Buffer.from(this.output('arraybuffer')));
    console.log(`PDF escrito: ${salida}`);
};
// Los dos, por lo dicho arriba.
(jsPDF as unknown as { API: Record<string, unknown> }).API.save = escribir;
(jsPDF.prototype as unknown as Record<string, unknown>).save = escribir;

(async () => {
    const { generateExecReportPDF } = await import('@/lib/exec-report-pdf');
    generateExecReportPDF(JSON.parse(readFileSync(entrada, 'utf8')));
})();
