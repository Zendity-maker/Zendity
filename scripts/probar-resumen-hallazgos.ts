/**
 * VER EL RESUMEN DE ATAJOS SIN MANDARSELO A LAS CUIDADORAS.
 *
 *     npx tsx scripts/probar-resumen-hallazgos.ts correo@destino.com
 *     npx tsx scripts/probar-resumen-hallazgos.ts --html /carpeta
 *
 * Manda TODOS los correos que saldrian el lunes a UNA sola direccion, con el
 * asunto marcado [PRUEBA — iria a <nombre>]. No marca nada como avisado y no
 * dispara la campana, asi que el envio real del lunes sale igual.
 *
 * Existe porque este correo no se puede "probar otra vez": el envio de verdad
 * marca los hallazgos AVISADO y ya no vuelven a salir.
 */
import { prisma } from '../src/lib/prisma';
import { enviarResumenHallazgos } from '../src/lib/resumen-hallazgos';

async function main() {
    const arg = process.argv[2];
    const carpeta = arg === '--html' ? (process.argv[3] ?? '.') : null;
    if (!carpeta && !arg?.includes('@')) {
        console.error('Falta el destino.\n  npx tsx scripts/probar-resumen-hallazgos.ts tu@correo.com\n  npx tsx scripts/probar-resumen-hallazgos.ts --html /carpeta');
        process.exit(1);
    }
    const prueba = carpeta ? { escribirEn: carpeta } : { paraCorreo: arg };
    const sedes = await prisma.headquarters.findMany({ where: { isActive: true }, select: { id: true, name: true } });
    for (const s of sedes) {
        const r = await enviarResumenHallazgos(s.id, s.name, { prueba });
        console.log(`${r.sede.padEnd(30)} personas:${r.personas ?? 0}  ${r.saltada ?? ''}`);
    }
    console.log('\nNada quedo marcado. El envio real del lunes 9:30 AM sale igual.');
}
main().finally(() => prisma.$disconnect());
