/**
 * scripts/smoke-nursing-rotation.ts — gitignored, one-off.
 *
 * Seed nursing-specific test data en una rama Neon FRESCA + corre la misma
 * lógica de query del endpoint GET /api/care/nursing/rotation. Imprime el
 * JSON output como lo vería la UI + valida aislamiento multi-tenant.
 *
 * Guards: solo branches, NUNCA prod.
 *
 * Escenarios sembrados:
 *   En SMOKE_HQ (el del nurse logueado):
 *     A. NEVER:    nortonRisk=true, sin rotation log
 *     B. OK:       nortonRisk=true, rotation 30 min atrás
 *     C. DUE:      nortonRisk=true, rotation 125 min atrás  (zona 120-135)
 *     D. OVERDUE:  nortonRisk=true, rotation 200 min atrás
 *     E. ulcer-only: nortonRisk=FALSE pero tiene PressureUlcer stage 2 activa,
 *                   rotation 45 min atrás (enrolled via ulcer)
 *     F. flag-only: nortonRisk=FALSE, sin ulcer, requiresPosturalChanges=TRUE,
 *                   rotation 15 min atrás (enrolled via flag explícito únicamente)
 *
 *   En OTHER_HQ (otro hogar — NO debe leak):
 *     G. PHI: nortonRisk=true + requiresPosturalChanges=true, rotation 60 min
 *        (cualquier señal enrolada; NUNCA debería aparecer en la respuesta del
 *        nurse de SMOKE_HQ).
 *
 * Asserts:
 *   - 6 pacientes en respuesta de SMOKE_HQ (A-F)
 *   - PAT_G nunca en respuesta de SMOKE_HQ → fail loud si aparece
 *   - 1 paciente en respuesta de OTHER_HQ (G)
 *   - PAT_A-F nunca en respuesta de OTHER_HQ → fail loud si aparecen
 *   - Tiers correctos por paciente
 *
 * USO:
 *   DATABASE_URL='<branch-neon-fresca>' npx tsx scripts/smoke-nursing-rotation.ts
 */
import { PrismaClient } from '@prisma/client';

const PROD_HOST = 'ep-wispy-queen-ae20881h';

// SMOKE_HQ — el del nurse logueado
const SMOKE_HQ_ID  = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa001';
const SMOKE_NURSE  = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa100'; // performs rotations
const PAT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-bbbbbbbbb001'; // NEVER
const PAT_B = 'aaaaaaaa-aaaa-4aaa-8aaa-bbbbbbbbb002'; // OK
const PAT_C = 'aaaaaaaa-aaaa-4aaa-8aaa-bbbbbbbbb003'; // DUE
const PAT_D = 'aaaaaaaa-aaaa-4aaa-8aaa-bbbbbbbbb004'; // OVERDUE
const PAT_E = 'aaaaaaaa-aaaa-4aaa-8aaa-bbbbbbbbb005'; // OK + ulcer-only
const PAT_F = 'aaaaaaaa-aaaa-4aaa-8aaa-bbbbbbbbb006'; // OK + flag-only

// OTHER_HQ — cross-tenant target. Debe quedar AISLADO.
const OTHER_HQ_ID  = 'cccccccc-cccc-4ccc-8ccc-ccccccccc001';
const OTHER_NURSE  = 'cccccccc-cccc-4ccc-8ccc-ccccccccc100';
const PAT_G = 'cccccccc-cccc-4ccc-8ccc-ddddddddd001';

const SMOKE_IDS  = [PAT_A, PAT_B, PAT_C, PAT_D, PAT_E, PAT_F];
const OTHER_IDS  = [PAT_G];
const ALL_PAT_IDS = [...SMOKE_IDS, ...OTHER_IDS];

const url = process.env.DATABASE_URL || '';
const host = url.match(/@(ep-[a-z0-9-]+)/)?.[1] || '';
if (host.startsWith(PROD_HOST)) { console.error('❌ host es PROD'); process.exit(1); }
if (!host) { console.error('❌ DATABASE_URL no set'); process.exit(1); }
console.log(`✓ Branch host: ${host} (NO prod)`);

