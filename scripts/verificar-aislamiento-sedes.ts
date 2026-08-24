/**
 * Verifica que dos sedes no se mezclen. Lee la base, no escribe nada.
 *
 * Hecho para el día que abre Mayagüez. Hasta ahora Zendity opera con una sola
 * sede: cualquier consulta que olvide filtrar por sede devuelve "lo correcto"
 * por accidente, porque todas las filas pertenecen al mismo hogar. El día que
 * entra la segunda, esas consultas empiezan a mezclar en silencio.
 *
 * scripts/auditar-multi-tenant.ts lee el CÓDIGO y encuentra sospechas. Este lee
 * los DATOS y encuentra hechos: si una fuga ya ocurrió, deja rastro.
 *
 * QUÉ MIRA
 *
 *  1. Inventario por sede — para ver de un vistazo que cada hogar tiene lo suyo.
 *  2. Cruces imposibles — una fila cuyo padre es de OTRA sede. Ej. una nota
 *     clínica escrita por personal de Cupey sobre un residente de Mayagüez.
 *     Cada cruce es prueba de que una consulta no filtró.
 *  3. Filas huérfanas — sede vacía en modelos donde el campo es opcional.
 *     Una fila sin sede la ve todo el mundo.
 *
 * Los modelos clínicos (DailyLog, VitalSigns, ClinicalNote, MealLog, BathLog,
 * PressureUlcer, FallIncident…) NO tienen sede propia: cuelgan del residente.
 * Por eso el cruce autor-vs-residente es la señal que importa: es la única
 * forma de detectar una fuga en el expediente.
 *
 * Uso:
 *   cd ~/Desktop/Zendity && DATABASE_URL="$(grep -m1 '^DATABASE_URL=' .env | cut -d= -f2- | tr -d '"')" npx tsx scripts/verificar-aislamiento-sedes.ts
 *
 * Salida: lista de hallazgos. Cero hallazgos = las sedes están aisladas HOY.
 * Correrlo antes de abrir la segunda sede y de nuevo una semana después.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type Hallazgo = { titulo: string; detalle: string };
const hallazgos: Hallazgo[] = [];

function reportar(titulo: string, detalle: string) {
    hallazgos.push({ titulo, detalle });
}

/** Mapa id de residente -> sede, y de usuario -> sede. Se cargan una vez. */
async function cargarMapas() {
    const [pacientes, usuarios] = await Promise.all([
        prisma.patient.findMany({ select: { id: true, headquartersId: true, name: true } }),
        prisma.user.findMany({ select: { id: true, headquartersId: true, name: true } }),
    ]);
    return {
        sedeDePaciente: new Map(pacientes.map(p => [p.id, p.headquartersId])),
        nombrePaciente: new Map(pacientes.map(p => [p.id, p.name])),
        sedeDeUsuario: new Map(usuarios.map(u => [u.id, u.headquartersId])),
        nombreUsuario: new Map(usuarios.map(u => [u.id, u.name])),
    };
}

