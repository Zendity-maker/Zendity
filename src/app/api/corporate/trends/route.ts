import { NextRequest, NextResponse } from "next/server";
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { todayStartAST } from '@/lib/dates';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['DIRECTOR', 'ADMIN', 'SUPERVISOR'];
const MULTI_HQ_ROLES = ['DIRECTOR', 'ADMIN'];

const DAY_MS = 24 * 60 * 60 * 1000;

// Clinical-day thresholds para marcar vitales como anómalos
function isAbnormalVital(v: {
    systolic: number; diastolic: number; heartRate: number; temperature: number; spo2: number | null;
}): boolean {
    if (v.spo2 !== null && v.spo2 < 94) return true;
    if (v.systolic > 140 || v.systolic < 90) return true;
    if (v.diastolic > 90 || v.diastolic < 60) return true;
    if (v.heartRate < 50 || v.heartRate > 100) return true;
    if (v.temperature > 38 || v.temperature < 36) return true;
    return false;
}

function formatISODate(d: Date): string {
    // Retorna YYYY-MM-DD anclado en AST (restamos 4h para representar clock AST)
    const ast = new Date(d.getTime() - 4 * 60 * 60 * 1000);
    return ast.toISOString().slice(0, 10);
}

/**
 * GET /api/corporate/trends?hqId=X&days=7
 * Series diarias (últimos N días) + deltas vs semana anterior.
 * Día clínico: 6 AM AST → 6 AM AST siguiente.
 */
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }
        const role = (session.user as any).role;
        if (!ALLOWED_ROLES.includes(role)) {
            return NextResponse.json({ success: false, error: 'Rol no autorizado' }, { status: 403 });
        }
        const sessionHqId = (session.user as any).headquartersId;
        if (!sessionHqId) {
            return NextResponse.json({ success: false, error: 'Usuario sin sede asignada' }, { status: 400 });
        }

        const requestedHqId = request.nextUrl.searchParams.get('hqId');
        let effectiveHqId: string | 'ALL';
        if (MULTI_HQ_ROLES.includes(role)) {
            effectiveHqId = (!requestedHqId || requestedHqId === 'ALL') ? 'ALL' : requestedHqId;
        } else {
            effectiveHqId = sessionHqId;
        }

        const daysParam = parseInt(request.nextUrl.searchParams.get('days') || '7', 10);
        const days = Math.min(Math.max(isNaN(daysParam) ? 7 : daysParam, 1), 30);

        // Ventanas temporales: [windowStart, today) y semana anterior [prevStart, windowStart)
        const todayStart = todayStartAST(); // hoy 6AM AST
        const windowStart = new Date(todayStart.getTime() - (days - 1) * DAY_MS);
        const windowEnd = new Date(todayStart.getTime() + DAY_MS); // incluye hoy completo
        const prevStart = new Date(windowStart.getTime() - days * DAY_MS);
        const prevEnd = windowStart;

        // Construir buckets diarios [start, end) de la ventana actual
        const buckets: { date: string; start: Date; end: Date }[] = [];
        for (let i = 0; i < days; i++) {
            const start = new Date(windowStart.getTime() + i * DAY_MS);
            const end = new Date(start.getTime() + DAY_MS);
            buckets.push({ date: formatISODate(start), start, end });
        }

        // Filtro de HQ común
        const hqFilter = (effectiveHqId === 'ALL') ? {} : { headquartersId: effectiveHqId };
        const hqFilterViaPatient = (effectiveHqId === 'ALL')
            ? {}
            : { patient: { headquartersId: effectiveHqId } };
        const hqFilterViaPatientMed = (effectiveHqId === 'ALL')
            ? {}
            : { patientMedication: { patient: { headquartersId: effectiveHqId } } };

        // ── Fetch paralelo de todos los datos necesarios ──
        const [
            medsCurrent, medsPrev,
            handoversCurrent, handoversPrev,
            vitalsCurrent, vitalsPrev,
            triageCurrent, triagePrev,
            bathsCurrent, bathsPrev,
            mealsCurrent, mealsPrev,
            activePatientsCount,
        ] = await Promise.all([
            // MedicationAdministration — eMAR
            prisma.medicationAdministration.findMany({
                where: {
                    ...hqFilterViaPatientMed,
                    OR: [
                        { scheduledTime: { gte: windowStart, lt: windowEnd } },
                        { administeredAt: { gte: windowStart, lt: windowEnd } },
                    ],
                },
                select: { status: true, scheduledTime: true, administeredAt: true },
            }),
            prisma.medicationAdministration.findMany({
                where: {
                    ...hqFilterViaPatientMed,
                    OR: [
                        { scheduledTime: { gte: prevStart, lt: prevEnd } },
                        { administeredAt: { gte: prevStart, lt: prevEnd } },
                    ],
                },
                select: { status: true },
            }),
            // ShiftHandover
            prisma.shiftHandover.findMany({
                where: { ...hqFilter, createdAt: { gte: windowStart, lt: windowEnd } },
                select: { id: true, createdAt: true, supervisorSignedAt: true, status: true },
            }),
            prisma.shiftHandover.findMany({
                where: { ...hqFilter, createdAt: { gte: prevStart, lt: prevEnd } },
                select: { id: true, supervisorSignedAt: true },
            }),
            // VitalSigns
            prisma.vitalSigns.findMany({
                where: { ...hqFilterViaPatient, createdAt: { gte: windowStart, lt: windowEnd } },
                select: { createdAt: true, systolic: true, diastolic: true, heartRate: true, temperature: true, spo2: true },
            }),
            prisma.vitalSigns.findMany({
                where: { ...hqFilterViaPatient, createdAt: { gte: prevStart, lt: prevEnd } },
                select: { systolic: true, diastolic: true, heartRate: true, temperature: true, spo2: true },
            }),
            // TriageTicket
            prisma.triageTicket.findMany({
                where: { ...hqFilter, createdAt: { gte: windowStart, lt: windowEnd }, isVoided: false },
                select: { createdAt: true, resolvedAt: true, status: true },
            }),
            prisma.triageTicket.findMany({
                where: { ...hqFilter, createdAt: { gte: prevStart, lt: prevEnd }, isVoided: false },
                select: { status: true, createdAt: true, resolvedAt: true },
            }),
            // BathLog
            prisma.bathLog.findMany({
                where: { ...hqFilterViaPatient, timeLogged: { gte: windowStart, lt: windowEnd } },
                select: { timeLogged: true },
            }),
            prisma.bathLog.findMany({
                where: { ...hqFilterViaPatient, timeLogged: { gte: prevStart, lt: prevEnd } },
                select: { timeLogged: true },
            }),
            // MealLog
            prisma.mealLog.findMany({
                where: { ...hqFilterViaPatient, timeLogged: { gte: windowStart, lt: windowEnd } },
                select: { timeLogged: true, mealType: true, patientId: true },
            }),
            prisma.mealLog.findMany({
                where: { ...hqFilterViaPatient, timeLogged: { gte: prevStart, lt: prevEnd } },
                select: { mealType: true, patientId: true },
            }),
            // Pacientes activos actuales (para normalizar baños y comidas)
            prisma.patient.count({
                where: {
                    ...(effectiveHqId === 'ALL' ? {} : { headquartersId: effectiveHqId }),
                    status: { notIn: ['DISCHARGED', 'DECEASED'] },
                },
            }),
        ]);

        // Helper: agrupar items por bucket según getter de fecha
        const bucketize = <T,>(items: T[], getDate: (item: T) => Date | null | undefined) => {
            return buckets.map((b) => {
                const rows = items.filter((it) => {
                    const d = getDate(it);
                    return d instanceof Date && d >= b.start && d < b.end;
                });
                return { date: b.date, rows };
            });
        };

        // ── Serie 1: eMAR Cumplimiento diario ──
        const medsByDay = bucketize(medsCurrent, (m) => (m.scheduledTime || m.administeredAt));
        const emarSeries = medsByDay.map(({ date, rows }) => {
            const scheduled = rows.filter(r => ['ADMINISTERED', 'MISSED', 'REFUSED', 'OMITTED'].includes(r.status));
            const given = rows.filter(r => r.status === 'ADMINISTERED').length;
            const total = scheduled.length;
            const compliance = total > 0 ? Math.round((given / total) * 100) : null;
            return { date, compliance, total };
        });
        const emarCurrent = (() => {
            const sched = medsCurrent.filter(r => ['ADMINISTERED', 'MISSED', 'REFUSED', 'OMITTED'].includes(r.status));
            const given = medsCurrent.filter(r => r.status === 'ADMINISTERED').length;
            return sched.length > 0 ? (given / sched.length) * 100 : null;
        })();
        const emarPrev = (() => {
            const sched = medsPrev.filter(r => ['ADMINISTERED', 'MISSED', 'REFUSED', 'OMITTED'].includes(r.status));
            const given = medsPrev.filter(r => r.status === 'ADMINISTERED').length;
            return sched.length > 0 ? (given / sched.length) * 100 : null;
        })();

        // ── Serie 2: Handovers firmados vs pendientes + latencia ──
        const handoversByDay = bucketize(handoversCurrent, (h) => h.createdAt);
        const handoversSeries = handoversByDay.map(({ date, rows }) => {
            const signed = rows.filter(r => r.supervisorSignedAt).length;
            const pending = rows.length - signed;
            // latencia media en horas para los firmados
            const latencies = rows
                .filter(r => r.supervisorSignedAt)
                .map(r => (r.supervisorSignedAt!.getTime() - r.createdAt.getTime()) / (60 * 60 * 1000));
            const avgLatencyHours = latencies.length > 0
                ? Math.round((latencies.reduce((a, b) => a + b, 0) / latencies.length) * 10) / 10
                : null;
            return { date, total: rows.length, signed, pending, avgLatencyHours };
        });
        const handoversCurrentSigned = handoversCurrent.filter(h => h.supervisorSignedAt).length;
        const handoversPrevSigned = handoversPrev.filter(h => h.supervisorSignedAt).length;

        // ── Serie 3: Vitales anómalos ──
        const vitalsByDay = bucketize(vitalsCurrent, (v) => v.createdAt);
        const vitalsSeries = vitalsByDay.map(({ date, rows }) => {
            const abnormal = rows.filter(isAbnormalVital).length;
            return { date, total: rows.length, abnormal };
        });
        const vitalsCurrentAbnormal = vitalsCurrent.filter(isAbnormalVital).length;
        const vitalsPrevAbnormal = vitalsPrev.filter(isAbnormalVital).length;

        // ── Serie 4: Triage (tickets por día + MTTR) ──
        const triageByDay = bucketize(triageCurrent, (t) => t.createdAt);
        const triageSeries = triageByDay.map(({ date, rows }) => {
            const opened = rows.length;
            const resolved = rows.filter(r => r.resolvedAt).length;
            const mttrMs = rows
                .filter(r => r.resolvedAt)
                .map(r => r.resolvedAt!.getTime() - r.createdAt.getTime());
            const avgMttrHours = mttrMs.length > 0
                ? Math.round((mttrMs.reduce((a, b) => a + b, 0) / mttrMs.length / (60 * 60 * 1000)) * 10) / 10
                : null;
            return { date, opened, resolved, avgMttrHours };
        });

        // ── Serie 5: Baños por paciente activo ──
        const bathsByDay = bucketize(bathsCurrent, (b) => b.timeLogged);
        const denom = activePatientsCount || 1;
        const bathsSeries = bathsByDay.map(({ date, rows }) => ({
            date,
            total: rows.length,
            perPatient: Math.round((rows.length / denom) * 100) / 100,
        }));
        const bathsCurrentCount = bathsCurrent.length;
        const bathsPrevCount = bathsPrev.length;

        // ── Serie 6: Comidas (% de cobertura por día = distinct meals per patient / (patients * 3)) ──
        const mealsByDay = bucketize(mealsCurrent, (m) => m.timeLogged);
        const mealsSeries = mealsByDay.map(({ date, rows }) => {
            const uniqKeys = new Set(rows.map(r => `${r.patientId}::${r.mealType}`));
            const coverage = activePatientsCount > 0
                ? Math.round((uniqKeys.size / (activePatientsCount * 3)) * 100)
                : null;
            return { date, total: rows.length, uniquePatientMeals: uniqKeys.size, coverage };
        });

        // ── Deltas (semana actual vs anterior) ──
        const delta = (current: number, prev: number): number | null => {
            if (prev === 0 && current === 0) return 0;
            if (prev === 0) return null;
            return Math.round(((current - prev) / prev) * 100);
        };
        const deltaPoints = (current: number | null, prev: number | null): number | null => {
            if (current === null || prev === null) return null;
            return Math.round((current - prev) * 10) / 10;
        };

        const deltas = {
            deltaMeds: deltaPoints(emarCurrent, emarPrev), // pp
            deltaHandoversSigned: delta(handoversCurrentSigned, handoversPrevSigned),
            deltaVitalsAbnormal: delta(vitalsCurrentAbnormal, vitalsPrevAbnormal),
            deltaTriage: delta(triageCurrent.length, triagePrev.length),
            deltaBaths: delta(bathsCurrentCount, bathsPrevCount),
            deltaMeals: delta(mealsCurrent.length, mealsPrev.length),
        };

        return NextResponse.json({
            success: true,
            effectiveHqId,
            days,
            window: { start: windowStart.toISOString(), end: windowEnd.toISOString() },
            activePatients: activePatientsCount,
            series: {
                emar: emarSeries,
                handovers: handoversSeries,
                vitals: vitalsSeries,
                triage: triageSeries,
                baths: bathsSeries,
                meals: mealsSeries,
            },
            totals: {
                medsCurrent: medsCurrent.length,
                medsPrev: medsPrev.length,
                emarCurrent: emarCurrent === null ? null : Math.round(emarCurrent * 10) / 10,
                emarPrev: emarPrev === null ? null : Math.round(emarPrev * 10) / 10,
                handoversCurrentSigned,
                handoversPrevSigned,
                handoversCurrentTotal: handoversCurrent.length,
                vitalsCurrentAbnormal,
                vitalsPrevAbnormal,
                triageCurrent: triageCurrent.length,
                triagePrev: triagePrev.length,
                bathsCurrent: bathsCurrentCount,
                bathsPrev: bathsPrevCount,
                mealsCurrent: mealsCurrent.length,
                mealsPrev: mealsPrev.length,
            },
            deltas,
        });
    } catch (err: any) {
        console.error('[corporate/trends GET]', err);
        return NextResponse.json({ success: false, error: err.message || 'Error' }, { status: 500 });
    }
}
