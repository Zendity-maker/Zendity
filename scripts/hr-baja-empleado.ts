/**
 * Da de baja a un empleado: cierra su acceso y termina sus sesiones.
 *
 * Origen (19-ago-2026): al asignar la certificación geriátrica aparecieron
 * empleados que ya no trabajan en el hogar pero seguían con `isActive: true`
 * y PIN vigente. No existía un paso de salida — nadie revoca el acceso cuando
 * alguien se va, y el sistema los sigue contando en matrícula, métricas y
 * notificaciones.
 *
 * Qué hace:
 *   - isActive = false  → el login queda bloqueado (src/lib/auth.ts:55, único
 *     punto de entrada; el PIN del kiosko pasa por ahí también)
 *   - borra sus sesiones vivas → si tenía una abierta, se cae
 *   - avisa si le quedan turnos futuros programados (esos hay que reasignarlos
 *     a mano; este script NO toca el itinerario)
 *
 * Qué NO hace: no borra nada. El historial clínico que documentó se conserva
 * intacto — es expediente y no puede desaparecer porque la persona se fue.
 * El PIN se deja como está: `isActive` es la puerta real y esto es reversible
 * si la persona regresa.
 *
 * Uso (simula por defecto — hay que pasar --confirmar para aplicar):
 *   DATABASE_URL="..." npx tsx scripts/hr-baja-empleado.ts "Carolina de la Rosa" "Kishany"
 *   DATABASE_URL="..." npx tsx scripts/hr-baja-empleado.ts "Carolina de la Rosa" --confirmar
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APLICAR = process.argv.includes('--confirmar');
const objetivos = process.argv.slice(2).filter((a) => !a.startsWith('--'));

async function main() {
    if (objetivos.length === 0) {
        console.log('Uso: npx tsx scripts/hr-baja-empleado.ts "Nombre o email" [...] [--confirmar]');
        process.exit(1);
    }

    console.log(APLICAR ? '⚠️  APLICANDO BAJAS\n' : '🔍 SIMULACIÓN — no se escribe nada\n');

    for (const objetivo of objetivos) {
        const encontrados = await prisma.user.findMany({
            where: {
                isActive: true,
                OR: [
                    { name: { contains: objetivo, mode: 'insensitive' } },
                    { email: { contains: objetivo, mode: 'insensitive' } },
                ],
            },
            select: { id: true, name: true, email: true, role: true, headquartersId: true },
        });

        if (encontrados.length === 0) {
            console.log(`❌ "${objetivo}" — sin coincidencias activas`);
            continue;
        }
        // Ambigüedad = no se toca nada. Dar de baja a la persona equivocada le
        // quita el acceso a alguien que está en turno.
        if (encontrados.length > 1) {
            console.log(`⚠️  "${objetivo}" — ${encontrados.length} coincidencias, se omite:`);
            encontrados.forEach((u) => console.log(`      · ${u.name?.trim()} <${u.email}>`));
            console.log('      Usa el email completo para desambiguar.');
            continue;
        }

        const u = encontrados[0];
        const [sesiones, futuros] = await Promise.all([
            prisma.session.count({ where: { userId: u.id, expires: { gt: new Date() } } }),
            prisma.scheduledShift.count({ where: { userId: u.id, date: { gte: new Date() } } }),
        ]);

        console.log(`${APLICAR ? '✂️ ' : '→ '} ${u.name?.trim()} <${u.email}> (${u.role})`);
        console.log(`      sesiones vivas: ${sesiones} · turnos futuros programados: ${futuros}`);
        if (futuros > 0) {
            console.log(`      ⚠️  Tiene ${futuros} turno${futuros !== 1 ? 's' : ''} en el itinerario. Reasígnalos a mano.`);
        }

        if (!APLICAR) continue;

        await prisma.$transaction([
            prisma.user.update({ where: { id: u.id }, data: { isActive: false } }),
            prisma.session.deleteMany({ where: { userId: u.id } }),
        ]);
        console.log('      ✅ acceso cerrado');
    }

    console.log(APLICAR ? '\nListo.' : '\nPara aplicar, agrega --confirmar');
}

main()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
