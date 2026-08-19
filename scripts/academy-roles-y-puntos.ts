/**
 * Asigna targetRole y racionaliza los puntos de los cursos de Academy.
 *
 * Contexto (ago-2026): los 16 cursos tenían targetRole vacío — una cuidadora
 * veía "El Director en Zendity" en la misma lista que el suyo, 16 tarjetas sin
 * orden ni prioridad. Y los puntos no seguían ninguna lógica: el curso de
 * Protocolo de Caídas (+10) valía doce veces menos que el de Accesos (+75),
 * y eMAR daba +125 sobre un score que tope en 100.
 *
 * Criterio de puntos: RIESGO. Lo que puede causar daño físico vale más.
 *   30 — daño directo al residente (medicación, caídas)
 *   20 — ejecución diaria del rol y contacto clínico
 *   15 — procesos de soporte y gestión
 *   10 — orientación y herramientas
 *
 * Idempotente: correrlo dos veces deja el mismo estado.
 *
 * Uso (una sede):
 *   DATABASE_URL="..." npx tsx scripts/academy-roles-y-puntos.ts
 * Uso (simulación, no escribe):
 *   DATABASE_URL="..." npx tsx scripts/academy-roles-y-puntos.ts --dry-run
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry-run');

/** Fragmento de título → { rol destinatario (null = todos), puntos }. */
const PLAN: Record<string, { role: string | null; pts: number }> = {
    'Acceso y Roles':                  { role: null,            pts: 10 },
    'El Director':                     { role: 'DIRECTOR',      pts: 15 },
    'El Administrador':                { role: 'ADMIN',         pts: 15 },
    'El Cuidador':                     { role: 'CAREGIVER',     pts: 20 },
    'El Supervisor':                   { role: 'SUPERVISOR',    pts: 20 },
    'La Enfermera':                    { role: 'NURSE',         pts: 20 },
    'Turno Nocturno':                  { role: 'CAREGIVER',     pts: 15 },
    'Planta Fisica':                   { role: 'MAINTENANCE',   pts: 10 },
    'Proceso de Admision':             { role: null,            pts: 15 },
    'eMAR':                            { role: null,            pts: 30 },
    'Protocolo de Respuesta a Caidas': { role: null,            pts: 30 },
    'Handover':                        { role: null,            pts: 20 },
    'Proceso de Cierre de Turno':      { role: null,            pts: 15 },
    'Uso de Zendi AI':                 { role: null,            pts: 10 },
    'Limpieza y Sanitizacion':         { role: 'CLEANING',      pts: 20 },
    'Trabajo Social':                  { role: 'SOCIAL_WORKER', pts: 15 },
};

async function main() {
    const sedes = await prisma.headquarters.findMany({ select: { id: true, name: true } });
    console.log(DRY ? '🔍 SIMULACIÓN — no se escribe nada\n' : '✏️  Aplicando cambios\n');

    let total = 0, sinPlan = 0;

    for (const hq of sedes) {
        const cursos = await prisma.course.findMany({
            where: { headquartersId: hq.id },
            select: { id: true, title: true, targetRole: true, bonusCompliance: true, isGlobal: true },
            orderBy: { order: 'asc' },
        });
        if (cursos.length === 0) continue;

        console.log(`── ${hq.name} (${cursos.length} cursos)`);

        for (const c of cursos) {
            const clave = Object.keys(PLAN).find(k => c.title.includes(k));
            if (!clave) {
                console.log(`   ⚠️  "${c.title}" — sin plan, se deja como está`);
                sinPlan++;
                continue;
            }
            const { role, pts } = PLAN[clave];

            // Un curso dirigido a un rol NO debe quedar como global: el
            // endpoint filtra `{isGlobal:true, targetRole:null} OR
            // {targetRole:userRole}` — dejarlo global lo mostraría a todos
            // igual y el targetRole no serviría de nada.
            const isGlobal = role === null;

            const cambios: string[] = [];
            if (c.targetRole !== role) cambios.push(`rol ${c.targetRole ?? 'todos'} → ${role ?? 'todos'}`);
            if (c.bonusCompliance !== pts) cambios.push(`pts ${c.bonusCompliance} → ${pts}`);
            if (c.isGlobal !== isGlobal) cambios.push(`global ${c.isGlobal} → ${isGlobal}`);
            if (cambios.length === 0) continue;

            console.log(`   · ${c.title}`);
            console.log(`     ${cambios.join(' | ')}`);

            if (!DRY) {
                await prisma.course.update({
                    where: { id: c.id },
                    data: { targetRole: role, bonusCompliance: pts, isGlobal },
                });
            }
            total++;
        }
    }

    console.log(`\n${DRY ? 'Se cambiarían' : 'Actualizados'}: ${total} curso(s)`);
    if (sinPlan > 0) console.log(`Sin plan (intactos): ${sinPlan}`);
    if (DRY) console.log('\nPara aplicar, corre el mismo comando sin --dry-run');
}

main()
    .catch(e => { console.error('❌', e.message); process.exit(1); })
    .finally(() => prisma.$disconnect());
