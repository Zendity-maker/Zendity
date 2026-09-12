/**
 * ASIGNA EL CURSO DE CAÍDAS AL PERSONAL QUE YA ESTÁ.
 *
 * "Protocolo de Respuesta a Caídas" vale 30 puntos —el máximo del catálogo— y
 * hasta el 12-sep-2026 no lo asignaba NINGUNA ruta: ni la de ingreso, ni la
 * certificación, ni la regla de incidentes. Resultado medido: cero matrículas
 * en los cinco meses que lleva publicado.
 *
 * Ese día entró en la ruta de ingreso de los tres roles de piso (CAREGIVER,
 * NURSE, SUPERVISOR), pero la ruta de ingreso solo corre al dar de alta a
 * alguien nuevo. Las trece cuidadoras que ya estaban no lo recibirían nunca.
 * Este script es el mismo remedio que se usó con la certificación geriátrica en
 * agosto (ver academy-certificacion-backfill.ts).
 *
 *     npx tsx scripts/academy-backfill-caidas.ts            simula
 *     npx tsx scripts/academy-backfill-caidas.ts --aplicar  escribe
 *
 * Idempotente: no toca a quien ya lo tiene asignado ni a quien ya lo aprobó.
 * Solo personal ACTIVO y no borrado.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APLICAR = process.argv.includes('--aplicar');

/** Los que pisan el piso. Los mismos que lo llevan en la ruta de ingreso. */
const ROLES_DE_PISO = ['CAREGIVER', 'NURSE', 'SUPERVISOR'];

async function main() {
    console.log(APLICAR ? '✏️  Aplicando\n' : '🔍 SIMULACIÓN — no se escribe nada\n');

    const sedes = await prisma.headquarters.findMany({ select: { id: true, name: true } });
    let total = 0, saltados = 0;

    for (const sede of sedes) {
        const curso = await prisma.course.findFirst({
            where: { headquartersId: sede.id, isActive: true, title: { contains: 'Protocolo de Respuesta a Caidas' } },
            select: { id: true, title: true },
        });
        if (!curso) {
            console.log(`  ${sede.name}: sin el curso activo — no se asigna nada`);
            continue;
        }

        /**
         * El rol secundario cuenta.
         *
         * La enfermería de este hogar la hace la dirección con NURSE de
         * secundario, y hay supervisoras que también son cuidadoras. Filtrar
         * solo por el primario dejaría fuera justo a quien más lo usa.
         */
        const gente = await prisma.user.findMany({
            where: { headquartersId: sede.id, isActive: true, isDeleted: false },
            select: { id: true, name: true, role: true, secondaryRoles: true },
        });
        const dePiso = gente.filter(u =>
            [u.role, ...(u.secondaryRoles ?? [])].some(r => ROLES_DE_PISO.includes(r)));

        console.log(`\n📚 ${sede.name} — ${dePiso.length} de ${gente.length} activos pisan el piso`);

        for (const u of dePiso) {
            const [abierto, aprobado] = await Promise.all([
                prisma.academyAssignment.findFirst({
                    where: { userId: u.id, moduleCode: curso.id },
                    select: { id: true },
                }),
                prisma.userCourse.findFirst({
                    where: { employeeId: u.id, courseId: curso.id, status: 'COMPLETED' },
                    select: { id: true },
                }),
            ]);
            if (abierto || aprobado) {
                console.log(`  =  ${u.name?.slice(0, 30).padEnd(32)} ${abierto ? 'ya asignado' : 'ya aprobado'}`);
                saltados++;
                continue;
            }

            console.log(`  +  ${u.name?.slice(0, 30).padEnd(32)} ${u.role}`);
            total++;

            if (APLICAR) {
                await prisma.academyAssignment.create({
                    data: {
                        headquartersId: sede.id,
                        userId: u.id,
                        moduleCode: curso.id,
                        // El prefijo lo lee formacion-pendiente.ts para el plazo
                        // (14 días) y el orden. No cambiarlo sin cambiar allí.
                        reason: 'Ruta de ingreso',
                        status: 'PENDING',
                        assignedBySystem: true,
                    },
                });
            }
        }
    }

    console.log(`\n${APLICAR ? 'Creadas' : 'Se crearían'}: ${total} · ya lo tenían: ${saltados}`);
    if (!APLICAR && total > 0) console.log('Para aplicarlo: npx tsx scripts/academy-backfill-caidas.ts --aplicar');

    /**
     * Sin notificación en masa, a propósito.
     *
     * Trece avisos idénticos el mismo minuto es ruido, y el ruido es lo que
     * hace que la gente deje de mirar la campana. El curso aparece en su
     * Academy con su plazo; que se anuncie en la reunión o en el correo de la
     * semana, que es donde una persona lo puede explicar.
     */
    await prisma.$disconnect();
}

main().catch(async e => { console.error(e); await prisma.$disconnect(); process.exit(1); });
