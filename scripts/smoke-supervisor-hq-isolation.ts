/**
 * scripts/smoke-supervisor-hq-isolation.ts — test de regresión multi-tenant.
 *
 * CONTEXTO: el endpoint GET /api/care/supervisor base tenía un leak:
 * scheduledShift.findMany filtraba solo por `schedule.status: 'PUBLISHED'`
 * sin `schedule.headquartersId`. El SUP de cualquier sede veía pautas
 * publicadas de TODAS las sedes en el panel "Personal No Presentado".
 *
 * Cazado durante el smoke visual del sprint floor-map (jun-2026). Hubo
 * sweep previo de aislamiento; esta ruta se escapó porque vive en
 * `route.ts` plano (no subdirectorio). Este test evita que vuelva a
 * escaparse en sweeps futuros.
 *
 * Smoke:
 *   1. Seed: 2 HQs (Alpha, Beta), 1 SUP por HQ, 2 cuidadoras por HQ con
 *      Schedule PUBLISHED + ScheduledShift del turno actual.
 *   2. GET /api/care/supervisor como SUP-Alpha.
 *   3. ASSERT: response.schedules NO contiene ningún ScheduledShift cuyo
 *      schedule.headquartersId !== Alpha. (Confirma el filtro hq scoped.)
 *   4. Cross-check inverso: SUP-Beta NO ve nada de Alpha.
 *
 * Run:
 *   DATABASE_URL=<neon-branch-url> BASE_URL=http://127.0.0.1:3077 \
 *     npx tsx scripts/smoke-supervisor-hq-isolation.ts
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const PROD_HOST = 'ep-wispy-queen-ae20881h';
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3077';
const PIN = '1234';

const HQ_ALPHA = '44444444-aaaa-4aaa-8aaa-aaaaaaaaa001';
const HQ_BETA = '44444444-bbbb-4bbb-8bbb-bbbbbbbbb001';

const SUP_ALPHA_EMAIL = 'sup-alpha@hqleak.local';
const SUP_BETA_EMAIL = 'sup-beta@hqleak.local';

const CG_ALPHA_1 = '55555555-aaaa-4aaa-8aaa-aaaaaaaa0001';
const CG_ALPHA_2 = '55555555-aaaa-4aaa-8aaa-aaaaaaaa0002';
const CG_BETA_1 = '55555555-bbbb-4bbb-8bbb-bbbbbbbb0001';
const CG_BETA_2 = '55555555-bbbb-4bbb-8bbb-bbbbbbbb0002';

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

// Infer turno actual igual que el endpoint (AST)
function currentShiftType(): string {
    const astFmt = new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/Puerto_Rico' });
    const h = parseInt(astFmt.format(new Date()), 10) % 24;
    if (h >= 6 && h < 14) return 'MORNING';
    if (h >= 14 && h < 22) return 'EVENING';
    return 'NIGHT';
}

async function upsertHq(id: string, name: string) {
    await p.headquarters.upsert({
        where: { id },
        update: {},
        create: {
            id, name, capacity: 50, isActive: true,
            licenseActive: true, licenseExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        },
    });
}

async function upsertUser(id: string, email: string, name: string, role: string, hqId: string) {
    const pinHash = await bcrypt.hash(PIN, 10);
    await p.user.upsert({
        where: { id },
        update: { email, headquartersId: hqId, role: role as any, isActive: true, pinCode: pinHash },
        create: { id, email, name, role: role as any, headquartersId: hqId, isActive: true, pinCode: pinHash },
    });
}

async function seedPublishedShift(scheduleId: string, ssId: string, hqId: string, userId: string, color: string, shiftType: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    await p.schedule.upsert({
        where: { id: scheduleId },
        update: { status: 'PUBLISHED' },
        create: {
            id: scheduleId, headquartersId: hqId,
            weekStartDate: today, status: 'PUBLISHED', createdByUserId: userId,
        },
    });
    await p.scheduledShift.upsert({
        where: { id: ssId },
        update: { colorGroup: color, shiftType: shiftType as any, date: today, isAbsent: false },
        create: {
            id: ssId, scheduleId, userId,
            date: today, shiftType: shiftType as any,
            colorGroup: color, isAbsent: false,
        },
    });
}

async function seed() {
    console.log('— seed —');
    await upsertHq(HQ_ALPHA, 'HQ Alpha (leak test)');
    await upsertHq(HQ_BETA, 'HQ Beta (leak test)');

    await upsertUser('66666666-aaaa-4aaa-8aaa-aaaaaaaa9001', SUP_ALPHA_EMAIL, 'Sup Alpha', 'SUPERVISOR', HQ_ALPHA);
    await upsertUser('66666666-bbbb-4bbb-8bbb-bbbbbbbb9001', SUP_BETA_EMAIL, 'Sup Beta', 'SUPERVISOR', HQ_BETA);

    await upsertUser(CG_ALPHA_1, 'cg-alpha-1@hqleak.local', 'CG Alpha 1', 'CAREGIVER', HQ_ALPHA);
    await upsertUser(CG_ALPHA_2, 'cg-alpha-2@hqleak.local', 'CG Alpha 2', 'CAREGIVER', HQ_ALPHA);
    await upsertUser(CG_BETA_1, 'cg-beta-1@hqleak.local', 'CG Beta 1', 'CAREGIVER', HQ_BETA);
    await upsertUser(CG_BETA_2, 'cg-beta-2@hqleak.local', 'CG Beta 2', 'CAREGIVER', HQ_BETA);

    const shiftType = currentShiftType();
    await seedPublishedShift('sch-alpha-leak', 'ss-alpha-1', HQ_ALPHA, CG_ALPHA_1, 'RED', shiftType);
    await seedPublishedShift('sch-alpha-leak', 'ss-alpha-2', HQ_ALPHA, CG_ALPHA_2, 'BLUE', shiftType);
    await seedPublishedShift('sch-beta-leak', 'ss-beta-1', HQ_BETA, CG_BETA_1, 'GREEN', shiftType);
    await seedPublishedShift('sch-beta-leak', 'ss-beta-2', HQ_BETA, CG_BETA_2, 'YELLOW', shiftType);

    console.log(`  ✓ seed completo (turno=${shiftType})`);
}

async function main() {
    await seed();
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  Regresión multi-tenant — GET /api/care/supervisor');
    console.log('═══════════════════════════════════════════════════════════════');

    const supAlpha = await login(SUP_ALPHA_EMAIL);
    const supBeta = await login(SUP_BETA_EMAIL);
    if (!supAlpha || !supBeta) { console.error('❌ login falló'); process.exit(1); }

    // ── 1. SUP-Alpha pide /supervisor ───────────────────────────────────────
    const rA = await fetch(`${BASE_URL}/api/care/supervisor`, { headers: { Cookie: supAlpha } });
    const jA = await rA.json();
    record('1a. SUP-Alpha HTTP 200', rA.status === 200, `HTTP ${rA.status}`);
    record('1b. response.success=true', jA.success === true);
    record('1c. schedules es array', Array.isArray(jA.schedules));

    // ── 2. Aislamiento: NINGÚN scheduled shift de Beta en respuesta de Alpha
    const schedulesAlpha = (jA.schedules || []) as any[];
    const betaShiftIds = ['ss-beta-1', 'ss-beta-2'];
    const leakedIntoAlpha = schedulesAlpha.filter(s => betaShiftIds.includes(s.id));
    record('2a. NO leak: SUP-Alpha NO ve ScheduledShift de Beta',
        leakedIntoAlpha.length === 0,
        leakedIntoAlpha.length > 0 ? `leak: ${leakedIntoAlpha.map(s => s.id).join(', ')}` : 'aislamiento OK');

    // Cross-check positivo: SUP-Alpha SÍ ve sus 2 ScheduledShifts
    const ownShiftIds = ['ss-alpha-1', 'ss-alpha-2'];
    const alphaSees = schedulesAlpha.filter(s => ownShiftIds.includes(s.id));
    record('2b. SUP-Alpha SÍ ve sus 2 ScheduledShifts',
        alphaSees.length === 2,
        `vio ${alphaSees.length}/2`);

    // schedule.headquartersId del include debe ser SOLO Alpha
    const allHqIds = new Set(schedulesAlpha.map(s => s.schedule?.headquartersId).filter(Boolean));
    record('2c. TODOS los schedule.headquartersId === HQ_ALPHA',
        allHqIds.size === 1 && allHqIds.has(HQ_ALPHA),
        `hqIds vistos: ${[...allHqIds].join(', ')}`);

    // ── 3. SUP-Beta cross-check inverso ─────────────────────────────────────
    const rB = await fetch(`${BASE_URL}/api/care/supervisor`, { headers: { Cookie: supBeta } });
    const jB = await rB.json();
    record('3a. SUP-Beta HTTP 200', rB.status === 200, `HTTP ${rB.status}`);
    const schedulesBeta = (jB.schedules || []) as any[];
    const alphaIntoBeta = schedulesBeta.filter(s => ownShiftIds.includes(s.id));
    record('3b. NO leak inverso: SUP-Beta NO ve ScheduledShift de Alpha',
        alphaIntoBeta.length === 0,
        alphaIntoBeta.length > 0 ? `leak: ${alphaIntoBeta.map(s => s.id).join(', ')}` : 'aislamiento OK');
    const betaOwn = schedulesBeta.filter(s => betaShiftIds.includes(s.id));
    record('3c. SUP-Beta SÍ ve sus 2 ScheduledShifts',
        betaOwn.length === 2,
        `vio ${betaOwn.length}/2`);
    const allHqIdsB = new Set(schedulesBeta.map(s => s.schedule?.headquartersId).filter(Boolean));
    record('3d. TODOS los schedule.headquartersId === HQ_BETA',
        allHqIdsB.size === 1 && allHqIdsB.has(HQ_BETA),
        `hqIds vistos: ${[...allHqIdsB].join(', ')}`);

    // ── 4. Auth gate sin cookies → 401
    {
        const r = await fetch(`${BASE_URL}/api/care/supervisor`);
        record('4. Sin auth → 401', r.status === 401, `HTTP ${r.status}`);
    }

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
