/**
 * scripts/smoke-rotation-protocol.ts — gitignored, one-off.
 *
 * HTTP-based smoke del endpoint PATCH /api/corporate/patients/[id]/rotation-protocol.
 * Espera que el dev server esté corriendo en BASE_URL (default 127.0.0.1:3066)
 * apuntando al branch Neon desechable con seed de smoke-nursing-rotation.ts ya
 * aplicado (PAT_F = flag-only, PAT_A = norton-only).
 *
 * Asserts:
 *   1. Sin auth → 401
 *   2. CAREGIVER → 403
 *   3. NURSE same-HQ + sin confirmed → 400
 *   4. NURSE same-HQ + bad payload (no boolean) → 400
 *   5. OTHER-HQ NURSE → 403 (cross-tenant)
 *   6. NURSE same-HQ + confirmed:true + toggle FALSE→TRUE (PAT_A) → 200
 *      DB row updated; audit row creado con action PATIENT_PROTOCOL_CHANGED
 *      + before/after correctos
 *   7. Re-toggle TRUE→TRUE (noop) → 200 + changed:false + audit count NO incrementa
 *   8. Toggle TRUE→FALSE (PAT_A return to baseline) → 200 + audit row #2
 *   9. Dashboard /api/care/nursing/rotation refleja el toggle:
 *      - Después de TRUE: PAT_A.enrolledBy.flag === true
 *      - Después de FALSE (cleanup): PAT_A.enrolledBy.flag === false
 *
 * Después de pasar: restaura PAT_A al estado original (norton=true, flag=false)
 * para no contaminar el branch.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const PROD_HOST = 'ep-wispy-queen-ae20881h';
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3066';

// IDs replicados del smoke-nursing-rotation.ts — asume seed previo aplicado
const SMOKE_HQ_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa001';
const OTHER_HQ_ID = 'cccccccc-cccc-4ccc-8ccc-ccccccccc001';
const SMOKE_NURSE_EMAIL = 'nurse-smoke@verify.local';
const OTHER_NURSE_EMAIL = 'nurse-other@verify.local';
const PIN = '1234';

const PAT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-bbbbbbbbb001'; // norton=true, flag=false originalmente
const PAT_F = 'aaaaaaaa-aaaa-4aaa-8aaa-bbbbbbbbb006'; // flag=true originalmente

// CAREGIVER ID — se seedea acá si no existe (todo el setup está en este script
// para que sea autosuficiente — no requiere editar smoke-nursing-rotation.ts).
const SMOKE_CG_USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa200';
const SMOKE_CG_EMAIL = 'cg-smoke-rotation@verify.local';

const url = process.env.DATABASE_URL || '';
const host = url.match(/@(ep-[a-z0-9-]+)/)?.[1] || '';
if (host.startsWith(PROD_HOST)) { console.error('❌ host es PROD'); process.exit(1); }
if (!host) { console.error('❌ DATABASE_URL no set'); process.exit(1); }
console.log(`✓ Branch host: ${host}`);

const p = new PrismaClient({ datasources: { db: { url } } });

interface LoginResult { cookies: string; sessionUser?: any; }

// Cookie jar mínimo. Necesario porque Set-Cookie incluye atributos
// (Path, HttpOnly, Expires, etc.) que NO deben enviarse de vuelta en Cookie:
// solo `name=value`. Y NextAuth usa varios cookies (csrf, callback, session).
function makeJar() {
    const jar: Record<string, string> = {};
    function apply(headers: Headers) {
        // Node >= 22 expone getSetCookie() retornando array. Fallback al string concatenado.
        const set = (headers as any).getSetCookie?.() ?? (headers.get('set-cookie') ? [headers.get('set-cookie')!] : []);
        for (const sc of set) {
            const first = sc.split(';')[0];
            const idx = first.indexOf('=');
            if (idx <= 0) continue;
            const name = first.slice(0, idx).trim();
            const value = first.slice(idx + 1).trim();
            if (name) jar[name] = value;
        }
    }
    function header(): string {
        return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
    }
    return { apply, header };
}

async function login(email: string, pin: string): Promise<LoginResult | null> {
    const jar = makeJar();

    const csrfRes = await fetch(`${BASE_URL}/api/auth/csrf`);
    jar.apply(csrfRes.headers);
    const csrfJson = await csrfRes.json();

    const signinRes = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cookie': jar.header() },
        body: new URLSearchParams({ csrfToken: csrfJson.csrfToken, email, pinCode: pin, callbackUrl: '/' }).toString(),
        redirect: 'manual',
    });
    jar.apply(signinRes.headers);

    const sessionRes = await fetch(`${BASE_URL}/api/auth/session`, { headers: { 'Cookie': jar.header() } });
    const sess = await sessionRes.json();
    if (!sess?.user) return null;
    return { cookies: jar.header(), sessionUser: sess.user };
}

async function ensureSmokeCG() {
    const exists = await p.user.findUnique({ where: { id: SMOKE_CG_USER_ID }, select: { id: true } });
    if (exists) return;
    const pinHash = await bcrypt.hash(PIN, 10);
    await p.user.create({
        data: {
            id: SMOKE_CG_USER_ID, name: 'Smoke CG (rotation smoke)',
            email: SMOKE_CG_EMAIL, role: 'CAREGIVER', headquartersId: SMOKE_HQ_ID,
            isActive: true, pinCode: pinHash,
        },
    });
}

async function ensureBaseline() {
    // Asegurar PAT_A en estado original: norton=true, flag=false
    await p.patient.update({
        where: { id: PAT_A },
        data: { requiresPosturalChanges: false, nortonRisk: true },
    });
}

interface Check { name: string; pass: boolean; detail?: string; }
const checks: Check[] = [];
function record(name: string, pass: boolean, detail?: string) {
    checks.push({ name, pass, detail });
    console.log(`  ${pass ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
}

(async () => {
    console.log('— setup —');
    await ensureSmokeCG();
    await ensureBaseline();
    console.log('  baseline: PAT_A nortonRisk=true, requiresPosturalChanges=false');

    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  HTTP smoke — PATCH /api/corporate/patients/[id]/rotation-protocol');
    console.log('═══════════════════════════════════════════════════════════════');

    // 1) Sin auth → 401
    {
        const r = await fetch(`${BASE_URL}/api/corporate/patients/${PAT_A}/rotation-protocol`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ requiresPosturalChanges: true, confirmed: true }),
        });
        record('1. Sin auth → 401', r.status === 401, `HTTP ${r.status}`);
    }

    // Login NURSE same-HQ
    const nurseLogin = await login(SMOKE_NURSE_EMAIL, PIN);
    if (!nurseLogin) { console.error('❌ No se pudo loguear nurse'); process.exit(1); }
    record('Login NURSE same-HQ', nurseLogin.sessionUser.role === 'NURSE', `role=${nurseLogin.sessionUser.role}`);

    // 2) CAREGIVER → 403
    {
        const cgLogin = await login(SMOKE_CG_EMAIL, PIN);
        if (!cgLogin) { record('2. CAREGIVER → 403', false, 'login fail'); }
        else {
            const r = await fetch(`${BASE_URL}/api/corporate/patients/${PAT_A}/rotation-protocol`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Cookie': cgLogin.cookies },
                body: JSON.stringify({ requiresPosturalChanges: true, confirmed: true }),
            });
            record('2. CAREGIVER → 403', r.status === 403, `HTTP ${r.status}`);
        }
    }

    // 3) NURSE same-HQ + sin confirmed → 400
    {
        const r = await fetch(`${BASE_URL}/api/corporate/patients/${PAT_A}/rotation-protocol`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Cookie': nurseLogin.cookies },
            body: JSON.stringify({ requiresPosturalChanges: true }),
        });
        const json = await r.json().catch(() => ({}));
        record('3. Sin confirmed:true → 400', r.status === 400, `HTTP ${r.status} · "${json.error}"`);
    }

    // 4) NURSE + bad payload (no boolean) → 400
    {
        const r = await fetch(`${BASE_URL}/api/corporate/patients/${PAT_A}/rotation-protocol`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Cookie': nurseLogin.cookies },
            body: JSON.stringify({ requiresPosturalChanges: 'true', confirmed: true }),
        });
        record('4. requiresPosturalChanges no-boolean → 400', r.status === 400, `HTTP ${r.status}`);
    }

    // 5) OTHER-HQ NURSE intenta cross-tenant → 403
    {
        const otherLogin = await login(OTHER_NURSE_EMAIL, PIN);
        if (!otherLogin) { record('5. cross-HQ → 403', false, 'login fail'); }
        else {
            const r = await fetch(`${BASE_URL}/api/corporate/patients/${PAT_A}/rotation-protocol`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Cookie': otherLogin.cookies },
                body: JSON.stringify({ requiresPosturalChanges: true, confirmed: true }),
            });
            record('5. cross-HQ invoker → 403', r.status === 403, `HTTP ${r.status}`);
        }
    }

    // 6) NURSE same-HQ + confirmed → toggle FALSE→TRUE → 200 + DB + audit
    let firstAuditId: string | null = null;
    {
        const r = await fetch(`${BASE_URL}/api/corporate/patients/${PAT_A}/rotation-protocol`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Cookie': nurseLogin.cookies },
            body: JSON.stringify({ requiresPosturalChanges: true, confirmed: true }),
        });
        const json = await r.json().catch(() => ({}));
        record('6a. Toggle FALSE→TRUE → 200', r.status === 200 && json.success === true, `HTTP ${r.status}`);
        record('6b. response.patient.requiresPosturalChanges === true', json.patient?.requiresPosturalChanges === true);

        // DB direct check
        const dbRow = await p.patient.findUnique({ where: { id: PAT_A }, select: { requiresPosturalChanges: true } });
        record('6c. DB row updated true', dbRow?.requiresPosturalChanges === true);

        // Audit row
        firstAuditId = json.audit?.id;
        const audit = firstAuditId ? await p.systemAuditLog.findUnique({ where: { id: firstAuditId } }) : null;
        record('6d. Audit row creado', !!audit);
        record('6e. action=PATIENT_PROTOCOL_CHANGED', audit?.action === 'PATIENT_PROTOCOL_CHANGED', `action=${audit?.action}`);
        const pc = audit?.payloadChanges as any;
        record('6f. payload.before=false, after=true', pc?.before === false && pc?.after === true, `before=${pc?.before}, after=${pc?.after}`);
        record('6g. audit.entityName=Patient, entityId=PAT_A', audit?.entityName === 'Patient' && audit?.entityId === PAT_A);
    }

    // 7) Noop (TRUE→TRUE) → 200 + changed:false + audit count NO incrementa
    {
        // Snapshot audit count antes del noop
        const auditBefore = await p.systemAuditLog.count({
            where: { entityName: 'Patient', entityId: PAT_A, action: 'PATIENT_PROTOCOL_CHANGED' },
        });

        const r = await fetch(`${BASE_URL}/api/corporate/patients/${PAT_A}/rotation-protocol`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Cookie': nurseLogin.cookies },
            body: JSON.stringify({ requiresPosturalChanges: true, confirmed: true }),
        });
        const json = await r.json().catch(() => ({}));
        record('7a. Noop TRUE→TRUE → 200', r.status === 200, `HTTP ${r.status}`);
        record('7b. response.changed === false', json.changed === false, `changed=${json.changed}`);
        record('7c. success === true', json.success === true);

        // Verifica que audit NO incrementó
        const auditAfter = await p.systemAuditLog.count({
            where: { entityName: 'Patient', entityId: PAT_A, action: 'PATIENT_PROTOCOL_CHANGED' },
        });
        record('7d. Audit count NO incrementa en noop', auditAfter === auditBefore, `before=${auditBefore} after=${auditAfter}`);
    }

    // 8) Toggle TRUE→FALSE → 200 + audit row #2
    {
        const r = await fetch(`${BASE_URL}/api/corporate/patients/${PAT_A}/rotation-protocol`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Cookie': nurseLogin.cookies },
            body: JSON.stringify({ requiresPosturalChanges: false, confirmed: true }),
        });
        const json = await r.json().catch(() => ({}));
        record('8a. Toggle TRUE→FALSE → 200', r.status === 200, `HTTP ${r.status}`);

        const dbRow = await p.patient.findUnique({ where: { id: PAT_A }, select: { requiresPosturalChanges: true } });
        record('8b. DB row updated false', dbRow?.requiresPosturalChanges === false);

        // Total audit rows para PAT_A should be 2
        const auditCount = await p.systemAuditLog.count({
            where: { entityName: 'Patient', entityId: PAT_A, action: 'PATIENT_PROTOCOL_CHANGED' },
        });
        record('8c. Total audit rows PAT_A = 2', auditCount === 2, `count=${auditCount}`);
    }

    // 9) Dashboard refleja cambio
    {
        // Activamos PAT_A nuevamente para verificar dashboard
        await fetch(`${BASE_URL}/api/corporate/patients/${PAT_A}/rotation-protocol`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Cookie': nurseLogin.cookies },
            body: JSON.stringify({ requiresPosturalChanges: true, confirmed: true }),
        });
        const r = await fetch(`${BASE_URL}/api/care/nursing/rotation`, {
            headers: { 'Cookie': nurseLogin.cookies },
        });
        const json = await r.json();
        const patA = json.patients?.find((x: any) => x.patientId === PAT_A);
        record('9a. Dashboard incluye PAT_A con enrolledBy.flag=true', !!patA && patA.enrolledBy.flag === true && patA.enrolledBy.norton === true);

        // Cleanup: volver a baseline
        await fetch(`${BASE_URL}/api/corporate/patients/${PAT_A}/rotation-protocol`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Cookie': nurseLogin.cookies },
            body: JSON.stringify({ requiresPosturalChanges: false, confirmed: true }),
        });

        const r2 = await fetch(`${BASE_URL}/api/care/nursing/rotation`, {
            headers: { 'Cookie': nurseLogin.cookies },
        });
        const json2 = await r2.json();
        const patA2 = json2.patients?.find((x: any) => x.patientId === PAT_A);
        record('9b. Después de FALSE: PAT_A enrolledBy.flag=false (norton sigue=true)', !!patA2 && patA2.enrolledBy.flag === false && patA2.enrolledBy.norton === true);
    }

    // Final cleanup — limpia audit rows generadas
    await p.systemAuditLog.deleteMany({
        where: { entityName: 'Patient', entityId: PAT_A, action: 'PATIENT_PROTOCOL_CHANGED' },
    });

    // Summary
    console.log('');
    const pass = checks.filter(c => c.pass).length;
    const fail = checks.length - pass;
    console.log(`Result: ${pass} pass, ${fail} fail`);
    if (fail > 0) { await p.$disconnect(); process.exit(1); }
    await p.$disconnect();
})().catch(async (e) => {
    console.error('ERROR:', e);
    await p.$disconnect();
    process.exit(1);
});
