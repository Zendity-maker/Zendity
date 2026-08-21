/**
 * Muestra las señales clínicas detectadas hoy, sin escribir ni notificar nada.
 *
 * Sirve para calibrar: una detección que marca a todo el mundo no sirve, y una
 * que no marca a nadie tampoco. Correr esto antes de encender el cron.
 *
 * Uso: DATABASE_URL="..." npx tsx scripts/ver-senales-clinicas.ts [dias]
 */
import { PrismaClient } from '@prisma/client';
import { detectarSenales } from '../src/lib/clinical-signals';

const prisma = new PrismaClient();
const DIAS = parseInt(process.argv[2] ?? '7', 10);

async function main() {
    const sedes = await prisma.headquarters.findMany({ select: { id: true, name: true } });
    for (const hq of sedes) {
        const total = await prisma.patient.count({
            where: { headquartersId: hq.id, status: { in: ['ACTIVE', 'TEMPORARY_LEAVE'] } },
        });
        const res = await detectarSenales(hq.id, DIAS);
        console.log(`\n══ ${hq.name} — ${res.length} de ${total} residentes con señales (ventana ${DIAS}d)\n`);
        for (const r of res) {
            const rev = r.senales.filter(s => s.gravedad === 'REVISAR').length;
            console.log(`${rev > 0 ? '🔴' : '🟠'} ${r.nombre}`);
            for (const s of r.senales) {
                console.log(`     ${s.gravedad === 'REVISAR' ? '·' : '∘'} ${s.titulo}`);
                for (const e of s.evidencia) console.log(`         ${e}`);
            }
        }
        const conRevisar = res.filter(r => r.senales.some(s => s.gravedad === 'REVISAR')).length;
        console.log(`\n   Para revisar: ${conRevisar} · Solo vigilar: ${res.length - conRevisar}`);
    }
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
