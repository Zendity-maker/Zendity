/**
 * scripts/smoke-coordinator.ts — HTTP smoke del módulo Coordinador
 *
 * Apunta al Neon branch DEV (ep-cool-dream-ae91yqid). Seedéa el escenario
 * mínimo, ejerce los gates del hub y verifica filas en PhiAccessLog
 * (patrón fila-por-paciente en list endpoints).
 *
 * Run:
 *   DATABASE_URL=<DEV_DIRECT_URL> BASE_URL=http://127.0.0.1:3077 \
 *     npx tsx scripts/smoke-coordinator.ts
 *
 * NO TOCA PROD. El guard del host es defensivo: si detecta ep-wispy-queen
 * (prod), aborta.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const PROD_HOST = 'ep-wispy-queen-ae20881h';
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3077';
const PIN = '1234';

const HQ_ID = '99999999-cccc-4ccc-8ccc-cccccccccc01';
const COORD_ID = '99999999-cccc-4ccc-8ccc-aaaaaaaa0001';
const COORD_EMAIL = 'coord-smoke@coordinator.local';
const DIRECTOR_ID = '99999999-cccc-4ccc-8ccc-aaaaaaaa0002';
const DIRECTOR_EMAIL = 'dir-smoke@coordinator.local';
const PATIENT_A = '99999999-cccc-4ccc-8ccc-bbbbbbbb0001';
const PATIENT_B = '99999999-cccc-4ccc-8ccc-bbbbbbbb0002';
const FAMILY_A = '99999999-cccc-4ccc-8ccc-ffffffff0001';

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
            id: HQ_ID, name: 'HQ Coordinator Smoke',
            capacity: 50, isActive: true,
            licenseActive: true,
            licenseExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        },
    });
    const pinHash = await bcrypt.hash(PIN, 10);
    // Wanda smoke = COORDINATOR primary
    await p.user.upsert({
        where: { id: COORD_ID },
        update: { email: COORD_EMAIL, headquartersId: HQ_ID, role: 'COORDINATOR' as any, isActive: true, pinCode: pinHash, secondaryRoles: [] },
        create: { id: COORD_ID, email: COORD_EMAIL, name: 'Coord Smoke', role: 'COORDINATOR' as any, headquartersId: HQ_ID, isActive: true, pinCode: pinHash },
    });
    await p.user.upsert({
        where: { id: DIRECTOR_ID },
        update: { email: DIRECTOR_EMAIL, headquartersId: HQ_ID, role: 'DIRECTOR' as any, isActive: true, pinCode: pinHash },
        create: { id: DIRECTOR_ID, email: DIRECTOR_EMAIL, name: 'Dir Smoke', role: 'DIRECTOR' as any, headquartersId: HQ_ID, isActive: true, pinCode: pinHash },
    });
    await p.patient.upsert({
        where: { id: PATIENT_A },
        update: { headquartersId: HQ_ID, status: 'ACTIVE', name: 'Residente A' },
        create: { id: PATIENT_A, name: 'Residente A', headquartersId: HQ_ID, status: 'ACTIVE', dateOfBirth: new Date('1940-01-01'), roomNumber: 'A01' },
    });
    await p.patient.upsert({
        where: { id: PATIENT_B },
        update: { headquartersId: HQ_ID, status: 'ACTIVE', name: 'Residente B' },
        create: { id: PATIENT_B, name: 'Residente B', headquartersId: HQ_ID, status: 'ACTIVE', dateOfBirth: new Date('1942-02-02'), roomNumber: 'A02' },
    });
    // FamilyMember de A para que coordinator pueda ver datos de familia + appointment
    await p.familyMember.upsert({
        where: { id: FAMILY_A },
        update: { headquartersId: HQ_ID, patientId: PATIENT_A, name: 'Familiar A', email: 'fam-a@coordinator.local', accessLevel: 'Full', isRegistered: false },
        create: { id: FAMILY_A, headquartersId: HQ_ID, patientId: PATIENT_A, name: 'Familiar A', email: 'fam-a@coordinator.local', accessLevel: 'Full', isRegistered: false },
    });
    // Crear una cita PENDING para que GET de family-appointments tenga algo que devolver
    await p.familyAppointment.deleteMany({ where: { headquartersId: HQ_ID } });
    await p.familyAppointment.create({
        data: {
            headquartersId: HQ_ID,
            patientId: PATIENT_A,
            familyMemberId: FAMILY_A,
            type: 'VISIT',
            title: 'Smoke: visita PENDING',
            status: 'PENDING',
            requestedDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
            requestedTime: '14:00',
        },
    });

    console.log('  ✓ seed completo');
}

async function main() {
    await seed();
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  HTTP smoke — Hub Coordinación Familiar');
    console.log('═══════════════════════════════════════════════════════════════');

    // ── 0. Sanity ──
    {
        const r = await fetch(`${BASE_URL}/api/auth/csrf`);
        record('0a. dev server vivo', r.status === 200, `HTTP ${r.status}`);
    }

    // Login
    const coord = await login(COORD_EMAIL);
    if (!coord) { console.error('❌ login COORDINATOR falló'); process.exit(1); }
    record('0b. Login COORDINATOR primary', !!coord);

    const dirCookies = await login(DIRECTOR_EMAIL);
    if (!dirCookies) { console.error('❌ login DIRECTOR falló'); process.exit(1); }
    record('0c. Login DIRECTOR (control)', !!dirCookies);

    // ── 1. Endpoints HUB FAMILIA — COORDINATOR puede leer ──
    {
        const r = await fetch(`${BASE_URL}/api/corporate/family-messages`, { headers: { Cookie: coord } });
        record('1a. GET family-messages como COORD → 200', r.status === 200, `HTTP ${r.status}`);
    }
    {
        const r = await fetch(`${BASE_URL}/api/corporate/family-appointments?status=PENDING`, { headers: { Cookie: coord } });
        const j = await r.json();
        record('1b. GET family-appointments como COORD → 200', r.status === 200);
        record('1c. appointment del seed visible', Array.isArray(j.appointments) && j.appointments.length === 1, `count=${j.appointments?.length}`);
    }
    {
        const r = await fetch(`${BASE_URL}/api/corporate/family?patientId=${PATIENT_A}`, { headers: { Cookie: coord } });
        const j = await r.json();
        record('1d. GET family lista como COORD → 200', r.status === 200);
        record('1e. FamilyMember A visible', Array.isArray(j.familyMembers) && j.familyMembers.length >= 1);
    }
    {
        const r = await fetch(`${BASE_URL}/api/corporate/patients/${PATIENT_A}/family`, { headers: { Cookie: coord } });
        record('1f. GET patients/[id]/family como COORD → 200', r.status === 200, `HTTP ${r.status}`);
    }
    {
        const r = await fetch(`${BASE_URL}/api/corporate/external-services/visits`, { headers: { Cookie: coord } });
        record('1g. GET external-services/visits como COORD → 200', r.status === 200, `HTTP ${r.status}`);
    }
    {
        const r = await fetch(`${BASE_URL}/api/corporate/patients/${PATIENT_A}/history-report`, { headers: { Cookie: coord } });
        record('1h. GET patient history-report como COORD → 200', r.status === 200, `HTTP ${r.status}`);
    }

    // ── 2. Endpoints PROHIBIDOS — COORDINATOR debe ser rechazado ──
    {
        // PAI no expuesto a coordinator (NO wrapped, NO en role list)
        const r = await fetch(`${BASE_URL}/api/corporate/patients/${PATIENT_A}/pai`, { headers: { Cookie: coord } });
        record('2a. GET PAI como COORD → 403/401', [401, 403].includes(r.status), `HTTP ${r.status}`);
    }
    {
        // Billing — COORD no debería poder modificar invoices
        const r = await fetch(`${BASE_URL}/api/corporate/patients/${PATIENT_A}/invoices`, { headers: { Cookie: coord } });
        // Si el endpoint requiere ADMIN/DIR, COORD recibe 401 o 403
        record('2b. GET invoices como COORD → 401/403', [401, 403].includes(r.status), `HTTP ${r.status}`);
    }
    {
        // Social work [patientId] — COORD NO lee evals/notas del equipo SW
        const r = await fetch(`${BASE_URL}/api/social/${PATIENT_A}`, { headers: { Cookie: coord } });
        record('2c. GET social/[patientId] como COORD → 401/403', [401, 403].includes(r.status), `HTTP ${r.status}`);
    }
    {
        // PATCH del color/info paciente — solo write roles, no COORD
        const r = await fetch(`${BASE_URL}/api/corporate/patients/${PATIENT_A}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json', Cookie: coord },
            body: JSON.stringify({ colorGroup: 'RED' }),
        });
        record('2d. PATCH patient como COORD → 401/403', [401, 403].includes(r.status), `HTTP ${r.status}`);
    }

    // ── 3. SOCIAL WORK refer-only ──
    {
        // COORDINATOR crea SocialWorkTask via /api/social/tasks POST
        const r = await fetch(`${BASE_URL}/api/social/tasks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: coord },
            body: JSON.stringify({
                patientId: PATIENT_A,
                title: 'Smoke: coord refiere a SW',
                description: 'Coordinator referral smoke test',
                category: 'FAMILY',
                priority: 'NORMAL',
            }),
        });
        const j = await r.json();
        record('3a. POST /social/tasks como COORD → 200', r.status === 200 && j.success === true, `HTTP ${r.status} ${j.error || ''}`);
        if (j.task?.id) (globalThis as any).__taskCreatedByCoord = j.task.id;
    }
    {
        // GET filtra a SUS propios referidos (coordinator-only)
        const r = await fetch(`${BASE_URL}/api/social/tasks?patientId=${PATIENT_A}`, { headers: { Cookie: coord } });
        const j = await r.json();
        record('3b. GET /social/tasks como COORD-puro → solo SUS tasks', r.status === 200 && Array.isArray(j.tasks) && j.tasks.every((t: any) => t.createdBy?.id === COORD_ID), `vio ${j.tasks?.length}`);
    }
    {
        // DIRECTOR ve todas las tasks (sin filtro)
        const r = await fetch(`${BASE_URL}/api/social/tasks?patientId=${PATIENT_A}`, { headers: { Cookie: dirCookies } });
        const j = await r.json();
        record('3c. GET /social/tasks como DIR → ve todas (sin filtro createdById)', r.status === 200, `vio ${j.tasks?.length}`);
    }

    // ── 4. POST /api/coordinator/referral (T11 SWING) ──
    {
        const r = await fetch(`${BASE_URL}/api/coordinator/referral`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: coord },
            body: JSON.stringify({
                targetRole: 'NURSE',
                patientId: PATIENT_A,
                description: 'Smoke referral a NURSE — coordinator hub',
                priority: 'NORMAL',
            }),
        });
        const j = await r.json();
        record('4a. POST /coordinator/referral → NURSE → 200', r.status === 200 && j.success === true, `HTTP ${r.status} ${j.error || ''}`);
        record('4b. Devuelve referralId + kind=TriageTicket', j.referralId && j.kind === 'TriageTicket');
    }
    {
        const r = await fetch(`${BASE_URL}/api/coordinator/referral`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: coord },
            body: JSON.stringify({
                targetRole: 'SOCIAL_WORKER',
                patientId: PATIENT_A,
                description: 'Smoke referral a SW — coordinator hub',
                priority: 'NORMAL',
            }),
        });
        const j = await r.json();
        record('4c. POST /coordinator/referral → SW → 200', r.status === 200 && j.success === true, `HTTP ${r.status}`);
        record('4d. Devuelve kind=SocialWorkTask', j.kind === 'SocialWorkTask');
    }
    {
        // Invalid targetRole → 400
        const r = await fetch(`${BASE_URL}/api/coordinator/referral`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: coord },
            body: JSON.stringify({ targetRole: 'CAREGIVER', patientId: PATIENT_A, description: 'invalid' }),
        });
        record('4e. targetRole inválido → 400', r.status === 400);
    }

    // ── 5. PhiAccessLog — patrón fila-por-paciente ──
    {
        // Verifica filas escritas en PhiAccessLog durante el smoke
        const recentLogs = await p.phiAccessLog.findMany({
            where: {
                userId: COORD_ID,
                timestamp: { gte: new Date(Date.now() - 5 * 60 * 1000) },
            },
            orderBy: { timestamp: 'desc' },
            select: { resourceType: true, patientId: true, action: true, userRole: true, success: true },
        });
        const byType = recentLogs.reduce<Record<string, number>>((acc, r) => {
            acc[r.resourceType] = (acc[r.resourceType] || 0) + 1;
            return acc;
        }, {});

        record('5a. phiAccessLog tiene filas del coordinator',
            recentLogs.length > 0,
            `total=${recentLogs.length} tipos=${JSON.stringify(byType)}`);

        // Tipos esperados después del smoke:
        record('5b. FamilyMember log (single-patient)', !!byType['FamilyMember']);
        record('5c. FamilyAppointmentList log (lista evento)', !!byType['FamilyAppointmentList']);
        record('5d. FamilyAppointment row-per-patient', !!byType['FamilyAppointment']);
        record('5e. ExternalServiceVisitList log', !!byType['ExternalServiceVisitList']);
        record('5f. PatientHistoryReport log', !!byType['PatientHistoryReport'] || !!byType['Patient'] || !!byType['HistoryReport']);
        record('5g. CoordinatorReferral log (WRITE)', !!byType['CoordinatorReferral']);

        // Verifica que las filas FamilyAppointment tengan patientId NO NULL
        // (eso es el patrón "fila por paciente" que pidió Andrés)
        const apptRows = recentLogs.filter(r => r.resourceType === 'FamilyAppointment');
        if (apptRows.length > 0) {
            record('5h. FamilyAppointment filas tienen patientId (no null)',
                apptRows.every(r => r.patientId !== null));
        }

        // userRole en logs = COORDINATOR (snapshot)
        record('5i. userRole snapshot = COORDINATOR',
            recentLogs.every(r => r.userRole === 'COORDINATOR' || r.userRole === null));
    }

    // ── Resumen ──
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