async function main() {
    const sedes = await prisma.headquarters.findMany({
        select: { id: true, name: true, isActive: true },
        orderBy: { name: 'asc' },
    });

    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║  AISLAMIENTO ENTRE SEDES — verificación sobre datos      ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');

    console.log(`Sedes registradas: ${sedes.length}`);
    sedes.forEach(s => console.log(`   · ${s.name}${s.isActive ? '' : '  (inactiva)'}  ${s.id}`));

    if (sedes.length < 2) {
        console.log('\nSolo hay una sede. Este chequeo no puede probar nada todavía:');
        console.log('con un solo hogar, una consulta sin filtro devuelve lo correcto por');
        console.log('accidente. Vuelve a correrlo cuando Mayagüez esté cargada.\n');
    }

    const M = await cargarMapas();

    // ───────────────────────── 1. INVENTARIO POR SEDE ─────────────────────────
    console.log('\n── INVENTARIO POR SEDE ──\n');
    const fila = (etiqueta: string, valores: (number | string)[]) =>
        console.log(`  ${etiqueta.padEnd(24)}${valores.map(v => String(v).padStart(10)).join('')}`);

    fila('', sedes.map(s => s.name.slice(0, 9)));
    for (const [etiqueta, contar] of [
        ['Residentes',      (hq: string) => prisma.patient.count({ where: { headquartersId: hq } })],
        ['Personal activo', (hq: string) => prisma.user.count({ where: { headquartersId: hq, isActive: true } })],
        ['Familiares',      (hq: string) => prisma.familyMember.count({ where: { headquartersId: hq } })],
        ['Turnos abiertos', (hq: string) => prisma.shiftSession.count({ where: { headquartersId: hq } })],
        ['Handovers',       (hq: string) => prisma.shiftHandover.count({ where: { headquartersId: hq } })],
        ['Observaciones',   (hq: string) => prisma.incidentReport.count({ where: { headquartersId: hq } })],
        ['Cursos',          (hq: string) => prisma.course.count({ where: { headquartersId: hq } })],
    ] as [string, (hq: string) => Promise<number>][]) {
        fila(etiqueta, await Promise.all(sedes.map(s => contar(s.id))));
    }

    // ──────────────── 2. CRUCES IMPOSIBLES (la señal que importa) ────────────────
    console.log('\n── CRUCES ENTRE SEDES ──\n');

    /** Modelos clínicos sin sede propia: se comprueba autor contra residente. */
    const clinicos: { modelo: string; filas: () => Promise<{ id: string; patientId: string; actorId: string }[]> }[] = [
        {
            modelo: 'DailyLog',
            filas: async () => (await prisma.dailyLog.findMany({ select: { id: true, patientId: true, authorId: true } }))
                .map(r => ({ id: r.id, patientId: r.patientId, actorId: r.authorId })),
        },
        {
            modelo: 'ClinicalNote',
            filas: async () => (await prisma.clinicalNote.findMany({ select: { id: true, patientId: true, authorId: true } }))
                .map(r => ({ id: r.id, patientId: r.patientId, actorId: r.authorId })),
        },
        {
            modelo: 'MealLog',
            filas: async () => (await prisma.mealLog.findMany({ select: { id: true, patientId: true, caregiverId: true } }))
                .map(r => ({ id: r.id, patientId: r.patientId, actorId: r.caregiverId })),
        },
        {
            modelo: 'BathLog',
            filas: async () => (await prisma.bathLog.findMany({ select: { id: true, patientId: true, caregiverId: true } }))
                .map(r => ({ id: r.id, patientId: r.patientId, actorId: r.caregiverId })),
        },
    ];

    for (const { modelo, filas } of clinicos) {
        const rows = await filas();
        const malos = rows.filter(r => {
            const sp = M.sedeDePaciente.get(r.patientId);
            const sa = M.sedeDeUsuario.get(r.actorId);
            return sp && sa && sp !== sa;
        });
        if (malos.length) {
            const ej = malos.slice(0, 3).map(m =>
                `${M.nombreUsuario.get(m.actorId) ?? m.actorId} sobre ${M.nombrePaciente.get(m.patientId) ?? m.patientId}`);
            reportar(`${modelo}: ${malos.length} registro(s) de personal de una sede sobre residentes de otra`,
                ej.join(' | '));
        }
        console.log(`  ${modelo.padEnd(22)} ${rows.length.toString().padStart(6)} filas   ${malos.length ? `⚠ ${malos.length} cruzadas` : 'sin cruces'}`);
    }

    /** Modelos con sede propia: se comprueba su sede contra la del padre. */
    const conSede: { modelo: string; comprobar: () => Promise<{ total: number; malos: string[] }> }[] = [
        {
            modelo: 'FamilyMember',
            comprobar: async () => {
                const rows = await prisma.familyMember.findMany({ select: { id: true, headquartersId: true, patientId: true, name: true } });
                return {
                    total: rows.length,
                    malos: rows.filter(r => M.sedeDePaciente.get(r.patientId) !== r.headquartersId)
                              .map(r => `${r.name} (residente ${M.nombrePaciente.get(r.patientId) ?? r.patientId})`),
                };
            },
        },
        {
            modelo: 'UserCourse',
            comprobar: async () => {
                const rows = await prisma.userCourse.findMany({ select: { id: true, headquartersId: true, employeeId: true } });
                return {
                    total: rows.length,
                    malos: rows.filter(r => M.sedeDeUsuario.get(r.employeeId) !== r.headquartersId)
                              .map(r => `${M.nombreUsuario.get(r.employeeId) ?? r.employeeId}`),
                };
            },
        },
        {
            modelo: 'AcademyAssignment',
            comprobar: async () => {
                const rows = await prisma.academyAssignment.findMany({ select: { id: true, headquartersId: true, userId: true } });
                return {
                    total: rows.length,
                    malos: rows.filter(r => M.sedeDeUsuario.get(r.userId) !== r.headquartersId)
                              .map(r => `${M.nombreUsuario.get(r.userId) ?? r.userId}`),
                };
            },
        },
        {
            modelo: 'IncidentReport',
            comprobar: async () => {
                const rows = await prisma.incidentReport.findMany({ select: { id: true, headquartersId: true, employeeId: true, supervisorId: true } });
                return {
                    total: rows.length,
                    malos: rows.filter(r => M.sedeDeUsuario.get(r.employeeId) !== r.headquartersId
                                         || M.sedeDeUsuario.get(r.supervisorId) !== r.headquartersId)
                              .map(r => `observación sobre ${M.nombreUsuario.get(r.employeeId) ?? r.employeeId}`),
                };
            },
        },
        {
            modelo: 'ShiftSession',
            comprobar: async () => {
                const rows = await prisma.shiftSession.findMany({ select: { id: true, headquartersId: true, caregiverId: true } });
                return {
                    total: rows.length,
                    malos: rows.filter(r => M.sedeDeUsuario.get(r.caregiverId) !== r.headquartersId)
                              .map(r => `${M.nombreUsuario.get(r.caregiverId) ?? r.caregiverId}`),
                };
            },
        },
        {
            modelo: 'ShiftColorAssignment',
            comprobar: async () => {
                // El endpoint que escribía aquí tomaba la sede del body sin validar
                // (arreglado el 24-ago-2026). Este es el rastro que dejaría.
                const rows = await prisma.shiftColorAssignment.findMany({
                    select: { id: true, headquartersId: true, userId: true, scheduledShift: { select: { schedule: { select: { headquartersId: true } } } } },
                });
                return {
                    total: rows.length,
                    malos: rows.filter(r => M.sedeDeUsuario.get(r.userId) !== r.headquartersId
                                         || r.scheduledShift?.schedule?.headquartersId !== r.headquartersId)
                              .map(r => `${M.nombreUsuario.get(r.userId) ?? r.userId}`),
                };
            },
        },
    ];

    for (const { modelo, comprobar } of conSede) {
        const { total, malos } = await comprobar();
        if (malos.length) {
            reportar(`${modelo}: ${malos.length} fila(s) cuya sede no coincide con la de su dueño`,
                malos.slice(0, 3).join(' | '));
        }
        console.log(`  ${modelo.padEnd(22)} ${total.toString().padStart(6)} filas   ${malos.length ? `⚠ ${malos.length} cruzadas` : 'sin cruces'}`);
    }

    // ───────────────────────── 3. FILAS SIN SEDE ─────────────────────────
    console.log('\n── FILAS SIN SEDE (las ve cualquiera) ──\n');
    const medSinSede = await prisma.medication.count({ where: { headquartersId: null } });
    console.log(`  Medication sin sede      ${medSinSede.toString().padStart(6)}   ${medSinSede ? '(catálogo compartido — por diseño)' : ''}`);

    // ───────────────────────── RESULTADO ─────────────────────────
    console.log('\n╔══════════════════════════════════════════════════════════╗');
    if (hallazgos.length === 0) {
        console.log('║  SIN CRUCES. Las sedes están aisladas en los datos.       ║');
        console.log('╚══════════════════════════════════════════════════════════╝');
        console.log('\nOjo: esto prueba que no ha ocurrido una fuga, no que sea');
        console.log('imposible. Vuelve a correrlo una semana después de abrir.\n');
    } else {
        console.log(`║  ${String(hallazgos.length).padStart(2)} HALLAZGO(S) — hay mezcla entre sedes.${' '.repeat(18)}║`);
        console.log('╚══════════════════════════════════════════════════════════╝\n');
        hallazgos.forEach((h, i) => {
            console.log(`${i + 1}. ${h.titulo}`);
            console.log(`   ${h.detalle}\n`);
        });
        process.exitCode = 1;
    }
}

main()
    .catch(e => { console.error('Error corriendo la verificación:', e); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
