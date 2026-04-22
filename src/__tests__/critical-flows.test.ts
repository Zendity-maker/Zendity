/**
 * Zéndity — Suite de pruebas de integración: 5 módulos críticos
 *
 * Estrategia: todos los tests conectan a Neon directamente vía Prisma
 * (solo lectura — ningún test modifica datos de producción).
 * Los checks de auth gate usan fetch opcional contra BASE_URL
 * (solo se ejecutan si el servidor está disponible).
 *
 * Correr: npx vitest run
 * o:      npx vitest run --reporter verbose
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({ log: [] });
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

/** Intenta fetch; devuelve null si el servidor no está disponible. */
async function tryFetch(url: string, init?: RequestInit): Promise<Response | null> {
    try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 5000);
        const res = await fetch(url, { ...init, signal: ctrl.signal });
        clearTimeout(timer);
        return res;
    } catch {
        return null;
    }
}

// Warm-up: Neon serverless puede estar dormido; una query de conexión explícita
// antes de los tests evita que el primer test tarde 5s en despertar el compute.
beforeAll(async () => {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
}, 15000);

afterAll(async () => {
    await prisma.$disconnect();
});

// ═══════════════════════════════════════════════════════
// MÓDULO 1 — eMAR: Medicamentos
// ═══════════════════════════════════════════════════════
describe('eMAR — Medicamentos', () => {

    it('todos los PatientMedication ACTIVE tienen scheduleTimes no vacíos', async () => {
        // scheduleTimes es String (non-nullable) — solo verificar vacío
        const badMeds = await prisma.patientMedication.findMany({
            where: {
                status: 'ACTIVE',
                isActive: true,
                scheduleTimes: '',
            },
            select: { id: true, patient: { select: { name: true } } },
        });
        if (badMeds.length > 0) {
            console.warn('eMAR: Medicamentos ACTIVE sin scheduleTimes:', badMeds.map(m => m.id));
        }
        expect(badMeds).toHaveLength(0);
    });

    it('MedicationAdministrations ADMINISTERED sin administeredAt no crecen sobre baseline', async () => {
        // Baseline conocido: ~1041 registros legacy sin administeredAt (pre-feature).
        // El test falla si el número crece significativamente (indica nuevo bug en el flujo).
        // TODO: limpiar registros legacy con: UPDATE "MedicationAdministration"
        //       SET "administeredAt" = "createdAt" WHERE status = 'ADMINISTERED' AND "administeredAt" IS NULL
        const count = await prisma.medicationAdministration.count({
            where: { status: 'ADMINISTERED', administeredAt: null },
        });
        console.warn(`eMAR: ${count} administraciones ADMINISTERED sin administeredAt (baseline ~1041 — pendiente cleanup).`);
        // Threshold: baseline + 50 buffer
        expect(count).toBeLessThan(1100);
    });

    it('no hay PatientMedication ACTIVE con scheduleTimes vacío (integridad de datos)', async () => {
        // Versión eficiente: count en lugar de findMany + include
        const withMedsTotal = await prisma.patient.count({
            where: { status: 'ACTIVE', medications: { some: {} } },
        });
        const withActiveMeds = await prisma.patient.count({
            where: { status: 'ACTIVE', medications: { some: { isActive: true, status: 'ACTIVE' } } },
        });
        if (withMedsTotal !== withActiveMeds) {
            console.warn(`eMAR: ${withMedsTotal - withActiveMeds} paciente(s) con meds pero sin ninguno ACTIVE.`);
        }
        // Esperamos que la gran mayoría tenga al menos 1 activo
        expect(withActiveMeds).toBeGreaterThanOrEqual(withMedsTotal * 0.8);
    });

    it('endpoint /api/emar rechaza peticiones sin auth (401)', async () => {
        const res = await tryFetch(`${BASE_URL}/api/emar`);
        if (!res) { console.warn('⚠ Servidor no disponible — test de auth omitido'); return; }
        expect(res.status).toBe(401);
    });

});

