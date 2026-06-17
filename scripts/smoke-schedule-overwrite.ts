/**
 * scripts/smoke-schedule-overwrite.ts — regresión del bug del overwrite.
 *
 * Incidente jun-2026 (Celia/Vivid Cupey): Schedule DRAFT con shifts que
 * tienen ShiftColorAssignment NO podía ser sobrescrito — el deleteMany
 * de ScheduledShift fallaba por FK constraint, transacción se revertía,
 * UI mostraba "Error al sobrescribir".
 *
 * Fix: A (código defensivo: deleteMany de ShiftColorAssignment antes de
 *      deleteMany de ScheduledShift dentro de la transaction).
 *      B (schema: onDelete: Cascade en la relación).
 *
 * Smoke (reproduce el escenario exacto en la branch Neon disposable):
 *   1. Seed HQ + DIRECTOR.
 *   2. POST /api/hr/schedule (overwrite=false) — crea Schedule DRAFT con
 *      2 shifts (la cuidadora con color RED).
 *   3. Crear MANUALMENTE 1 ShiftColorAssignment apuntando al ScheduledShift
 *      del color RED. Esto reproduce el estado de Celia.
 *   4. POST /api/hr/schedule (overwrite=true) con shifts distintos —
 *      DEBE retornar 200 success:true. Sin el fix, retornaría 500.
 *   5. Verificar en DB:
 *      - Schedule mismo ID (in-place update).
 *      - Shifts viejos borrados (count = new shifts count).
 *      - ShiftColorAssignment huérfana también borrada.
 *   6. Negative test inverso: si dejamos sin fix (no implementable acá —
 *      es una verificación del estado actual del código tras deploy).
 *
 * Run:
 *   DATABASE_URL=<neon-branch-url> BASE_URL=http://127.0.0.1:3077 \
 *     npx tsx scripts/smoke-schedule-overwrite.ts
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const PROD_HOST = 'ep-wispy-queen-ae20881h';
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3077';
const PIN = '1234';

const HQ_ID = '77777777-aaaa-4aaa-8aaa-aaaaaaaaa001';
const DIRECTOR_ID = '77777777-aaaa-4aaa-8aaa-aaaaaaaa9001';
const DIRECTOR_EMAIL = 'director-overwrite@bug.local';
const CG_ID_A = '77777777-aaaa-4aaa-8aaa-aaaaaaaa0001';
const CG_ID_B = '77777777-aaaa-4aaa-8aaa-aaaaaaaa0002';

const url = process.env.DATABASE_URL || '';
const host = url.match(/@(ep-[a-z0-9-]+)/)?.[1] || '';
if (host.startsWith(PROD_HOST)) { console.error('❌ host es PROD'); process.exit(1); }
if (!host) { console.error('❌ DATABASE_URL no set'); process.exit(1); }
console.log(`✓ Branch host: ${host}`);

const p = new PrismaClient({ datasources: { db: { url } } });

interface Check { name: string; pass: boolean; detail?: string; }
const checks: Check[] = [];
function record(name: string, pass: boolean, detail?: string) {
    checks.push({ name, pass, detail });
    console.log(`  ${pass ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
}

function makeJar() {
    const jar: Record<string, string> = {};
    return {
        apply(headers: Headers) {
            const set = (headers as any).getSetCookie?.() ?? (headers.get('set-cookie') ? [headers.get('set-cookie')!] : []);
            for (const sc of set) {
                const first = sc.split(';')[0];
                const idx = first.indexOf('=');
                if (idx <= 0) continue;
                const name = first.slice(0, idx).trim();
                const value = first.slice(idx + 1).trim();
                if (name) jar[name] = value;
            }
        },
        header(): string { return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; '); },
    };
}

async function login(email: string): Promise<string | null> {
    const jar = makeJar();
    const csrfRes = await fetch(`${BASE_URL}/api/auth/csrf`);
    jar.apply(csrfRes.headers);
    const csrf = (await csrfRes.json()).csrfToken;
    const signin = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cookie': jar.header() },
        body: new URLSearchParams({ csrfToken: csrf, email, pinCode: PIN, callbackUrl: '/' }).toString(),
        redirect: 'manual',
    });
    jar.apply(signin.headers);
    const sess = await fetch(`${BASE_URL}/api/auth/session`, { headers: { 'Cookie': jar.header() } });
    const sJson = await sess.json();
    if (!sJson?.user) return null;
    return jar.header();
}

async function seed() {
    console.log('— seed —');
    await p.headquarters.upsert({
        where: { id: HQ_ID },
        update: {},
        create: {
            id: HQ_ID, name: 'HQ Overwrite Test', capacity: 50,
            isActive: true, licenseActive: true,
            licenseExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        },
    });
    const pinHash = await bcrypt.hash(PIN, 10);
    await p.user.upsert({
        where: { id: DIRECTOR_ID },
        update: { email: DIRECTOR_EMAIL, headquartersId: HQ_ID, role: 'DIRECTOR', isActive: true, pinCode: pinHash },
        create: { id: DIRECTOR_ID, email: DIRECTOR_EMAIL, name: 'Dir Overwrite', role: 'DIRECTOR', headquartersId: HQ_ID, isActive: true, pinCode: pinHash },
    });
    await p.user.upsert({
        where: { id: CG_ID_A },
        update: { email: 'cg-overwrite-a@bug.local', headquartersId: HQ_ID, role: 'CAREGIVER', isActive: true, pinCode: pinHash },
        create: { id: CG_ID_A, email: 'cg-overwrite-a@bug.local', name: 'CG A', role: 'CAREGIVER', headquartersId: HQ_ID, isActive: true, pinCode: pinHash },
    });
    await p.user.upsert({
        where: { id: CG_ID_B },
        update: { email: 'cg-overwrite-b@bug.local', headquartersId: HQ_ID, role: 'CAREGIVER', isActive: true, pinCode: pinHash },
        create: { id: CG_ID_B, email: 'cg-overwrite-b@bug.local', name: 'CG B', role: 'CAREGIVER', headquartersId: HQ_ID, isActive: true, pinCode: pinHash },
    });

    // Limpiar Schedules previos de la semana de smoke
    const weekStart = new Date('2026-07-06T00:00:00Z'); // Lunes random sin choque
    await p.shiftColorAssignment.deleteMany({ where: { headquartersId: HQ_ID } });
    await p.scheduledShift.deleteMany({ where: { schedule: { headquartersId: HQ_ID } } });
    await p.schedule.deleteMany({ where: { headquartersId: HQ_ID } });

    console.log('  ✓ seed completo');
    return { weekStart };
}

async function main() {
    const { weekStart } = await seed();
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  Regresión schedule overwrite con ShiftColorAssignment FK');
    console.log('═══════════════════════════════════════════════════════════════');

    const director = await login(DIRECTOR_EMAIL);
    if (!director) { console.error('❌ login falló'); process.exit(1); }

    // ── 1. Crear schedule DRAFT inicial con 2 shifts (CG A morning RED, CG B evening BLUE)
    const dayMon = new Date(weekStart);
    const r1 = await fetch(`${BASE_URL}/api/hr/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': director },
        body: JSON.stringify({
            hqId: HQ_ID,
            weekStartDate: weekStart.toISOString(),
            createdByUserId: DIRECTOR_ID,
            overwrite: false,
            shifts: [
                { userId: CG_ID_A, date: dayMon.toISOString(), shiftType: 'MORNING', colorGroup: 'RED' },
                { userId: CG_ID_B, date: dayMon.toISOString(), shiftType: 'EVENING', colorGroup: 'BLUE' },
            ],
        }),
    });
    const j1 = await r1.json();
    record('1a. POST inicial HTTP 200', r1.status === 200, `HTTP ${r1.status}`);
    record('1b. response.success=true', j1.success === true);
    const scheduleId = j1.schedule?.id;
    record('1c. schedule creado con id', !!scheduleId, scheduleId ? scheduleId.slice(0, 8) + '…' : 'no id');

    // ── 2. Insertar ShiftColorAssignment apuntando al shift de CG A
    const shifts1 = await p.scheduledShift.findMany({ where: { scheduleId }, orderBy: { shiftType: 'asc' } });
    record('2a. 2 shifts persistidos en BD', shifts1.length === 2, `count=${shifts1.length}`);
    const shiftRed = shifts1.find(s => s.colorGroup === 'RED');
    if (!shiftRed) { console.error('❌ no shift RED'); process.exit(1); }

    await p.shiftColorAssignment.create({
        data: {
            id: '88888888-cccc-4ccc-8ccc-cccccccccc01',
            headquartersId: HQ_ID,
            scheduledShiftId: shiftRed.id,
            color: 'RED',
            userId: CG_ID_A,
            isAutoAssigned: false,
        },
    });
    const assignBefore = await p.shiftColorAssignment.count({
        where: { scheduledShift: { scheduleId } },
    });
    record('2b. 1 ShiftColorAssignment creado (bloquearía el bug)', assignBefore === 1, `count=${assignBefore}`);

    // ── 3. Intento overwrite — sin el fix, esto rompía con 500 / "Error al sobrescribir"
    const r2 = await fetch(`${BASE_URL}/api/hr/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': director },
        body: JSON.stringify({
            hqId: HQ_ID,
            weekStartDate: weekStart.toISOString(),
            createdByUserId: DIRECTOR_ID,
            overwrite: true,
            shifts: [
                // Shifts NUEVOS — distintos a los originales
                { userId: CG_ID_A, date: dayMon.toISOString(), shiftType: 'EVENING', colorGroup: 'YELLOW' },
                { userId: CG_ID_B, date: dayMon.toISOString(), shiftType: 'MORNING', colorGroup: 'GREEN' },
                { userId: CG_ID_A, date: new Date(dayMon.getTime() + 86400000).toISOString(), shiftType: 'NIGHT', colorGroup: 'BLUE' },
            ],
        }),
    });
    const j2 = await r2.json();
    record('3a. POST overwrite HTTP 200 (el bug retornaba 500)', r2.status === 200, `HTTP ${r2.status}`);
    record('3b. response.success=true', j2.success === true, j2.error || 'OK');
    record('3c. response.overwritten=true', j2.overwritten === true);
    record('3d. mismo schedule.id (in-place update)', j2.schedule?.id === scheduleId);

    // ── 4. Verificar estado final en BD
    const shifts2 = await p.scheduledShift.findMany({ where: { scheduleId }, orderBy: { shiftType: 'asc' } });
    record('4a. shifts reemplazados (3 nuevos)', shifts2.length === 3, `count=${shifts2.length}`);
    const colors = shifts2.map(s => s.colorGroup).sort();
    record('4b. colores nuevos persistidos (YELLOW, GREEN, BLUE)',
        JSON.stringify(colors) === JSON.stringify(['BLUE', 'GREEN', 'YELLOW']),
        `colors=${JSON.stringify(colors)}`);
    const assignAfter = await p.shiftColorAssignment.count({
        where: { scheduledShift: { scheduleId } },
    });
    record('4c. ShiftColorAssignment huérfana borrada (cascade/defensa)',
        assignAfter === 0,
        `count=${assignAfter}`);
    // FK consistency: no debe quedar ShiftColorAssignment apuntando a shifts borrados
    const orphans = await p.$queryRaw`
        SELECT COUNT(*)::int AS n FROM "ShiftColorAssignment" sca
        WHERE NOT EXISTS (SELECT 1 FROM "ScheduledShift" ss WHERE ss.id = sca."scheduledShiftId")
    ` as any[];
    record('4d. cero huérfanos globales en ShiftColorAssignment',
        orphans[0].n === 0, `huérfanos=${orphans[0].n}`);

    // ── 5. Schedule sigue siendo DRAFT
    const finalSchedule = await p.schedule.findUnique({ where: { id: scheduleId } });
    record('5. Schedule sigue como DRAFT (status preservado)',
        finalSchedule?.status === 'DRAFT', `status=${finalSchedule?.status}`);

    // ── Resumen ─────────────────────────────────────────────────────────────
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    const passed = checks.filter(c => c.pass).length;
    const failed = checks.filter(c => !c.pass).length;
    console.log(`  Resultado: ${passed}/${checks.length} ✓  (${failed} fallas)`);
    console.log('═══════════════════════════════════════════════════════════════');

    if (failed > 0) {
        console.log('');
        console.log('FALLAS:');
        checks.filter(c => !c.pass).forEach(c => console.log(`  ✗ ${c.name}${c.detail ? ` — ${c.detail}` : ''}`));
        process.exit(1);
    }
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); }).finally(() => p.$disconnect());
