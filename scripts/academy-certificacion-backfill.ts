/**
 * Asigna la certificación geriátrica al personal QUE YA ESTÁ.
 *
 * `asignarRutaCertificacion` solo corre al dar de alta a alguien nuevo. Sin
 * este backfill, los 23 empleados actuales de Cupey siguen exactamente igual
 * que antes de sembrar los cursos: siete módulos publicados y cero asignados.
 * Ese fue el diagnóstico original de Academy — contenido bueno, desconectado.
 *
 * Solo alcanza roles con contacto directo con residentes (ver
 * ROLES_CON_RESIDENTES en src/lib/academy-assign.ts).
 *
 * Idempotente: si ya tiene la asignación, no la duplica. Correrlo dos veces
 * no hace nada la segunda vez.
 *
 * Notificación: una sola por persona, no siete. Se puede omitir con
 * --sin-notificar si prefieres anunciarlo tú en la reunión de turno.
 *
 * Uso:
 *   DATABASE_URL="..." npx tsx scripts/academy-certificacion-backfill.ts --dry-run
 *   DATABASE_URL="..." npx tsx scripts/academy-certificacion-backfill.ts
 *   DATABASE_URL="..." npx tsx scripts/academy-certificacion-backfill.ts --sin-notificar
 */
import { PrismaClient } from '@prisma/client';
import { asignarRutaCertificacion, requiereCertificacion } from '../src/lib/academy-assign';

const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry-run');
const SIN_NOTIF = process.argv.includes('--sin-notificar');

async function main() {
    const sedes = await prisma.headquarters.findMany({ select: { id: true, name: true } });
    console.log(DRY ? '🔍 SIMULACIÓN — no se escribe nada\n' : '🎓 Asignando certificación geriátrica\n');

    let totalPersonas = 0;
    let totalAsignaciones = 0;

    for (const hq of sedes) {
        const empleados = await prisma.user.findMany({
            where: { headquartersId: hq.id, isActive: true },
            select: { id: true, name: true, role: true },
            orderBy: { name: 'asc' },
        });

        const elegibles = empleados.filter((e) => requiereCertificacion(String(e.role)));
        console.log(`── ${hq.name} — ${elegibles.length} de ${empleados.length} elegibles`);

        for (const e of elegibles) {
            if (DRY) {
                // En simulación se cuenta lo que le falta, sin escribir.
                const yaTiene = await prisma.academyAssignment.count({
                    where: { userId: e.id, reason: 'Certificación geriátrica' },
                });
                const faltan = 7 - yaTiene;
                if (faltan > 0) {
                    console.log(`   + ${e.name} (${e.role}) — ${faltan} módulo${faltan !== 1 ? 's' : ''}`);
                    totalPersonas++;
                    totalAsignaciones += faltan;
                } else {
                    console.log(`   = ${e.name} — ya la tiene completa`);
                }
                continue;
            }

            const creadas = await asignarRutaCertificacion({
                hqId: hq.id,
                userId: e.id,
                silencioso: SIN_NOTIF,
            });
            if (creadas > 0) {
                console.log(`   + ${e.name} (${e.role}) — ${creadas} módulo${creadas !== 1 ? 's' : ''}`);
                totalPersonas++;
                totalAsignaciones += creadas;
            } else {
                console.log(`   = ${e.name} — sin cambios`);
            }
        }
        console.log('');
    }

    console.log(`${totalPersonas} persona${totalPersonas !== 1 ? 's' : ''} · ${totalAsignaciones} asignaciones`);
    if (!DRY && !SIN_NOTIF && totalPersonas > 0) {
        console.log(`Se enviaron ${totalPersonas} notificaciones (una por persona).`);
    }
    console.log(DRY ? '\nPara aplicar, corre el mismo comando sin --dry-run' : '\nListo.');
}

main()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
