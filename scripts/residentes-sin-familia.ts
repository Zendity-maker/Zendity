/**
 * Lista los residentes activos que no tienen ningun familiar en Zendity.
 *
 * Es el cuello de botella real de la comunicacion con familias: por muy bien
 * que enfermeria escriba cada 15 dias, a estos no se les puede mandar nada.
 * En Cupey son 19 de 33 residentes activos — el 58%.
 *
 * No es solo herencia de la carga inicial. De los 9 ingresos posteriores, 5
 * entraron sin familiar, incluidos los tres mas recientes: el paso 5 del
 * wizard de admision tiene su propio boton de guardado y la admision se
 * completa igual sin pulsarlo.
 *
 * Uso:
 *   cd ~/Desktop/Zendity && DATABASE_URL="$(grep -m1 '^DATABASE_URL=' .env | cut -d= -f2- | tr -d '"')" npx tsx scripts/residentes-sin-familia.ts
 *
 * Con CSV para repartir el trabajo:
 *   ... npx tsx scripts/residentes-sin-familia.ts --csv ~/Desktop/residentes-sin-familia.csv
 */
import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'fs';

const prisma = new PrismaClient();
const CSV = process.argv.includes('--csv') ? process.argv[process.argv.indexOf('--csv') + 1] : null;

async function main() {
    const sedes = await prisma.headquarters.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
    });

    const filas: any[] = [];

    for (const sede of sedes) {
        const sin = await prisma.patient.findMany({
            where: { headquartersId: sede.id, status: 'ACTIVE', familyMembers: { none: {} } },
            select: { name: true, roomNumber: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
        });
        const total = await prisma.patient.count({
            where: { headquartersId: sede.id, status: 'ACTIVE' },
        });

        console.log(`\n${sede.name}`);
        console.log(`   ${sin.length} de ${total} residentes activos sin familiar registrado (${Math.round(sin.length * 100 / total)}%)\n`);
        console.log(`   HAB.    RESIDENTE                        EN EL HOGAR`);
        console.log(`   ─────   ──────────────────────────────   ───────────`);

        for (const r of sin) {
            const dias = Math.floor((Date.now() - r.createdAt.getTime()) / 86400000);
            // Los de la carga inicial y los que ingresaron despues son dos
            // problemas distintos: los recientes prueban que la fuga sigue
            // abierta en admision.
            const origen = dias >= 90 ? 'carga inicial' : 'ingreso reciente';
            console.log(`   ${(r.roomNumber || 's/h').padEnd(7)} ${r.name.trim().padEnd(32)} ${String(dias).padStart(3)} dias  (${origen})`);
            filas.push({
                sede: sede.name,
                habitacion: r.roomNumber || '',
                residente: r.name.trim(),
                diasEnElHogar: dias,
                origen,
            });
        }
    }

    if (CSV) {
        const cab = 'Sede,Habitacion,Residente,Dias en el hogar,Origen,Nombre del familiar,Telefono,Email,Contactado por,Fecha\n';
        const cuerpo = filas.map(f =>
            `"${f.sede}","${f.habitacion}","${f.residente}",${f.diasEnElHogar},"${f.origen}","","","","",""`
        ).join('\n');
        writeFileSync(CSV, cab + cuerpo + '\n');
        console.log(`\nCSV escrito en ${CSV}`);
        console.log('Trae columnas vacias para anotar el contacto segun se vaya consiguiendo.');
    }
}

main()
    .catch(e => { console.error('Error:', e); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
