/**
 * Retira del catálogo los cursos que enseñan cosas falsas y no le tocan a nadie.
 *
 * La auditoría del 11-sep-2026 encontró que los 16 cursos que enseñan a USAR
 * Zendity están desactualizados: se escribieron el 14-abr y la app lleva cinco
 * meses cambiando debajo del texto. Reescribirlos todos es un trabajo largo, y
 * dos de ellos —Limpieza y El Administrador— son los que más errores graves
 * tienen (14 y 5) y llegan a CERO personas: no hay empleados con esos roles.
 *
 * Decisión de Andrés, 11-sep-2026: desactivarlos. Nadie debe poder tomar una
 * formación que enseña cosas que no son verdad, y menos una que no necesita.
 *
 * Es reversible: `isActive: true` los devuelve. `buscarCurso` en
 * academy-assign.ts ya filtra por isActive, así que tampoco se asignarán solos
 * si mañana entra alguien de limpieza — hay que reescribirlos antes.
 *
 *   npx tsx scripts/desactivar-cursos-sin-audiencia.ts            (simula)
 *   npx tsx scripts/desactivar-cursos-sin-audiencia.ts --aplicar
 */
import { prisma } from '../src/lib/prisma';

const APLICAR = process.argv.includes('--aplicar');
const RETIRAR = ['Limpieza y Sanitizacion en Zendity', 'El Administrador en Zendity'];

async function main() {
    if (!APLICAR) console.log('SIMULACIÓN — no se escribe nada\n');

    for (const titulo of RETIRAR) {
        const cursos = await prisma.course.findMany({
            where: { title: titulo },
            select: { id: true, isActive: true, headquarters: { select: { name: true } } },
        });
        for (const c of cursos) {
            // ¿Alguien lo tiene asignado o empezado? Si lo tiene, se dice.
            const [asignaciones, matriculas] = await Promise.all([
                prisma.academyAssignment.count({ where: { moduleCode: c.id, status: { in: ['PENDING', 'IN_PROGRESS'] } } }),
                prisma.userCourse.count({ where: { courseId: c.id, status: { not: 'COMPLETED' } } }),
            ]);
            const nota = asignaciones || matriculas
                ? `  ⚠️ ${asignaciones} asignación(es) y ${matriculas} matrícula(s) sin terminar`
                : '';
            console.log(`${c.isActive ? 'activo  ' : 'INACTIVO'} ${c.headquarters.name.padEnd(28)} ${titulo}${nota}`);
            if (APLICAR && c.isActive) {
                await prisma.course.update({ where: { id: c.id }, data: { isActive: false } });
            }
        }
    }

    if (APLICAR) {
        const quedan = await prisma.course.count({ where: { isActive: true, title: { in: RETIRAR } } });
        console.log(`\nVERIFICACIÓN — siguen activos: ${quedan}${quedan === 0 ? '  OK' : '  REVISAR'}`);
    } else {
        console.log('\nPara aplicar: --aplicar');
    }
}
main().catch(e => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