const p = new PrismaClient({ datasources: { db: { url } } });

const TARGET_MIN = 120;
const BREACH_MIN = 135;
type Tier = 'OK' | 'DUE' | 'OVERDUE' | 'NEVER';
function classify(m: number | null): Tier {
    if (m === null) return 'NEVER';
    if (m <= TARGET_MIN) return 'OK';
    if (m <= BREACH_MIN) return 'DUE';
    return 'OVERDUE';
}

async function cleanup() {
    console.log('— cleanup —');
    await p.posturalChangeLog.deleteMany({ where: { patientId: { in: ALL_PAT_IDS } } });
    await p.pressureUlcer.deleteMany({ where: { patientId: { in: ALL_PAT_IDS } } });
    await p.patient.deleteMany({ where: { id: { in: ALL_PAT_IDS } } });
    await p.user.deleteMany({ where: { id: { in: [SMOKE_NURSE, OTHER_NURSE] } } });
    await p.headquarters.deleteMany({ where: { id: { in: [SMOKE_HQ_ID, OTHER_HQ_ID] } } });
    console.log('  done.');
}

async function seed() {
    const now = new Date();
    const minus = (mins: number) => new Date(now.getTime() - mins * 60_000);
    const farFuture = new Date('2099-12-31T00:00:00Z');

    // HQs
    await p.headquarters.createMany({
        data: [
            { id: SMOKE_HQ_ID, name: 'SMOKE_HQ Nursing', capacity: 30, isActive: true, licenseActive: true, licenseExpiry: farFuture },
            { id: OTHER_HQ_ID, name: 'OTHER_HQ Cross-tenant',  capacity: 30, isActive: true, licenseActive: true, licenseExpiry: farFuture },
        ],
    });

    // Nurses (uno por HQ — necesarios para FK de PosturalChangeLog.nurseId)
    await p.user.createMany({
        data: [
            { id: SMOKE_NURSE, name: 'Smoke Nurse', email: 'nurse-smoke@verify.local', role: 'NURSE', headquartersId: SMOKE_HQ_ID, isActive: true },
            { id: OTHER_NURSE, name: 'Other Nurse', email: 'nurse-other@verify.local', role: 'NURSE', headquartersId: OTHER_HQ_ID, isActive: true },
        ],
    });

    // Patients en SMOKE_HQ (A-F)
    await p.patient.createMany({
        data: [
            { id: PAT_A, name: 'Pat A (NEVER)',     headquartersId: SMOKE_HQ_ID, status: 'ACTIVE', colorGroup: 'RED',    roomNumber: '1-01', nortonRisk: true,  requiresPosturalChanges: false },
            { id: PAT_B, name: 'Pat B (OK)',        headquartersId: SMOKE_HQ_ID, status: 'ACTIVE', colorGroup: 'RED',    roomNumber: '1-02', nortonRisk: true,  requiresPosturalChanges: false },
            { id: PAT_C, name: 'Pat C (DUE)',       headquartersId: SMOKE_HQ_ID, status: 'ACTIVE', colorGroup: 'YELLOW', roomNumber: '1-03', nortonRisk: true,  requiresPosturalChanges: false },
            { id: PAT_D, name: 'Pat D (OVERDUE)',   headquartersId: SMOKE_HQ_ID, status: 'ACTIVE', colorGroup: 'YELLOW', roomNumber: '1-04', nortonRisk: true,  requiresPosturalChanges: false },
            { id: PAT_E, name: 'Pat E (ulcer-only)',headquartersId: SMOKE_HQ_ID, status: 'ACTIVE', colorGroup: 'BLUE',   roomNumber: '1-05', nortonRisk: false, requiresPosturalChanges: false },
            { id: PAT_F, name: 'Pat F (flag-only)', headquartersId: SMOKE_HQ_ID, status: 'ACTIVE', colorGroup: 'BLUE',   roomNumber: '1-06', nortonRisk: false, requiresPosturalChanges: true  },
        ],
    });

    // Cross-tenant en OTHER_HQ (G) — PHI que debe NO leak
    await p.patient.create({
        data: {
            id: PAT_G, name: 'Pat G (CROSS-HQ — never appear in SMOKE_HQ)',
            headquartersId: OTHER_HQ_ID, status: 'ACTIVE', colorGroup: 'RED', roomNumber: '9-99',
            nortonRisk: true, requiresPosturalChanges: true,
        },
    });

    // Rotation logs
    await p.posturalChangeLog.createMany({
        data: [
            { patientId: PAT_B, nurseId: SMOKE_NURSE, position: 'Decúbito Lateral Izquierdo', performedAt: minus(30),  isComplianceAlert: false },
            { patientId: PAT_C, nurseId: SMOKE_NURSE, position: 'Supino',                     performedAt: minus(125), isComplianceAlert: false },
            { patientId: PAT_D, nurseId: SMOKE_NURSE, position: 'Decúbito Lateral Derecho',   performedAt: minus(200), isComplianceAlert: true  },
            { patientId: PAT_E, nurseId: SMOKE_NURSE, position: 'Supino',                     performedAt: minus(45),  isComplianceAlert: false },
            { patientId: PAT_F, nurseId: SMOKE_NURSE, position: 'Decúbito Lateral Izquierdo', performedAt: minus(15),  isComplianceAlert: false },
            { patientId: PAT_G, nurseId: OTHER_NURSE, position: 'Supino',                     performedAt: minus(60),  isComplianceAlert: false },
        ],
    });

    // Ulcer activo para PAT_E (enrolled via ulcer, no norton, no flag)
    await p.pressureUlcer.create({
        data: { patientId: PAT_E, bodyLocation: 'Sacro', stage: 2, status: 'ACTIVE', identifiedAt: minus(60 * 24 * 7) },
    });

    console.log('✓ Seed complete: SMOKE_HQ(6) + OTHER_HQ(1)');
}

