#!/usr/bin/env npx tsx
/**
 * Zéndity — Health Check Script
 *
 * Diagnóstico rápido del estado de la base de datos de producción.
 * Consulta Neon directamente (solo lectura).
 *
 * Uso:
 *   npx tsx src/__tests__/health-check.ts
 *
 * Todas las queries corren en paralelo — tiempo objetivo < 30 segundos.
 */

import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({ log: [] });

interface CheckResult {
    label: string;
    ok: boolean;
    count?: number;
    detail?: string;
}

function icon(ok: boolean): string { return ok ? '✅' : '🔴'; }

async function run(): Promise<void> {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  Zéndity Health Check —', new Date().toLocaleString('es-PR', { timeZone: 'America/Puerto_Rico' }));
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const now = new Date();
    const h14ago = new Date(now.getTime() - 14 * 60 * 60 * 1000);
    const h4ago  = new Date(now.getTime() -  4 * 60 * 60 * 1000);
    const h1ago  = new Date(now.getTime() -  1 * 60 * 60 * 1000);
    const h48ago = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const d7ago  = new Date(now.getTime() -  7 * 24 * 60 * 60 * 1000);

    const [
        zombieSessions,
        noColorPatients,
        staleVitals,
        staleFastActions,
        oldNotifications,
        badScores,
        staleIntake,
        orphanedFamily,
        nullScheduleTimes,
    ] = await Promise.allSettled([

        // 1. ShiftSessions abiertas > 14h (zombis)
        prisma.shiftSession.findMany({
            where: { actualEndTime: null, startTime: { lt: h14ago } },
            include: { caregiver: { select: { name: true } } },
        }),

        // 2. Patients ACTIVE con colorGroup UNASSIGNED (enum non-nullable, default=UNASSIGNED)
        prisma.patient.findMany({
            where: { status: 'ACTIVE', colorGroup: 'UNASSIGNED' as any },
            select: { id: true, name: true },
        }),

        // 3. VitalsOrders PENDING > 4h sin completar
        prisma.vitalsOrder.findMany({
            where: { status: 'PENDING', expiresAt: { lt: h4ago } },
            include: { patient: { select: { name: true } } },
        }),

        // 4. FastActionAssignment PENDING > 1h (post-fix timer 60min)
        prisma.fastActionAssignment.findMany({
            where: { status: 'PENDING', expiresAt: { lt: h1ago } },
            include: { caregiver: { select: { name: true } } },
        }),

        // 5. Notifications no leídas > 48h
        prisma.notification.findMany({
            where: { isRead: false, createdAt: { lt: h48ago } },
            select: { id: true, userId: true, createdAt: true },
            take: 100,
        }),

        // 6. complianceScore fuera de rango 0-100 (Int non-nullable, @default(50))
        prisma.user.findMany({
            where: {
                isActive: true,
                isDeleted: false,
                OR: [
                    { complianceScore: { lt: 0 } },
                    { complianceScore: { gt: 100 } },
                ],
            },
            select: { name: true, complianceScore: true },
        }),

        // 7. IntakeData PENDING > 7 días
        prisma.intakeData.findMany({
            where: { status: 'PENDING', updatedAt: { lt: d7ago } },
            include: { patient: { select: { name: true } } },
        }),

        // 8. FamilyMember sin Patient válido
        prisma.$queryRaw<{ id: string; name: string }[]>`
            SELECT fm.id, fm.name
            FROM "FamilyMember" fm
            LEFT JOIN "Patient" p ON p.id = fm."patientId"
            WHERE p.id IS NULL
        `,

        // 9. PatientMedication ACTIVE con scheduleTimes vacío (String non-nullable)
        prisma.patientMedication.findMany({
            where: { status: 'ACTIVE', isActive: true, scheduleTimes: '' },
            include: { patient: { select: { name: true } } },
        }),
    ]);

    const results: CheckResult[] = [];

    // Helper para extraer valor de PromiseSettledResult
    function val<T>(r: PromiseSettledResult<T>, fallback: T): T {
        return r.status === 'fulfilled' ? r.value : fallback;
    }

    const zombies      = val(zombieSessions,    []);
    const noColor      = val(noColorPatients,   []);
    const staleV       = val(staleVitals,       []);
    const staleFA      = val(staleFastActions,  []);
    const oldNotifs    = val(oldNotifications,  []);
    const badSc        = val(badScores,         []);
    const staleIntk    = val(staleIntake,       []);
    const orphFam      = val(orphanedFamily,    []);
    const nullScheds   = val(nullScheduleTimes, []);

    results.push({
        label: 'ShiftSessions zombi (>14h sin cierre)',
        ok: zombies.length === 0,
        count: zombies.length,
        detail: zombies.length > 0
            ? zombies.map((s: any) => `${s.caregiver?.name || s.caregiverId} — ${s.startTime.toISOString()}`).join(', ')
            : undefined,
    });

    results.push({
        label: 'Patients ACTIVE sin grupo de color (UNASSIGNED)',
        ok: noColor.length === 0,
        count: noColor.length,
        detail: noColor.length > 0
            ? (noColor as any[]).slice(0, 5).map((p: any) => p.name).join(', ')
            : undefined,
    });

    results.push({
        label: 'VitalsOrders PENDING vencidas >4h',
        ok: staleV.length === 0,
        count: staleV.length,
    });

    results.push({
        label: 'FastActionAssignment PENDING expiradas >1h',
        ok: staleFA.length === 0,
        count: staleFA.length,
        detail: staleFA.length > 0
            ? (staleFA as any[]).slice(0, 3).map((fa: any) => fa.caregiver?.name || fa.caregiverId).join(', ')
            : undefined,
    });

    results.push({
        label: 'Notifications no leídas > 48h',
        ok: oldNotifs.length < 50,
        count: oldNotifs.length,
        detail: oldNotifs.length >= 50 ? 'Acumulación anormal — revisar sistema de notificaciones' : undefined,
    });

    results.push({
        label: 'complianceScore fuera de rango (0-100)',
        ok: badSc.length === 0,
        count: badSc.length,
        detail: badSc.length > 0
            ? (badSc as any[]).map((u: any) => `${u.name}: ${u.complianceScore}`).join(', ')
            : undefined,
    });

    results.push({
        label: 'IntakeData PENDING sin actualizar >7 días',
        ok: staleIntk.length === 0,
        count: staleIntk.length,
        detail: staleIntk.length > 0
            ? (staleIntk as any[]).map((i: any) => i.patient?.name || i.patientId).join(', ')
            : undefined,
    });

    results.push({
        label: 'FamilyMember sin Patient válido (huérfanos)',
        ok: (orphFam as any[]).length === 0,
        count: (orphFam as any[]).length,
    });

    results.push({
        label: 'PatientMedication ACTIVE sin scheduleTimes',
        ok: nullScheds.length === 0,
        count: nullScheds.length,
        detail: nullScheds.length > 0
            ? (nullScheds as any[]).slice(0, 3).map((m: any) => m.patient?.name || m.patientId).join(', ')
            : undefined,
    });

    // ── Imprimir resultados ──────────────────────────────
    let failures = 0;
    for (const r of results) {
        const countStr = r.count !== undefined ? ` (${r.count})` : '';
        console.log(`  ${icon(r.ok)}  ${r.label}${countStr}`);
        if (!r.ok && r.detail) {
            console.log(`       ↳ ${r.detail}`);
        }
        if (!r.ok) failures++;
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    if (failures === 0) {
        console.log('  ✅  Sistema operativo — todos los checks en verde.');
    } else {
        console.log(`  🔴  ${failures} check${failures > 1 ? 's' : ''} fallido${failures > 1 ? 's' : ''} — revisar detalles arriba.`);
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    await prisma.$disconnect();
    process.exit(failures > 0 ? 1 : 0);
}

run().catch(async (err) => {
    console.error('🔴 Error fatal en health-check:', err);
    await prisma.$disconnect();
    process.exit(2);
});