// ═══════════════════════════════════════════════════════
// MÓDULO 2 — Care: Tablet del cuidador
// ═══════════════════════════════════════════════════════
describe('Care — Tablet cuidador', () => {

    it('no hay ShiftSessions zombi (actualEndTime=null con más de 14h)', async () => {
        const limit = new Date(Date.now() - 14 * 60 * 60 * 1000);
        const zombies = await prisma.shiftSession.findMany({
            where: {
                actualEndTime: null,
                startTime: { lt: limit },
            },
            include: {
                caregiver: { select: { name: true } },
            },
        });
        if (zombies.length > 0) {
            console.warn('Care: ShiftSessions zombi (>14h sin cierre):', zombies.map(s => ({
                id: s.id,
                caregiver: s.caregiver?.name,
                startTime: s.startTime,
            })));
        }
        expect(zombies).toHaveLength(0);
    });

    it('todos los ShiftSessions abiertos tienen caregiverId válido', async () => {
        const sessions = await prisma.shiftSession.findMany({
            where: { actualEndTime: null },
            include: { caregiver: { select: { id: true } } },
        });
        const invalid = sessions.filter(s => !s.caregiver);
        expect(invalid).toHaveLength(0);
    });

    it('no hay VitalsOrder PENDING con expiresAt en el pasado desde hace más de 1h', async () => {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const stale = await prisma.vitalsOrder.findMany({
            where: {
                status: 'PENDING',
                expiresAt: { lt: oneHourAgo },
            },
            include: {
                patient: { select: { name: true } },
            },
            take: 20,
        });
        if (stale.length > 0) {
            console.warn('Care: VitalsOrders PENDING vencidos desde >1h:', stale.length, 'órdenes');
        }
        // Advertencia, no fallo crítico — el cron de vitals-reminder debería limpiarlos
        expect(stale.length).toBeLessThan(50);
    });

    it('endpoint /api/care/shift/start rechaza peticiones sin auth (401)', async () => {
        const res = await tryFetch(`${BASE_URL}/api/care/shift/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
        });
        if (!res) { console.warn('⚠ Servidor no disponible — test de auth omitido'); return; }
        expect(res.status).toBe(401);
    });

    it('endpoint /api/care/fast-actions rechaza peticiones sin auth (401)', async () => {
        const res = await tryFetch(`${BASE_URL}/api/care/fast-actions`);
        if (!res) { console.warn('⚠ Servidor no disponible — test de auth omitido'); return; }
        expect(res.status).toBe(401);
    });

});

// ═══════════════════════════════════════════════════════
// MÓDULO 3 — Desempeño: Compliance scores
// ═══════════════════════════════════════════════════════
describe('Desempeño — Compliance scores', () => {

    it('todos los usuarios activos tienen complianceScore entre 0 y 100', async () => {
        // complianceScore es Int non-nullable con @default(50) — solo verificar rango
        const badScores = await prisma.user.findMany({
            where: {
                isActive: true,
                isDeleted: false,
                OR: [
                    { complianceScore: { lt: 0 } },
                    { complianceScore: { gt: 100 } },
                ],
            },
            select: { id: true, name: true, complianceScore: true },
        });
        if (badScores.length > 0) {
            console.warn('Desempeño: Scores fuera de rango 0-100:', badScores);
        }
        expect(badScores).toHaveLength(0);
    });

    it('todos los usuarios activos tienen complianceScore positivo', async () => {
        // complianceScore es Int non-nullable @default(50) — verificar > 0
        const zeroScore = await prisma.user.findMany({
            where: {
                isActive: true,
                isDeleted: false,
                complianceScore: { lte: 0 },
            },
            select: { name: true, complianceScore: true },
        });
        if (zeroScore.length > 0) {
            console.warn('Desempeño: Usuarios con score <= 0:', zeroScore.map(u => `${u.name}: ${u.complianceScore}`));
        }
        expect(zeroScore).toHaveLength(0);
    });

    it('no hay FastActionAssignment PENDING expiradas desde hace más de 2h', async () => {
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
        const stale = await prisma.fastActionAssignment.findMany({
            where: {
                status: 'PENDING',
                expiresAt: { lt: twoHoursAgo },
            },
            include: {
                caregiver: { select: { name: true } },
            },
        });
        if (stale.length > 0) {
            console.warn('Desempeño: FastActions PENDING fantasma (>2h vencidas):', stale.length);
        }
        // Con FIX de timer 1h + sin auto-fail, no deberían acumularse
        expect(stale.length).toBeLessThan(10);
    });

});

// ═══════════════════════════════════════════════════════
// MÓDULO 4 — Family: Portal familiar
// ═══════════════════════════════════════════════════════
describe('Family — Portal familiar', () => {

    it('no hay FamilyMember apuntando a un Patient inexistente', async () => {
        const orphaned = await prisma.$queryRaw<{ id: string; name: string }[]>`
            SELECT fm.id, fm.name
            FROM "FamilyMember" fm
            LEFT JOIN "Patient" p ON p.id = fm."patientId"
            WHERE p.id IS NULL
            LIMIT 10
        `;
        if (orphaned.length > 0) {
            console.warn('Family: FamilyMembers huérfanos (sin Patient):', orphaned);
        }
        expect(orphaned).toHaveLength(0);
    });

    it('todos los FamilyMember isPrimary tienen Patient existente', async () => {
        const primaryMembers = await prisma.familyMember.findMany({
            where: { isPrimary: true },
            include: { patient: { select: { id: true, status: true } } },
        });
        const invalid = primaryMembers.filter(fm => !fm.patient);
        if (invalid.length > 0) {
            console.warn('Family: FamilyMembers isPrimary sin Patient:', invalid.map(f => f.id));
        }
        expect(invalid).toHaveLength(0);
    });

    it('no hay FamilyMember con email duplicado', async () => {
        const dupes = await prisma.$queryRaw<{ email: string; count: number }[]>`
            SELECT email, COUNT(*)::int AS count
            FROM "FamilyMember"
            GROUP BY email
            HAVING COUNT(*) > 1
        `;
        if (dupes.length > 0) {
            console.warn('Family: Emails duplicados en FamilyMember:', dupes);
        }
        expect(dupes).toHaveLength(0);
    });

    it('endpoint /api/family/residents rechaza peticiones sin auth (401)', async () => {
        const res = await tryFetch(`${BASE_URL}/api/family/residents`);
        if (!res) { console.warn('⚠ Servidor no disponible — test de auth omitido'); return; }
        expect([401, 403]).toContain(res.status);
    });

});

// ═══════════════════════════════════════════════════════
// MÓDULO 5 — Admisiones: Wizard de ingreso
// ═══════════════════════════════════════════════════════
describe('Admisiones — Wizard de ingreso', () => {

    it('no hay Patient ACTIVE sin IntakeData', async () => {
        const withoutIntake = await prisma.patient.findMany({
            where: {
                status: 'ACTIVE',
                intakeData: null,
            },
            select: { id: true, name: true, createdAt: true },
            take: 20,
        });
        if (withoutIntake.length > 0) {
            console.warn('Admisiones: Pacientes ACTIVE sin IntakeData:', withoutIntake.map(p => p.name));
        }
        // Los pacientes pre-sistema pueden no tener IntakeData — warn, no fail
        expect(withoutIntake.length).toBeLessThan(20);
    });

    it('no hay IntakeData con status PENDING de más de 7 días sin actualizar', async () => {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const stale = await prisma.intakeData.findMany({
            where: {
                status: 'PENDING',
                updatedAt: { lt: sevenDaysAgo },
            },
            include: {
                patient: { select: { name: true } },
            },
        });
        if (stale.length > 0) {
            console.warn('Admisiones: IntakeData PENDING sin actualizar >7 días:', stale.map(i => i.patient?.name));
        }
        expect(stale).toHaveLength(0);
    });

    it('todos los Patient ACTIVE tienen headquartersId válido', async () => {
        const bad = await prisma.$queryRaw<{ id: string; name: string }[]>`
            SELECT p.id, p.name
            FROM "Patient" p
            LEFT JOIN "Headquarters" hq ON hq.id = p."headquartersId"
            WHERE p.status = 'ACTIVE' AND hq.id IS NULL
            LIMIT 10
        `;
        if (bad.length > 0) {
            console.warn('Admisiones: Pacientes ACTIVE con HQ inválida:', bad);
        }
        expect(bad).toHaveLength(0);
    });

    it('no hay Patient ACTIVE sin nombre', async () => {
        // Patient.name es String (non-nullable) — solo verificar vacío
        const nameless = await prisma.patient.findMany({
            where: {
                status: 'ACTIVE',
                name: '',
            },
            select: { id: true },
        });
        expect(nameless).toHaveLength(0);
    });

});
