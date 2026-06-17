import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { logError } from '@/lib/logger';
import { withPhiAccessLog, logPhiAccess } from '@/lib/phi-audit';
import { PhiAccessAction } from '@prisma/client';

export const dynamic = 'force-dynamic';

/**
 * GET /api/corporate/external-services/visits
 *
 * Listado consolidado de visitas externas para el dashboard del director
 * (historial + auditoría). Distinto a /pending: incluye todos los status.
 *
 * Query params:
 *   - status       (string, opcional): PENDING_REVIEW | PUBLISHED | REJECTED
 *   - providerId   (string, opcional)
 *   - categoryId   (string, opcional)
 *   - patientId    (string, opcional): visitas que afectaron a este residente
 *   - from         (ISO date, opcional)
 *   - to           (ISO date, opcional)
 *   - take         (number, default 50, max 200)
 *   - skip         (number, default 0)
 *
 * Auth: DIRECTOR/ADMIN/SUPERVISOR/NURSE/COORDINATOR (lectura).
 *
 * PHI audit (Pilar 1) — lista multi-paciente. Wrap exterior + fila-por-paciente
 * para los residentes únicos referenciados en el response (los servicios
 * facility-wide no cuentan como acceso individual a paciente).
 * Sprint Coordinador (jun-2026): wrapped antes de exponer a COORDINATOR.
 */
export const GET = withPhiAccessLog(getVisitsHandler, {
    resourceType: 'ExternalServiceVisitList',
});

async function getVisitsHandler(req: Request) {
    try {
        const auth = await requireRole(['DIRECTOR', 'ADMIN', 'SUPERVISOR', 'NURSE', 'COORDINATOR']);
        if (auth instanceof NextResponse) return auth;
        const hqId = auth.headquartersId;

        const { searchParams } = new URL(req.url);
        const status = searchParams.get('status');
        const providerId = searchParams.get('providerId');
        const categoryId = searchParams.get('categoryId');
        const patientId = searchParams.get('patientId');
        const from = searchParams.get('from');
        const to = searchParams.get('to');
        const take = Math.min(200, Math.max(1, parseInt(searchParams.get('take') || '50', 10) || 50));
        const skip = Math.max(0, parseInt(searchParams.get('skip') || '0', 10) || 0);

        const where: any = { headquartersId: hqId };
        if (status && ['PENDING_REVIEW', 'PUBLISHED', 'REJECTED'].includes(status)) {
            where.status = status;
        }
        if (providerId) where.providerId = providerId;
        if (categoryId) where.provider = { categoryId };
        if (patientId) {
            // Visitas que incluyen a este paciente (vía pivot) o que son
            // facilityWide PUBLISHED (cubrieron a todos los activos del día).
            where.OR = [
                { patientVisits: { some: { patientId } } },
                { isFacilityWide: true, status: 'PUBLISHED' },
            ];
        }
        if (from || to) {
            where.registeredAt = {};
            if (from) where.registeredAt.gte = new Date(from);
            if (to) where.registeredAt.lte = new Date(to);
        }

        const [total, visits] = await Promise.all([
            prisma.externalServiceVisit.count({ where }),
            prisma.externalServiceVisit.findMany({
                where,
                orderBy: { registeredAt: 'desc' },
                take,
                skip,
                include: {
                    provider: { select: { id: true, name: true, category: { select: { id: true, name: true, icon: true } } } },
                    patientVisits: { include: { patient: { select: { id: true, name: true, roomNumber: true } } } },
                    reviewedBy: { select: { id: true, name: true } },
                },
            }),
        ]);

        // Fila-por-paciente: emite un logPhiAccess por cada residente único
        // que aparezca en patientVisits del payload. Facility-wide visits no
        // listan pacientes específicos — no se cuentan como acceso individual
        // (la fila de la lista exterior ya cubre ese caso).
        const seenPatients = new Set<string>();
        for (const v of visits) {
            for (const pv of v.patientVisits) {
                const pid = pv.patient?.id;
                if (!pid || seenPatients.has(pid)) continue;
                seenPatients.add(pid);
                logPhiAccess({
                    action: PhiAccessAction.READ,
                    resourceType: 'ExternalServiceVisit',
                    resourceId: v.id,
                    patientId: pid,
                    userId: auth.id,
                    userRole: auth.role,
                    hqId,
                    success: true,
                    routePath: '/api/corporate/external-services/visits',
                    context: { status, listSize: visits.length },
                });
            }
        }

        return NextResponse.json({
            success: true,
            total,
            take,
            skip,
            visits: visits.map(v => ({
                id: v.id,
                provider: v.provider,
                serviceType: v.serviceType,
                comment: v.comment,
                isFacilityWide: v.isFacilityWide,
                notifyFamilies: v.notifyFamilies,
                status: v.status,
                registeredAt: v.registeredAt,
                registeredFromFloor: v.registeredFromFloor,
                reviewedBy: v.reviewedBy,
                reviewedAt: v.reviewedAt,
                autoPublished: v.autoPublished,
                patients: v.patientVisits.map(pv => pv.patient),
            })),
        });
    } catch (err: any) {
        logError('corporate.external-services.visits', err);
        return NextResponse.json({ success: false, error: 'Error cargando visitas' }, { status: 500 });
    }
}
