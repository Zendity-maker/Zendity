import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { logError } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/corporate/external-services/pending
 *
 * Lista de visitas externas con status=PENDING_REVIEW para que el director
 * apruebe o rechace. Ordenadas por fecha de registro (más viejas primero —
 * priorizan SLA).
 *
 * Incluye:
 *   - provider con su categoría (icon + name)
 *   - patientVisits con datos del paciente (name + roomNumber + colorGroup)
 *   - registrant info (piso de la tablet)
 *   - tiempo desde el registro (para alertar SLA expirado >24h)
 */
export async function GET() {
    try {
        const auth = await requireRole(['DIRECTOR', 'ADMIN', 'SUPERVISOR']);
        if (auth instanceof NextResponse) return auth;
        const hqId = auth.headquartersId;

        const visits = await prisma.externalServiceVisit.findMany({
            where: { headquartersId: hqId, status: 'PENDING_REVIEW' },
            orderBy: { registeredAt: 'asc' },
            include: {
                provider: {
                    select: {
                        id: true,
                        name: true,
                        category: { select: { id: true, name: true, icon: true } },
                    },
                },
                patientVisits: {
                    include: {
                        patient: { select: { id: true, name: true, roomNumber: true, colorGroup: true } },
                    },
                },
            },
        });

        const now = Date.now();
        const enriched = visits.map(v => {
            const ageMs = now - new Date(v.registeredAt).getTime();
            const ageHours = Math.floor(ageMs / (1000 * 60 * 60));
            const slaExpired = ageHours >= 24;
            return {
                id: v.id,
                provider: v.provider,
                serviceType: v.serviceType,
                comment: v.comment,
                isFacilityWide: v.isFacilityWide,
                notifyFamilies: v.notifyFamilies,
                registeredAt: v.registeredAt,
                registeredFromFloor: v.registeredFromFloor,
                ageHours,
                slaExpired,
                patients: v.patientVisits.map(pv => pv.patient),
            };
        });

        return NextResponse.json({ success: true, visits: enriched });
    } catch (err: any) {
        logError('corporate.external-services.pending', err);
        return NextResponse.json({ success: false, error: 'Error cargando pendientes' }, { status: 500 });
    }
}