// Endpoint logic — espejo del route handler
async function runEndpointLogic(hqId: string) {
    const now = new Date();
    const rows = await p.patient.findMany({
        where: {
            headquartersId: hqId,
            status: { in: ['ACTIVE', 'TEMPORARY_LEAVE'] },
            OR: [
                { requiresPosturalChanges: true },
                { nortonRisk: true },
                { pressureUlcers: { some: { status: { not: 'RESOLVED' } } } },
            ],
        },
        select: {
            id: true, name: true, roomNumber: true,
            requiresPosturalChanges: true, nortonRisk: true, status: true,
            posturalChanges: {
                orderBy: { performedAt: 'desc' }, take: 1,
                select: { performedAt: true, position: true, nurse: { select: { id: true, name: true } } },
            },
            pressureUlcers: {
                where: { status: { not: 'RESOLVED' } },
                orderBy: [{ stage: 'desc' }, { identifiedAt: 'asc' }],
                select: { id: true, bodyLocation: true, stage: true, status: true, identifiedAt: true },
            },
        },
        orderBy: [{ roomNumber: 'asc' }, { name: 'asc' }],
    });
    const patients = rows.map((pa) => {
        const last = pa.posturalChanges[0] ?? null;
        const minutesSince = last ? Math.floor((now.getTime() - last.performedAt.getTime()) / 60_000) : null;
        return {
            patientId: pa.id, name: pa.name, roomNumber: pa.roomNumber, status: pa.status,
            requiresPosturalChanges: pa.requiresPosturalChanges, nortonRisk: pa.nortonRisk,
            enrolledBy: { flag: pa.requiresPosturalChanges, norton: pa.nortonRisk, ulcer: pa.pressureUlcers.length > 0 },
            activeUlcers: pa.pressureUlcers,
            lastRotation: last ? { performedAt: last.performedAt, position: last.position, nurseId: last.nurse?.id ?? null, nurseName: last.nurse?.name ?? null } : null,
            minutesSince, tier: classify(minutesSince),
        };
    });
    const counts: Record<Tier, number> = { OK: 0, DUE: 0, OVERDUE: 0, NEVER: 0 };
    for (const x of patients) counts[x.tier]++;
    return { success: true, generatedAt: now.toISOString(), hqId, thresholdsMin: { target: TARGET_MIN, breach: BREACH_MIN }, counts, total: patients.length, patients };
}

