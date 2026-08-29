/**
 * Devuelve los puntos descontados por vitales vencidos DURANTE la caída del
 * login del 28-29 de agosto de 2026.
 *
 * La caída duró 28 horas —viernes 14:24 a sábado 18:01— y el personal que
 * tenía que entrar de nuevo no podía. El cron de vitals-reminder siguió
 * corriendo y descontó por órdenes que no se pudieron completar:
 *
 *   28-ago 22:30 AST   Carlos Negron            -10   (5 órdenes)
 *   28-ago 22:45 AST   Mariangelie Rivera       -10   (5 órdenes)
 *   29-ago 10:15 AST   Brendali Collazo         -10   (5 órdenes)
 *   29-ago 12:15 AST   Zuleyka Valcarcel         -4   (2 órdenes)
 *
 * El código ya está corregido para que no vuelva a pasar
 * (src/lib/ventanas-sin-servicio.ts), pero eso no devuelve lo ya descontado.
 *
 * NO BORRA el evento original. Escribe uno COMPENSATORIO con el delta opuesto y
 * su motivo. Borrar dejaría el historial diciendo que nunca ocurrió; así queda
 * el descuento, la devolución y por qué — que es lo que uno querría ver si
 * revisa este expediente dentro de un año.
 *
 * Solo toca eventos que cumplan LAS TRES:
 *   - reason empieza por "Vitales vencidos sin completar"
 *   - delta negativo
 *   - createdAt dentro de la ventana de la caída
 *
 * Ensayo (no escribe):
 *   DATABASE_URL="..." npx tsx scripts/revertir-penalidades-caida.ts
 *
 * Aplicar (deja respaldo JSON):
 *   DATABASE_URL="..." npx tsx scripts/revertir-penalidades-caida.ts \
 *     --aplicar --respaldo ~/Desktop/respaldo-penalidades.json
 */
import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'fs';
import { VENTANAS_SIN_SERVICIO } from '../src/lib/ventanas-sin-servicio';

const prisma = new PrismaClient();
const APLICAR = process.argv.includes('--aplicar');
const ri = process.argv.indexOf('--respaldo');
const RESPALDO = ri > -1 ? process.argv[ri + 1] : null;

async function main() {
    if (APLICAR && !RESPALDO) {
        console.error('✘ --aplicar exige --respaldo <ruta>. No se escribe sin respaldo.');
        process.exit(1);
    }
    const v = VENTANAS_SIN_SERVICIO[0];
    console.log(`Ventana: ${v.desde.toISOString()} → ${v.hasta.toISOString()}`);
    console.log(`Motivo:  ${v.motivo}\n`);

    const castigos = await prisma.scoreEvent.findMany({
        where: {
            createdAt: { gte: v.desde, lte: v.hasta },
            delta: { lt: 0 },
            reason: { startsWith: 'Vitales vencidos sin completar' },
        },
        orderBy: { createdAt: 'asc' },
        select: {
            id: true, userId: true, delta: true, reason: true, createdAt: true,
            user: { select: { name: true, complianceScore: true, headquartersId: true } },
        },
    });

    console.log(`Penalidades a devolver: ${castigos.length}`);
    let total = 0;
    castigos.forEach(c => {
        total += Math.abs(c.delta);
        console.log(`  ${c.createdAt.toISOString().slice(5, 16)}  ${String(c.delta).padStart(4)}  ${c.user?.name?.trim().padEnd(26)} score actual ${c.user?.complianceScore}`);
    });
    console.log(`\n  Total a devolver: ${total} puntos entre ${new Set(castigos.map(c => c.userId)).size} personas`);

    if (castigos.length === 0) { console.log('\nNada que hacer.'); return; }
    if (!APLICAR) {
        console.log('\n── ENSAYO — no se escribió nada. Añade --aplicar --respaldo <ruta> ──');
        return;
    }

    writeFileSync(RESPALDO!, JSON.stringify(castigos, null, 2));
    console.log(`\nRespaldo escrito en ${RESPALDO}`);

    const { applyScoreEvent } = await import('../src/lib/score-event');
    for (const c of castigos) {
        await applyScoreEvent(
            c.userId,
            c.user!.headquartersId,
            Math.abs(c.delta),
            'Devolución: Zéndity estuvo caído y no se pudo registrar',
            'VITALS',
        );
        console.log(`  ✔ +${Math.abs(c.delta)} a ${c.user?.name?.trim()}`);
    }
    console.log('\nEl descuento original se conserva en el historial, con su devolución al lado.');
}

main().catch(e => { console.error('FALLO:', e); process.exit(1); }).finally(() => prisma.$disconnect());
