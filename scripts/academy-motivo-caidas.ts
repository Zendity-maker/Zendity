/**
 * PONE EL MOTIVO DE VERDAD EN LAS ASIGNACIONES DEL CURSO DE CAÍDAS.
 *
 * El backfill del 12-sep las creó con `reason: 'Ruta de ingreso'`, que es lo que
 * la Academia pinta debajo del curso. Así que la persona recibe un correo que
 * habla de las caídas del piso, abre Academy, y lee "Ruta de ingreso · 25 min"
 * dentro del grupo "Para empezar" — el encuadre de un curso de bienvenida, no el
 * de una respuesta a lo que está pasando.
 *
 * Dos textos distintos para la misma decisión enseñan que ninguno de los dos es
 * el motivo real.
 *
 * El prefijo "Asignado por" NO es decorativo: `src/lib/formacion-pendiente.ts`
 * lo lee para dar 14 días de plazo y ponerlo en el grupo "Te lo pidió tu
 * supervisión", por delante de lo automático. Con "Ruta de ingreso" también son
 * 14 días, así que el plazo no se mueve; lo que cambia es el encuadre y el orden.
 *
 * Y `assignedBySystem` pasa a false porque es verdad: esto no lo dedujo una
 * regla. Lo decidió Andrés el 12-sep-2026.
 *
 *     npx tsx scripts/academy-motivo-caidas.ts            simula
 *     npx tsx scripts/academy-motivo-caidas.ts --aplicar  escribe
 *
 * Idempotente: solo toca las que siguen con el motivo viejo.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APLICAR = process.argv.includes('--aplicar');

const MOTIVO_VIEJO = 'Ruta de ingreso';
/** Lo mismo que dice el correo, en una línea que quepa en la tarjeta. */
const MOTIVO_NUEVO = 'Asignado por Dirección: la mitad de las caídas del piso no llegan al botón';

async function main() {
    console.log(APLICAR ? '✏️  Aplicando\n' : '🔍 SIMULACIÓN — no se escribe nada\n');
    console.log(`  de: "${MOTIVO_VIEJO}"`);
    console.log(`   a: "${MOTIVO_NUEVO}"\n`);

    /**
     * Quién lo decidió. Se busca al DIRECTOR de la sede en vez de dejarlo nulo:
     * una asignación que dice "Asignado por Dirección" y no guarda a nadie es la
     * misma media verdad que se viene a corregir.
     */
    const sedes = await prisma.headquarters.findMany({ select: { id: true, name: true } });
    let total = 0;

    for (const sede of sedes) {
        const curso = await prisma.course.findFirst({
            where: { headquartersId: sede.id, title: { contains: 'Protocolo de Respuesta a Caidas' } },
            select: { id: true },
        });
        if (!curso) continue;

        const director = await prisma.user.findFirst({
            where: { headquartersId: sede.id, role: 'DIRECTOR', isActive: true, isDeleted: false },
            select: { id: true, name: true },
        });

        const filas = await prisma.academyAssignment.findMany({
            where: { headquartersId: sede.id, moduleCode: curso.id, reason: MOTIVO_VIEJO },
            select: { id: true, status: true, user: { select: { name: true } } },
        });

        console.log(`📚 ${sede.name} — ${filas.length} asignación(es) con el motivo viejo`);
        if (filas.length === 0) continue;
        console.log(`   Queda a nombre de: ${director?.name ?? '(sin director activo)'}`);

        for (const f of filas) {
            console.log(`   ${APLICAR ? '✓' : '→'} ${f.user?.name?.slice(0, 32).padEnd(34)} ${f.status}`);
            total++;
        }

        if (APLICAR) {
            await prisma.academyAssignment.updateMany({
                where: { id: { in: filas.map(f => f.id) } },
                data: {
                    reason: MOTIVO_NUEVO,
                    assignedBySystem: false,
                    ...(director ? { assignedByUserId: director.id } : {}),
                },
            });
        }
    }

    console.log(`\n${APLICAR ? 'Actualizadas' : 'Se actualizarían'}: ${total}`);
    if (!APLICAR && total > 0) console.log('Para aplicarlo: npx tsx scripts/academy-motivo-caidas.ts --aplicar');
    await prisma.$disconnect();
}

main().catch(async e => { console.error(e); await prisma.$disconnect(); process.exit(1); });
