/**
 * GET /api/corporate/sw-evaluations/summary
 *
 * Resumen agregado de SWEvaluation A NIVEL DE SEDE para el dashboard del
 * Trabajador Social (P9 SW Eval). Superficie PHI agregada — el riesgo de
 * un widget que lea cross-sede es un breach multi-tenant.
 *
 * Salvaguardas:
 *   - requireRole [SOCIAL_WORKER, DIRECTOR, ADMIN]
 *   - withPhiAccessLog action=READ, resourceType=SocialWorkEvaluation
 *   - TODO query Prisma scoped a `headquartersId: auth.headquartersId` —
 *     nunca un findMany sin filter de hqId
 *
 * Output:
 *   {
 *     success: true,
 *     summary: {
 *       draftCount: number,                          // total DRAFTs abiertos en la sede
 *       oldestDraftDays: number | null,              // días desde el más viejo (alerta si >7)
 *       approvedThisMonthCount: number,              // APPROVED en el mes calendario actual
 *       recentApproved: [{id, patientId, patientName, signerName, approvedAt}],  // últimas 5
 *       oldestDrafts: [{id, patientId, patientName, createdAt, createdByName}]   // top 5 más viejos
 *     }
 *   }
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { withPhiAccessLog } from '@/lib/phi-audit';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['SOCIAL_WORKER', 'DIRECTOR', 'ADMIN'];

export const GET = withPhiAccessLog(getSummaryHandler, {
    resourceType: 'SocialWorkEvaluation',
    // No hay patientId — este es agregado. Pasamos null para que el audit
    // marque correctamente "acceso a la lista agregada de la sede".
});

async function getSummaryHandler(_req: Request) {
    const auth = await requireRole(ALLOWED_ROLES);
    if (auth instanceof NextResponse) return auth;

    const hqId = auth.headquartersId;

    // Inicio del mes calendar actual (para "aprobadas del mes")
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // ── TODAS las queries scope a hqId del invocador. Defensa por capa. ──

    const [draftCount, approvedThisMonthCount, oldestDrafts, recentApproved] = await Promise.all([
        prisma.sWEvaluation.count({
            where: { headquartersId: hqId, status: 'DRAFT' },
        }),
        prisma.sWEvaluation.count({
            where: { headquartersId: hqId, status: 'APPROVED', approvedAt: { gte: monthStart } },
        }),
        prisma.sWEvaluation.findMany({
            where: { headquartersId: hqId, status: 'DRAFT' },
            orderBy: { createdAt: 'asc' }, // más viejos primero
            take: 5,
            select: {
                id: true, patientId: true, createdAt: true,
                patient: { select: { name: true } },
                createdBy: { select: { name: true } },
            },
        }),
        prisma.sWEvaluation.findMany({
            where: { headquartersId: hqId, status: 'APPROVED' },
            orderBy: { approvedAt: 'desc' },
            take: 5,
            select: {
                id: true, patientId: true, approvedAt: true, signerName: true,
                patient: { select: { name: true } },
            },
        }),
    ]);

    const oldestDraftDays = oldestDrafts.length > 0
        ? Math.floor((Date.now() - oldestDrafts[0].createdAt.getTime()) / (1000 * 60 * 60 * 24))
        : null;

    return NextResponse.json({
        success: true,
        summary: {
            draftCount,
            oldestDraftDays,
            approvedThisMonthCount,
            recentApproved: recentApproved.map(e => ({
                id: e.id,
                patientId: e.patientId,
                patientName: e.patient?.name ?? '(desconocido)',
                signerName: e.signerName,
                approvedAt: e.approvedAt?.toISOString() ?? null,
            })),
            oldestDrafts: oldestDrafts.map(e => ({
                id: e.id,
                patientId: e.patientId,
                patientName: e.patient?.name ?? '(desconocido)',
                createdAt: e.createdAt.toISOString(),
                createdByName: e.createdBy?.name ?? null,
            })),
        },
    });
}