(async () => {
    await cleanup();
    await seed();
    console.log('');

    // RUN 1: as SMOKE_HQ nurse
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  RUN 1 — GET /api/care/nursing/rotation  (hqId=SMOKE_HQ)');
    console.log('═══════════════════════════════════════════════════════════════');
    const r1 = await runEndpointLogic(SMOKE_HQ_ID);
    console.log(JSON.stringify(r1, null, 2));

    // RUN 2: as OTHER_HQ nurse
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  RUN 2 — GET /api/care/nursing/rotation  (hqId=OTHER_HQ)');
    console.log('═══════════════════════════════════════════════════════════════');
    const r2 = await runEndpointLogic(OTHER_HQ_ID);
    console.log(JSON.stringify(r2, null, 2));

    // Asserts — multi-tenant isolation
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  ASSERTS');
    console.log('═══════════════════════════════════════════════════════════════');
    const r1Ids = new Set(r1.patients.map(p => p.patientId));
    const r2Ids = new Set(r2.patients.map(p => p.patientId));

    const checks: Array<{ name: string, pass: boolean, detail?: string }> = [
        { name: 'RUN1 total = 6', pass: r1.total === 6, detail: `got ${r1.total}` },
        { name: 'RUN1 contains A-F', pass: SMOKE_IDS.every(id => r1Ids.has(id)) },
        { name: 'RUN1 NEVER includes PAT_G (cross-HQ leak)', pass: !r1Ids.has(PAT_G), detail: r1Ids.has(PAT_G) ? '🚨 PHI LEAK' : 'isolated ✓' },
        { name: 'RUN1 counts: OK=3 DUE=1 OVERDUE=1 NEVER=1', pass: r1.counts.OK === 3 && r1.counts.DUE === 1 && r1.counts.OVERDUE === 1 && r1.counts.NEVER === 1, detail: JSON.stringify(r1.counts) },
        { name: 'RUN2 total = 1', pass: r2.total === 1, detail: `got ${r2.total}` },
        { name: 'RUN2 contains G', pass: r2Ids.has(PAT_G) },
        { name: 'RUN2 NEVER includes A-F (reverse leak)', pass: SMOKE_IDS.every(id => !r2Ids.has(id)), detail: SMOKE_IDS.some(id => r2Ids.has(id)) ? '🚨 PHI LEAK' : 'isolated ✓' },
        { name: 'PAT_F enrolledBy.flag=true, norton=false, ulcer=false', pass: (() => { const f = r1.patients.find(x => x.patientId === PAT_F); return !!(f && f.enrolledBy.flag === true && f.enrolledBy.norton === false && f.enrolledBy.ulcer === false); })() },
        { name: 'PAT_E enrolledBy.ulcer=true, norton=false, flag=false', pass: (() => { const e = r1.patients.find(x => x.patientId === PAT_E); return !!(e && e.enrolledBy.ulcer === true && e.enrolledBy.norton === false && e.enrolledBy.flag === false); })() },
    ];

    let pass = 0, fail = 0;
    for (const c of checks) {
        const icon = c.pass ? '✓' : '✗';
        console.log(`  ${icon} ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
        if (c.pass) pass++; else fail++;
    }
    console.log('');
    console.log(`Result: ${pass} pass, ${fail} fail`);
    if (fail > 0) { await p.$disconnect(); process.exit(1); }

    await p.$disconnect();
})().catch(async (e) => {
    console.error('ERROR:', e);
    await p.$disconnect();
    process.exit(1);
});
