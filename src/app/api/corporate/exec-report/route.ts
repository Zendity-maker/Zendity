import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { requireRole } from '@/lib/api-auth';
import { resolveEffectiveHqId } from '@/lib/hq-resolver';
import { prisma } from '@/lib/prisma';
import { todayStartAST } from '@/lib/dates';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const ALLOWED_ROLES = ['DIRECTOR', 'ADMIN'];

/**
 * GET /api/corporate/exec-report?period=day|week|month
 *
 * Reporte ejecutivo del director: censo+movimientos, clínico, operacional y
 * personal — agregado para el período seleccionado:
 *   - day:   hoy clínico AST (6am hoy → ahora)
 *   - week:  últimos 7 días móviles
 *   - month: últimos 30 días móviles
 *
 * Gated DIRECTOR/ADMIN. hqId desde sesión.
 */
export async function GET(req: Request) {
    try {
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;
        const session = await getServerSession(authOptions);

        const { searchParams } = new URL(req.url);
        const periodParam = (searchParams.get('period') || 'day') as 'day' | 'week' | 'month';
        if (!['day', 'week', 'month'].includes(periodParam)) {
            return NextResponse.json({ success: false, error: 'period inválido (day|week|month)' }, { status: 400 });
        }

        let hqId: string;
        try { hqId = await resolveEffectiveHqId(session!, searchParams.get('hqId')); }
        catch (e: any) { return NextResponse.json({ success: false, error: e.message || 'Sede inválida' }, { status: 400 }); }

        const now = new Date();
        const periodStart =
            periodParam === 'day' ? todayStartAST() :
            periodParam === 'week' ? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) :
            new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const periodEnd = now;

        const hq = await prisma.headquarters.findUnique({ where: { id: hqId }, select: { name: true } });

        // Batch en paralelo — todas las agregaciones del período.
        const [
            activeNow, leaveNow,
            admisiones, egresos, hospitalizaciones,
            medsByStatus, vitalsRows, rotations, clinIncidents,
            sessionsOpened, sessionsClosed, sessionsForcedClosed,
            absences, handoversAll, handoversCompleted, overridesCreated,
            staffWithScore, hrIncidents,
        ] = await Promise.all([
            prisma.patient.count({ where: { headquartersId: hqId, status: 'ACTIVE' } }),
            prisma.patient.count({ where: { headquartersId: hqId, status: 'TEMPORARY_LEAVE' } }),
            prisma.patient.count({ where: { headquartersId: hqId, createdAt: { gte: periodStart, lte: periodEnd } } }),
            prisma.patient.count({ where: { headquartersId: hqId, dischargeDate: { gte: periodStart, lte: periodEnd } } }),
            prisma.patient.count({ where: { headquartersId: hqId, leaveType: 'HOSPITAL', leaveDate: { gte: periodStart, lte: periodEnd } } }),
            // Meds: filtrar vía PatientMedication → Patient → headquartersId
            prisma.medicationAdministration.groupBy({
                by: ['status'],
                where: {
                    patientMedication: { patient: { headquartersId: hqId } },
                    createdAt: { gte: periodStart, lte: periodEnd },
                },
                _count: { _all: true },
            }),
            prisma.vitalSigns.findMany({
                where: { patient: { headquartersId: hqId }, createdAt: { gte: periodStart, lte: periodEnd } },
                select: { systolic: true, diastolic: true, spo2: true },
            }),
            prisma.posturalChangeLog.count({
                where: { patient: { headquartersId: hqId }, performedAt: { gte: periodStart, lte: periodEnd } },
            }),
            prisma.incidentReport.groupBy({
                by: ['severity'],
                where: { headquartersId: hqId, createdAt: { gte: periodStart, lte: periodEnd } },
                _count: { _all: true },
            }),
            prisma.shiftSession.count({ where: { headquartersId: hqId, startTime: { gte: periodStart, lte: periodEnd } } }),
            prisma.shiftSession.count({ where: { headquartersId: hqId, actualEndTime: { gte: periodStart, lte: periodEnd } } }),
            prisma.systemAuditLog.count({
                where: { headquartersId: hqId, action: 'SYSTEM_ABANDONED', createdAt: { gte: periodStart, lte: periodEnd } },
            }),
            prisma.scheduledShift.count({
                where: { schedule: { headquartersId: hqId }, isAbsent: true, absentMarkedAt: { gte: periodStart, lte: periodEnd } },
            }),
            prisma.shiftHandover.count({
                where: { headquartersId: hqId, createdAt: { gte: periodStart, lte: periodEnd }, isDailyPrologue: false, signature: { not: null } },
            }),
            prisma.shiftHandover.count({
                where: { headquartersId: hqId, createdAt: { gte: periodStart, lte: periodEnd }, isDailyPrologue: false, handoverCompleted: true },
            }),
            prisma.shiftPatientOverride.count({
                where: { headquartersId: hqId, createdAt: { gte: periodStart, lte: periodEnd } },
            }),
            prisma.user.findMany({
                where: { headquartersId: hqId, isActive: true, isDeleted: false, role: { in: ['CAREGIVER', 'NURSE', 'SUPERVISOR'] } },
                select: { name: true, role: true, complianceScore: true },
            }),
            prisma.incidentReport.groupBy({
                by: ['severity'],
                where: {
                    headquartersId: hqId,
                    createdAt: { gte: periodStart, lte: periodEnd },
                    status: { in: ['APPLIED', 'PENDING_EXPLANATION', 'EXPLANATION_RECEIVED'] as any[] },
                },
                _count: { _all: true },
            }),
        ]);

        // Meds
        const medsMap: Record<string, number> = {};
        medsByStatus.forEach(m => { medsMap[m.status] = m._count._all; });
        const medsTotal = Object.values(medsMap).reduce((a, b) => a + b, 0);
        const administered = medsMap['ADMINISTERED'] || 0;
        const compliancePct = medsTotal > 0 ? Math.round((administered / medsTotal) * 100) : 0;

        // Vitales críticos
        const vitalsCritical = vitalsRows.filter(v =>
            (v.spo2 != null && v.spo2 < 94) ||
            (v.systolic != null && v.systolic > 160) ||
            (v.diastolic != null && v.diastolic > 100),
        ).length;

        // Incidents por severidad (clínico — todos los del período)
        const sevBuckets = ['OBSERVATION', 'WARNING', 'SUSPENSION', 'TERMINATION'];
        const incidentsBySev: Record<string, number> = {};
        sevBuckets.forEach(s => { incidentsBySev[s] = 0; });
        clinIncidents.forEach(i => { incidentsBySev[i.severity] = i._count._all; });
        const hrIncBySev: Record<string, number> = {};
        sevBuckets.forEach(s => { hrIncBySev[s] = 0; });
        hrIncidents.forEach(i => { hrIncBySev[i.severity] = i._count._all; });

        // Compliance score: avg + top/bottom
        const withScore = staffWithScore.filter(s => typeof s.complianceScore === 'number');
        const avgCompliance = withScore.length > 0
            ? Math.round(withScore.reduce((a, s) => a + (s.complianceScore || 0), 0) / withScore.length)
            : 0;
        const sortedStaff = [...withScore].sort((a, b) => (b.complianceScore || 0) - (a.complianceScore || 0));
        const topStaff = sortedStaff.slice(0, 3).map(s => ({ name: s.name, role: s.role, score: s.complianceScore || 0 }));
        const bottomStaff = sortedStaff.slice(-3).reverse().map(s => ({ name: s.name, role: s.role, score: s.complianceScore || 0 }));

        const handoverPct = handoversAll > 0 ? Math.round((handoversCompleted / handoversAll) * 100) : 0;

        return NextResponse.json({
            success: true,
            hqName: hq?.name || 'Sede',
            directorName: auth.name || 'Director',
            period: periodParam,
            periodStart: periodStart.toISOString(),
            periodEnd: periodEnd.toISOString(),
            censo: { activeNow, leaveNow, admisiones, egresos, hospitalizaciones },
            clinico: {
                meds: {
                    total: medsTotal,
                    administered,
                    omitted: medsMap['OMITTED'] || 0,
                    refused: medsMap['REFUSED'] || 0,
                    held: medsMap['HELD'] || 0,
                    pending: medsMap['PENDING'] || 0,
                    compliancePct,
                },
                vitals: { total: vitalsRows.length, critical: vitalsCritical },
                rotations,
                incidents: incidentsBySev,
            },
            operacional: {
                sessionsOpened, sessionsClosed, sessionsForcedClosed,
                absences,
                handovers: { total: handoversAll, completed: handoversCompleted, completedPct: handoverPct },
                overridesCreated,
            },
            personal: {
                totalStaff: staffWithScore.length,
                avgCompliance,
                topStaff, bottomStaff,
                hrIncidents: hrIncBySev,
            },
        });
    } catch (error: any) {
        console.error('[corporate/exec-report] error:', error);
        return NextResponse.json({ success: false, error: 'Error generando reporte ejecutivo' }, { status: 500 });
    }
}
