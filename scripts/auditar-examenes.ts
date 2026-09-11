/** SOLO LEE. ¿Qué cursos se pueden aprobar sin leer? Catálogo completo. */
import { prisma } from '../src/lib/prisma';
const HQ = 'a792f420-07a5-4088-8097-5ef47ca05ac8';

function parseQuestions(raw: string) {
    const out: { correctIndex: number; options: string[] }[] = [];
    for (const block of raw.split(/(?=P:\s)/)) {
        if (!block.trim().startsWith('P:')) continue;
        const lines = block.trim().split('\n');
        const question = lines[0].replace(/^P:\s*/, '').trim();
        const options: string[] = []; let correctIndex = -1;
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line || line.startsWith('EXPLICACION:')) continue;
            const m = line.match(/^(\*?)([a-d])\)\s*(.*)/);
            if (m) { if (m[1] === '*') correctIndex = options.length; options.push(m[3]); }
        }
        if (question && options.length >= 2 && correctIndex >= 0) out.push({ correctIndex, options });
    }
    return out;
}
const esLaMasLarga = (q: { correctIndex: number; options: string[] }) => {
    const L = q.options.map(o => o.split(/\s+/).length);
    return L[q.correctIndex] === Math.max(...L) && L.filter(x => x === Math.max(...L)).length === 1;
};

async function main() {
    const cursos = await prisma.course.findMany({
        where: { headquartersId: HQ, isActive: true },
        select: { title: true, category: true, content: true,
                  _count: { select: { enrollments: true } } },
        orderBy: { title: 'asc' },
    });
    let qTot = 0, qLargas = 0, sTot = 0, sCiegas = 0;
    const filas: string[] = [];
    for (const c of cursos) {
        let ql = 0, qt = 0, sc = 0, st = 0;
        for (const m of (c.content ?? '').matchAll(/---SECCION_(\d+)---([\s\S]*?)(?=---SECCION_\d+---|$)/g)) {
            const qs = parseQuestions(m[2].match(/PREGUNTAS:\s*([\s\S]*?)$/)?.[1] ?? '');
            if (!qs.length) continue;
            const largas = qs.filter(esLaMasLarga).length;
            st++; qt += qs.length; ql += largas;
            if (largas >= Math.ceil(qs.length * 0.8)) sc++;
        }
        if (!qt) continue;
        qTot += qt; qLargas += ql; sTot += st; sCiegas += sc;
        filas.push(`${sc > 0 ? 'SÍ ' : '   '} ${String(sc).padStart(2)}/${st}  ${String(Math.round(ql * 100 / qt)).padStart(3)}%  ${String(c._count.enrollments).padStart(3)} matr.  ${c.title}`);
    }
    console.log('se aprueba   secs   clave     matrí-');
    console.log('sin leer?   ciegas  larga    culados  curso');
    filas.forEach(f => console.log(f));
    console.log(`\nTOTAL: ${sCiegas} de ${sTot} secciones se aprueban marcando siempre la más larga.`);
    console.log(`       ${qLargas} de ${qTot} preguntas (${Math.round(qLargas * 100 / qTot)}%) tienen la correcta como opción más larga. Al azar: 25%.`);
}
main().catch(e => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
