/**
 * scripts/smoke-floor-map-e2e.ts — HTTP smoke contra Neon branch desechable.
 *
 * Asume dev server corriendo en BASE_URL (default 127.0.0.1:3066) apuntando
 * al branch. CREA su propio seed (autosuficiente).
 *
 * Cubre los escenarios DB-dependientes (los puros viven en
 * smoke-floor-map-unit.ts):
 *
 *   1.  Endpoint /api/care/supervisor/caregiver-rounds:
 *       - floorsConfigured=true cuando HQ tiene map
 *       - activeFloors ordenados con cuidadoras agrupadas
 *       - caregivers[].floors derivados del color del turno
 *       - unassignedFloorPatientsCount cuenta residentes UNASSIGNED
 *   2.  Endpoint /api/care/shift/coverage retorna colorFloorMap del HQ
 *   3.  Multi-tenant: HQ-Cupey map NUNCA aparece en HQ-Mayagüez response
 *   4.  HQ-Legacy (map=null) cae a floorsConfigured=false (modo legacy)
 *   5.  Sentinel ámbar: cuidadora con color sin mapear marca hasUnmappedFloor
 *
 * Run:
 *   DATABASE_URL=<neon-branch-url> BASE_URL=http://127.0.0.1:3066 \
 *     npx tsx scripts/smoke-floor-map-e2e.ts
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const PROD_HOST = 'ep-wispy-queen-ae20881h';
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3066';
const PIN = '1234';

// IDs estables del seed — UUIDs v4 reservados (zeros + sufijo descriptivo)
const HQ_CUPEY = '11111111-1111-4111-8111-111111111101';
const HQ_MAYAGUEZ = '11111111-1111-4111-8111-111111111102';
const HQ_LEGACY = '11111111-1111-4111-8111-111111111103';

const CUPEY_MAP = {
    RED: 'Piso 1',
    YELLOW: 'Piso 1',
    GREEN: 'Piso 2',
    BLUE: 'Piso 3',
};
const MAYAGUEZ_MAP = {
    RED: 'Norte',
    BLUE: 'Sur',
    // GREEN/YELLOW deliberadamente sin mapear → caen a sentinel
};

const SUP_CUPEY_EMAIL = 'sup-cupey@floormap.local';
const SUP_MAYAGUEZ_EMAIL = 'sup-mayaguez@floormap.local';
const SUP_LEGACY_EMAIL = 'sup-legacy@floormap.local';

const CG_CUPEY_RED = '22222222-2222-4222-8222-222222222a01';
const CG_CUPEY_BLUE = '22222222-2222-4222-8222-222222222a02';
const CG_MAYAGUEZ_RED = '22222222-2222-4222-8222-222222222b01';
const CG_MAYAGUEZ_GREEN = '22222222-2222-4222-8222-222222222b02'; // color sin mapear
const CG_LEGACY = '22222222-2222-4222-8222-222222222c01';

const url = process.env.DATABASE_URL || '';
const host = url.match(/@(ep-[a-z0-9-]+)/)?.[1] || '';
if (host.startsWith(PROD_HOST)) { console.error('❌ host es PROD — abort'); process.exit(1); }
if (!host) { console.error('❌ DATABASE_URL no set'); process.exit(1); }
console.log(`✓ Branch host: ${host} (no prod, OK)`);

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

async function login(email: string): Promise<{ cookies: string; user: any } | null> {
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
    return { cookies: jar.header(), user: sJson.user };
}

async function upsertHq(id: string, name: string, map: any | null) {
    await p.headquarters.upsert({
        where: { id },
        update: { colorFloorMap: map as any },
        create: {
            id, name,
            capacity: 50, isActive: true,
            licenseActive: true, licenseExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            colorFloorMap: map as any,
        },
    });
}

async function upsertUser(id: string, email: string, name: string, role: string, hqId: string, secondaryRoles: string[] = []) {
    const pinHash = await bcrypt.hash(PIN, 10);
    await p.user.upsert({
        where: { id },
        update: { email, headquartersId: hqId, role: role as any, secondaryRoles: secondaryRoles as any, isActive: true, pinCode: pinHash },
        create: {
            id, email, name, role: role as any,
            headquartersId: hqId, isActive: true, pinCode: pinHash,
            secondaryRoles: secondaryRoles as any,
        },
    });
}

async function upsertPatient(id: string, name: string, hqId: string, color: 'RED' | 'YELLOW' | 'GREEN' | 'BLUE' | 'UNASSIGNED') {
    await p.patient.upsert({
        where: { id },
        update: { headquartersId: hqId, status: 'ACTIVE', colorGroup: color as any },
        create: {
            id, name, headquartersId: hqId, status: 'ACTIVE',
            colorGroup: color as any, dateOfBirth: new Date('1940-01-01'),
        },
    });
}

async function seedActiveShift(caregiverId: string, hqId: string, color: 'RED' | 'YELLOW' | 'GREEN' | 'BLUE' | 'ALL', shiftType: string) {
    // ShiftSession activa
    const now = new Date();
    const sessId = `sess-${caregiverId}`;
    await p.shiftSession.upsert({
        where: { id: sessId },
        update: { startTime: now, actualEndTime: null },
        create: {
            id: sessId, caregiverId, headquartersId: hqId,
            startTime: now,
        },
    });
    // ScheduledShift hoy con colorGroup + Schedule PUBLISHED
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const scheduleId = `sch-${hqId}-week`;
    await p.schedule.upsert({
        where: { id: scheduleId },
        update: { status: 'PUBLISHED' },
        create: {
            id: scheduleId, headquartersId: hqId,
            weekStartDate: today, status: 'PUBLISHED', createdByUserId: caregiverId,
        },
    });
    const ssId = `ss-${caregiverId}`;
    await p.scheduledShift.upsert({
        where: { id: ssId },
        update: { colorGroup: color, shiftType: shiftType as any, date: today, isAbsent: false, releasedAt: null },
        create: {
            id: ssId, scheduleId, userId: caregiverId,
            date: today, shiftType: shiftType as any,
            colorGroup: color, isAbsent: false,
        },
    });
}

async function seed() {
    console.log('— seed —');
    await upsertHq(HQ_CUPEY, 'Cupey (floor-map smoke)', CUPEY_MAP);
    await upsertHq(HQ_MAYAGUEZ, 'Mayagüez (floor-map smoke)', MAYAGUEZ_MAP);
    await upsertHq(HQ_LEGACY, 'Legacy HQ (no map)', null);

    // Supervisores (un user por HQ)
    await upsertUser('99999999-1111-4111-8111-111111111101', SUP_CUPEY_EMAIL, 'Sup Cupey', 'SUPERVISOR', HQ_CUPEY);
    await upsertUser('99999999-1111-4111-8111-111111111102', SUP_MAYAGUEZ_EMAIL, 'Sup Mayagüez', 'SUPERVISOR', HQ_MAYAGUEZ);
    await upsertUser('99999999-1111-4111-8111-111111111103', SUP_LEGACY_EMAIL, 'Sup Legacy', 'SUPERVISOR', HQ_LEGACY);

    // Cuidadoras
    await upsertUser(CG_CUPEY_RED, 'cg-cupey-red@floormap.local', 'Cupey Red', 'CAREGIVER', HQ_CUPEY);
    await upsertUser(CG_CUPEY_BLUE, 'cg-cupey-blue@floormap.local', 'Cupey Blue', 'CAREGIVER', HQ_CUPEY);
    await upsertUser(CG_MAYAGUEZ_RED, 'cg-may-red@floormap.local', 'Mayagüez Red', 'CAREGIVER', HQ_MAYAGUEZ);
    await upsertUser(CG_MAYAGUEZ_GREEN, 'cg-may-green@floormap.local', 'Mayagüez Green (huérfana)', 'CAREGIVER', HQ_MAYAGUEZ);
    await upsertUser(CG_LEGACY, 'cg-legacy@floormap.local', 'CG Legacy', 'CAREGIVER', HQ_LEGACY);

    // Pacientes — variedad de colores incluyendo UNASSIGNED (sentinel)
    await upsertPatient('33333333-1111-4111-8111-c00000000001', 'Patient Cupey 1', HQ_CUPEY, 'RED');
    await upsertPatient('33333333-1111-4111-8111-c00000000002', 'Patient Cupey 2', HQ_CUPEY, 'YELLOW');
    await upsertPatient('33333333-1111-4111-8111-c00000000003', 'Patient Cupey 3', HQ_CUPEY, 'BLUE');
    await upsertPatient('33333333-1111-4111-8111-c00000000004', 'Patient Cupey 4', HQ_CUPEY, 'UNASSIGNED'); // → sentinel

    await upsertPatient('33333333-2222-4222-8222-m00000000001', 'Patient May 1', HQ_MAYAGUEZ, 'RED');
    await upsertPatient('33333333-2222-4222-8222-m00000000002', 'Patient May 2', HQ_MAYAGUEZ, 'GREEN'); // unmapped → sentinel
    await upsertPatient('33333333-2222-4222-8222-m00000000003', 'Patient May 3', HQ_MAYAGUEZ, 'BLUE');

    await upsertPatient('33333333-3333-4333-8333-l00000000001', 'Patient Legacy 1', HQ_LEGACY, 'RED');

    // ShiftSessions activas + ScheduledShifts publicados
    await seedActiveShift(CG_CUPEY_RED, HQ_CUPEY, 'RED', 'MORNING');
    await seedActiveShift(CG_CUPEY_BLUE, HQ_CUPEY, 'BLUE', 'MORNING');
    await seedActiveShift(CG_MAYAGUEZ_RED, HQ_MAYAGUEZ, 'RED', 'MORNING');
    await seedActiveShift(CG_MAYAGUEZ_GREEN, HQ_MAYAGUEZ, 'GREEN', 'MORNING'); // color sin map → unmapped
    await seedActiveShift(CG_LEGACY, HQ_LEGACY, 'RED', 'MORNING');

    console.log('  ✓ seed completo');
}

async function main() {
    await seed();
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  HTTP smoke — floor-map endpoints');
    console.log('═══════════════════════════════════════════════════════════════');

    const supCupey = await login(SUP_CUPEY_EMAIL);
    if (!supCupey) { console.error('❌ login Cupey supervisor falló'); process.exit(1); }
    const supMay = await login(SUP_MAYAGUEZ_EMAIL);
    if (!supMay) { console.error('❌ login Mayagüez supervisor falló'); process.exit(1); }
    const supLegacy = await login(SUP_LEGACY_EMAIL);
    if (!supLegacy) { console.error('❌ login Legacy supervisor falló'); process.exit(1); }

    // ───────────────────────────────────────────────────────────────
    // 1. /caregiver-rounds en Cupey — pisos configurados, secciones OK
    // ───────────────────────────────────────────────────────────────
    {
        const r = await fetch(`${BASE_URL}/api/care/supervisor/caregiver-rounds?hqId=${HQ_CUPEY}`, {
            headers: { Cookie: supCupey.cookies },
        });
        const j = await r.json();
        record('1a. /caregiver-rounds Cupey HTTP 200', r.status === 200);
        record('1b. floorsConfigured=true', j.floorsConfigured === true);
        record('1c. activeFloors contiene Piso 1', Array.isArray(j.activeFloors) && j.activeFloors.includes('Piso 1'));
        record('1d. activeFloors contiene Piso 3', Array.isArray(j.activeFloors) && j.activeFloors.includes('Piso 3'));
        record('1e. activeFloors ordenado alfabéticamente',
            JSON.stringify(j.activeFloors) === JSON.stringify([...j.activeFloors].sort()),
            JSON.stringify(j.activeFloors));
        record('1f. unassignedFloorPatientsCount = 1 (UNASSIGNED patient)',
            j.unassignedFloorPatientsCount === 1,
            `count=${j.unassignedFloorPatientsCount}`);
        const cgRed = (j.caregivers || []).find((c: any) => c.caregiverId === CG_CUPEY_RED);
        const cgBlue = (j.caregivers || []).find((c: any) => c.caregiverId === CG_CUPEY_BLUE);
        record('1g. CG Red tiene floors=[Piso 1]', cgRed && JSON.stringify(cgRed.floors) === '["Piso 1"]', cgRed ? JSON.stringify(cgRed.floors) : 'cg no found');
        record('1h. CG Blue tiene floors=[Piso 3]', cgBlue && JSON.stringify(cgBlue.floors) === '["Piso 3"]', cgBlue ? JSON.stringify(cgBlue.floors) : 'cg no found');
        record('1i. CG Red hasUnmappedFloor=false', cgRed && cgRed.hasUnmappedFloor === false);
    }

    // ───────────────────────────────────────────────────────────────
    // 2. /caregiver-rounds en Mayagüez — map distinto + sentinel
    // ───────────────────────────────────────────────────────────────
    {
        const r = await fetch(`${BASE_URL}/api/care/supervisor/caregiver-rounds?hqId=${HQ_MAYAGUEZ}`, {
            headers: { Cookie: supMay.cookies },
        });
        const j = await r.json();
        record('2a. /caregiver-rounds Mayagüez HTTP 200', r.status === 200);
        record('2b. floorsConfigured=true', j.floorsConfigured === true);
        record('2c. activeFloors solo "Norte" (GREEN cae a sentinel)',
            JSON.stringify(j.activeFloors) === JSON.stringify(['Norte']),
            JSON.stringify(j.activeFloors));
        // Multi-tenant: Cupey labels NUNCA en Mayagüez
        const hasPiso1 = (j.activeFloors || []).some((f: string) => f === 'Piso 1' || f === 'Piso 2' || f === 'Piso 3');
        record('2d. Multi-tenant: NO labels de Cupey en Mayagüez', !hasPiso1);

        const cgRedMay = (j.caregivers || []).find((c: any) => c.caregiverId === CG_MAYAGUEZ_RED);
        const cgGreenMay = (j.caregivers || []).find((c: any) => c.caregiverId === CG_MAYAGUEZ_GREEN);
        record('2e. CG Red Mayagüez tiene floors=[Norte]',
            cgRedMay && JSON.stringify(cgRedMay.floors) === '["Norte"]',
            cgRedMay ? JSON.stringify(cgRedMay.floors) : 'cg no found');
        record('2f. CG Green (sin map) → floors=[]',
            cgGreenMay && JSON.stringify(cgGreenMay.floors) === '[]',
            cgGreenMay ? JSON.stringify(cgGreenMay.floors) : 'cg no found');
        record('2g. CG Green hasUnmappedFloor=true (señal sentinel ámbar)',
            cgGreenMay && cgGreenMay.hasUnmappedFloor === true);

        // Sentinel pacientes: GREEN no mapeado → 1 paciente huérfano
        record('2h. unassignedFloorPatientsCount = 1 (Patient May 2 GREEN sin map)',
            j.unassignedFloorPatientsCount === 1,
            `count=${j.unassignedFloorPatientsCount}`);
    }

    // ───────────────────────────────────────────────────────────────
    // 3. /caregiver-rounds en Legacy HQ — map=null → modo legacy
    // ───────────────────────────────────────────────────────────────
    {
        const r = await fetch(`${BASE_URL}/api/care/supervisor/caregiver-rounds?hqId=${HQ_LEGACY}`, {
            headers: { Cookie: supLegacy.cookies },
        });
        const j = await r.json();
        record('3a. /caregiver-rounds Legacy HTTP 200', r.status === 200);
        record('3b. floorsConfigured=false (map null)', j.floorsConfigured === false);
        record('3c. activeFloors=[] (sin agrupación)',
            JSON.stringify(j.activeFloors) === '[]');
        record('3d. unassignedFloorPatientsCount=0 (legacy mode, no count)',
            j.unassignedFloorPatientsCount === 0);
        record('3e. caregivers todavía se listan (legacy NO rompe)',
            Array.isArray(j.caregivers) && j.caregivers.length >= 1);
    }

    // ───────────────────────────────────────────────────────────────
    // 4. /shift/coverage retorna colorFloorMap del HQ
    // ───────────────────────────────────────────────────────────────
    {
        const r = await fetch(`${BASE_URL}/api/care/shift/coverage?hqId=${HQ_CUPEY}`, {
            headers: { Cookie: supCupey.cookies },
        });
        const j = await r.json();
        record('4a. /shift/coverage Cupey HTTP 200', r.status === 200);
        record('4b. response incluye colorFloorMap',
            j.colorFloorMap && typeof j.colorFloorMap === 'object');
        record('4c. map del HQ correcto (RED → Piso 1)',
            j.colorFloorMap?.RED === 'Piso 1');

        const r2 = await fetch(`${BASE_URL}/api/care/shift/coverage?hqId=${HQ_LEGACY}`, {
            headers: { Cookie: supLegacy.cookies },
        });
        const j2 = await r2.json();
        record('4d. Legacy HQ retorna colorFloorMap=null',
            j2.colorFloorMap === null);
    }

    // ───────────────────────────────────────────────────────────────
    // 5. Cross-tenant: Cupey supervisor NO ve data de Mayagüez
    // ───────────────────────────────────────────────────────────────
    {
        // Pedir explícitamente Mayagüez con cookies de Cupey — debe rechazar
        // o silenciosamente devolver Cupey (resolveEffectiveHqId logic).
        const r = await fetch(`${BASE_URL}/api/care/supervisor/caregiver-rounds?hqId=${HQ_MAYAGUEZ}`, {
            headers: { Cookie: supCupey.cookies },
        });
        const j = await r.json();
        // Validar que las cuidadoras devueltas SON de Cupey, no de Mayagüez
        const allFromCupey = (j.caregivers || []).every((c: any) =>
            c.caregiverId === CG_CUPEY_RED || c.caregiverId === CG_CUPEY_BLUE
        );
        record('5a. Cupey sup pidiendo Mayagüez → ve solo data de Cupey o 4xx',
            r.status === 200 ? allFromCupey : (r.status === 400 || r.status === 403));
    }

    // ───────────────────────────────────────────────────────────────
    // Resumen
    // ───────────────────────────────────────────────────────────────
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

main()
    .catch(e => { console.error('FATAL:', e); process.exit(1); })
    .finally(() => p.$disconnect());
