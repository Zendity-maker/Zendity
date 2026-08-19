/**
 * Normaliza el estado de los empleados y limpia el daño del desfase.
 *
 * Contexto (19-ago-2026): `isActive` e `isDeleted` se escribían por separado.
 * Resultado en Cupey: dos cuidadoras con isDeleted:true pero isActive:true.
 * No podían entrar (auth.ts mira ambas), pero toda query que filtrara solo por
 * isActive las devolvía como si trabajaran — y el backfill de la certificación
 * les asignó siete cursos y les mandó notificaciones a gente que ya no está.
 *
 * Este script:
 *   1. Impone el invariante isDeleted === !isActive (ver src/lib/staff-status.ts)
 *   2. Retira las asignaciones de Academy PENDING/IN_PROGRESS de quien está de
 *      baja — no tiene sentido pedirle formación a quien no vuelve
 *
 * Lo que NO toca: nada del historial. eMAR, turnos, incidentes y las
 * asignaciones ya COMPLETADAS se conservan — son expediente.
 *
 * Idempotente. Simula por defecto.
 *
 * Uso:
 *   DATABASE_URL="..." npx tsx scripts/normalizar-estado-empleados.ts
 *   DATABASE_URL="..." npx tsx scripts/normalizar-estado-empleados.ts --confirmar
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APLICAR = process.argv.includes('--confirmar');

async function main() {
    console.log(APLICAR ? '✏️  Normalizando estado de empleados\n' : '🔍 SIMULACIÓN — no se escribe nada\n');

    // ── 1. Desfase entre las dos banderas ──────────────────────────────────
    // isDeleted:true gana: alguien marcado como borrado ya fue dado de baja
    // por una decisión humana. isActive:true es el flag que se quedó atrás.
    const desfasados = await prisma.user.findMany({
        where: { isActive: true, isDeleted: true },
        select: { id: true, name: true, email: true, role: true },
    });

    console.log(`── Desfase de banderas: ${desfasados.length}`);
    for (const u of desfasados) {
        console.log(`   ${APLICAR ? '✅' : '→ '} ${u.name?.trim()} <${u.email}> (${u.role}) → de baja`);
    }
    if (APLICAR && desfasados.length > 0) {
        await prisma.user.updateMany({
            where: { id: { in: desfasados.map((u) => u.id) } },
            data: { isActive: false },
        });
        // Si tenía sesión abierta, se cae.
        await prisma.session.deleteMany({ where: { userId: { in: desfasados.map((u) => u.id) } } });
    }

    // ── 2. Formación asignada a gente que no vuelve ────────────────────────
    const deBaja = await prisma.user.findMany({
        where: { OR: [{ isActive: false }, { isDeleted: true }] },
        select: { id: true, name: true },
    });
    const idsBaja = deBaja.map((u) => u.id);

    const huerfanas = idsBaja.length
        ? await prisma.academyAssignment.findMany({
              where: { userId: { in: idsBaja }, status: { in: ['PENDING', 'IN_PROGRESS'] } },
              select: { id: true, userId: true },
          })
        : [];

    const porPersona = new Map<string, number>();
    for (const a of huerfanas) porPersona.set(a.userId, (porPersona.get(a.userId) ?? 0) + 1);

    console.log(`\n── Formación pendiente asignada a personal de baja: ${huerfanas.length}`);
    for (const [userId, n] of porPersona) {
        const nombre = deBaja.find((u) => u.id === userId)?.name?.trim() ?? userId;
        console.log(`   ${APLICAR ? '✅' : '→ '} ${nombre} — se retiran ${n}`);
    }
    if (APLICAR && huerfanas.length > 0) {
        await prisma.academyAssignment.deleteMany({ where: { id: { in: huerfanas.map((a) => a.id) } } });
    }

    // ── Resultado ──────────────────────────────────────────────────────────
    const [contradictorios, activos] = await Promise.all([
        prisma.user.count({ where: { isActive: true, isDeleted: true } }),
        prisma.user.count({ where: { isActive: true, isDeleted: false } }),
    ]);
    console.log(`\nEstado ${APLICAR ? 'final' : 'actual'}: ${activos} activos · ${contradictorios} contradictorios`);
    console.log(APLICAR ? 'Listo.' : '\nPara aplicar, agrega --confirmar');
}

main()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
