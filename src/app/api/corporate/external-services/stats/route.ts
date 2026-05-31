import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { logError } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/corporate/external-services/stats
 *
 * Estadísticas de visitas externas. Por defecto, mes en curso. Acepta
 * ?from=ISO&to=ISO para ventanas custom.
 *
 * Devuelve:
 *   - totalPublished, totalPending, totalRejected, autoPublishedCount
 *   - byCategory[]: visitas publicadas por categoría (bar chart)
 *   - topProviders[]: top 5 proveedores con más visitas publicadas
 *   - topPatients[]: top 5 residentes más visitados (excluye facilityWide)
 *   - approvalRate: published / (published + rejected) [%]
 *   - slaExpiredCount: visitas PENDING_REVIEW con >24h de antigüedad
 */
export async function GET(req: Request) {
    try {
        const auth = await requireRole(['DIRECTOR', 'ADMIN', 'SUPERVISOR']);
        if (auth instanceof NextResponse) return auth;
        const hqId = auth.headquartersId;

        const { searchParams } = new URL(req.url);
        const fromParam = searchParams.get('from');
        const toParam = searchParams.get('to');

        const now = new Date();
        const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1);
        const defaultTo = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const from = fromParam ? new Date(fromParam) : defaultFrom;
        const to = toParam ? new Date(toParam) : defaultTo;

        const baseWhere = { headquartersId: hqId, registeredAt: { gte: from, lt: to } };

        // Counts globales del periodo
        const [byStatus, allInPeriod] = await Promise.all([
            prisma.externalServiceVisit.groupBy({
                by: ['status'],
                where: baseWhere,
                _count: { _all: true },
            }),
            prisma.externalServiceVisit.findMany({
                where: { ...baseWhere, status: 'PUBLISHED' },
                include: {
                    provider: { include: { category: true } },
                    patientVisits: { select: { patientId: true } },
                },
            }),
        ]);

        const byStatusMap = Object.fromEntries(byStatus.map(s => [s.status, s._count._all]));
        const totalPublished = byStatusMap['PUBLISHED'] || 0;
        const totalPending = byStatusMap['PENDING_REVIEW'] || 0;
        const totalRejected = byStatusMap['REJECTED'] || 0;
        const autoPublishedCount = allInPeriod.filter(v => v.autoPublished).length;

        // By category
        const catCounts: Record<string, { id: string; name: string; icon: string | null; count: number }> = {};
        for (const v of allInPeriod) {
            const c = v.provider.category;
            if (!catCounts[c.id]) catCounts[c.id] = { id: c.id, name: c.name, icon: c.icon, count: 0 };
            catCounts[c.id].count++;
        }
        const byCategory = Object.values(catCounts).sort((a, b) => b.count - a.count);

        // Top providers
        const provCounts: Record<string, { id: string; name: string; count: number }> = {};
        for (const v of allInPeriod) {
            const p = v.provider;
            if (!provCounts[p.id]) provCounts[p.id] = { id: p.id, name: p.name, count: 0 };
            provCounts[p.id].count++;
        }
        const topProviders = Object.values(provCounts).sort((a, b) => b.count - a.count).slice(0, 5);

        // Top patients (excluye facilityWide)
        const patientCounts: Record<string, number> = {};
        for (const v of allInPeriod) {
            if (v.isFacilityWide) continue;
            for (const pv of v.patientVisits) {
                patientCounts[pv.patientId] = (patientCounts[pv.patientId] || 0) + 1;
            }
        }
        const topPatientIds = Object.entries(patientCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);
        const topPatientsData = topPatientIds.length > 0
            ? await prisma.patient.findMany({
                where: { id: { in: topPatientIds.map(([id]) => id) } },
                select: { id: true, name: true, roomNumber: true },
            })
            : [];
        const topPatients = topPatientIds.map(([id, count]) => {
            const p = topPatientsData.find(x => x.id === id);
            return { id, name: p?.name || 'Desconocido', roomNumber: p?.roomNumber || null, count };
        });

        // Tasa de aprobación
        const reviewedSum = totalPublished + totalRejected;
        const approvalRate = reviewedSum > 0 ? Math.round((totalPublished / reviewedSum) * 100) : null;

        // SLA expired
        const slaThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const slaExpiredCount = await prisma.externalServiceVisit.count({
            where: {
                headquartersId: hqId,
                status: 'PENDING_REVIEW',
                registeredAt: { lt: slaThreshold },
            },
        });

        return NextResponse.json({
            success: true,
            period: { from: from.toISOString(), to: to.toISOString() },
            totalPublished,
            totalPending,
            totalRejected,
            autoPublishedCount,
            approvalRate,
            slaExpiredCount,
            byCategory,
            topProviders,
            topPatients,
        });
    } catch (err: any) {
        logError('corporate.external-services.stats', err);
        return NextResponse.json({ success: false, error: 'Error generando stats' }, { status: 500 });
    }
}
