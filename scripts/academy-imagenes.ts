/**
 * Instala las portadas de los cursos y apunta cada curso a la suya.
 *
 * Las imágenes vienen nombradas por el título del curso, sin acentos. El match
 * se hace normalizando ambos lados —quitando tildes, puntuación y mayúsculas—
 * porque siete títulos están sin tildes en la base y las imágenes tampoco las
 * traen. Un match por texto exacto fallaría justo en esos siete.
 *
 * Se niega a actuar si un archivo resuelve a dos cursos, o al revés: apuntar la
 * portada equivocada es peor que no tener portada.
 *
 * Uso:
 *   DATABASE_URL="..." npx tsx scripts/academy-imagenes.ts            # simula
 *   DATABASE_URL="..." npx tsx scripts/academy-imagenes.ts --confirmar
 */
import { PrismaClient } from '@prisma/client';
import { readdirSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();
const APLICAR = process.argv.includes('--confirmar');
const DIR_PUBLICO = 'public/academy';

/** Sin tildes, sin puntuación, en minúscula. */
const norm = (s: string) =>
    s.normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toLowerCase().replace(/[^a-z0-9]+/g, '');

async function main() {
    const archivos = readdirSync(DIR_PUBLICO)
        .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f) && !f.includes('_101'));

    console.log(APLICAR ? '🖼  Instalando portadas\n' : '🔍 SIMULACIÓN — no se escribe nada\n');

    const sedes = await prisma.headquarters.findMany({ select: { id: true, name: true } });
    let ok = 0, sinImagen: string[] = [], ambiguos: string[] = [];

    for (const hq of sedes) {
        const cursos = await prisma.course.findMany({
            where: { headquartersId: hq.id, isActive: true },
            select: { id: true, title: true, imageUrl: true },
            orderBy: { order: 'asc' },
        });
        console.log(`── ${hq.name} — ${cursos.length} cursos, ${archivos.length} imágenes`);

        for (const c of cursos) {
            const clave = norm(c.title);
            const candidatos = archivos.filter(f => norm(f.replace(/\.[^.]+$/, '')) === clave);

            if (candidatos.length === 0) { sinImagen.push(c.title); continue; }
            if (candidatos.length > 1) { ambiguos.push(`${c.title} → ${candidatos.join(', ')}`); continue; }

            const url = `/academy/${candidatos[0]}`;
            if (c.imageUrl === url) { console.log(`   = ${c.title}`); ok++; continue; }

            if (APLICAR) await prisma.course.update({ where: { id: c.id }, data: { imageUrl: url } });
            console.log(`   ${APLICAR ? '✅' : '→ '} ${c.title}`);
            ok++;
        }
    }

    console.log(`\n${ok} cursos con portada`);
    if (sinImagen.length) console.log(`\n⚠️  Sin imagen (${sinImagen.length}):\n   ${sinImagen.join('\n   ')}`);
    if (ambiguos.length) {
        console.log(`\n❌ Ambiguos — no se toca ninguno:\n   ${ambiguos.join('\n   ')}`);
        process.exit(1);
    }
    console.log(APLICAR ? '\nListo.' : '\nPara aplicar, agrega --confirmar');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
