import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { logError, logWarn } from '@/lib/logger';
import { SystemAuditAction } from '@prisma/client';

export const dynamic = 'force-dynamic';

/**
 * POST /api/corporate/external-services/[id]/reject
 *
 * El director rechaza una visita PENDING_REVIEW → status REJECTED.
 * Un solo click, sin razón obligatoria (UX preferida por Andrés).
 *
 * Efectos:
 *   1. Actualiza visit: status=REJECTED, reviewedById, reviewedAt
 *   2. NO notifica a nadie (ni familia ni visitante)
 *   3. Audit log
 *
 * La visita queda en el historial para que el director pueda revisar
 * decisiones pasadas si necesita.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: visitId } = await params;
        const auth = await requireRole(['DIRECTOR', 'ADMIN']);
        if (auth instanceof NextResponse) return auth;
        const hqId = auth.headquartersId;

        const visit = await prisma.externalServiceVisit.findFirst({
            where: { id: visitId, headquartersId: hqId },
            select: { id: true, status: true },
        });
        if (!visit) {
            return NextResponse.json({ success: false, error: 'Visita no encontrada' }, { status: 404 });
        }
        if (visit.status !== 'PENDING_REVIEW') {
            return NextResponse.json(
                { success: false, error: `Esta visita ya está en estado ${visit.status}` },
                { status: 409 },
            );
        }

        await prisma.externalServiceVisit.update({
            where: { id: visitId },
            data: {
                status: 'REJECTED',
                reviewedById: auth.id,
                reviewedAt: new Date(),
            },
        });

        try {
            await prisma.systemAuditLog.create({
                data: {
                    headquartersId: hqId,
                    entityName: 'ExternalServiceVisit',
                    entityId: visitId,
                    action: SystemAuditAction.STATE_CHANGED,
                    performedById: auth.id,
                    payloadChanges: {
                        trigger: 'DIRECTOR_REJECT',
                        from: 'PENDING_REVIEW',
                        to: 'REJECTED',
                    },
                },
            });
        } catch (e) {
            logWarn('external-services.reject.audit', e, { visitId });
        }

        return NextResponse.json({
            success: true,
            visitId,
            message: 'Visita rechazada. No se publicará a familias.',
        });
    } catch (err: any) {
        logError('corporate.external-services.reject', err);
        return NextResponse.json({ success: false, error: 'Error rechazando visita' }, { status: 500 });
    }
}
