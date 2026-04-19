import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSuperAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/overview — KPIs del negocio Zéndity Corp.
 * Solo SUPER_ADMIN.
 */
export async function GET() {
    const guard = await requireSuperAdmin();
    if (!guard.ok) return guard.response;

    try {
        const [
            sedesActivas,
            sedesTotal,
            activeContracts,
            prospectos,
            cerrados,
            prospectosEnProceso,
            facturasVencidas,
        ] = await Promise.all([
            prisma.headquarters.count({ where: { isActive: true } }),
            prisma.headquarters.count(),
            prisma.saaSContract.findMany({
                where: { status: 'ACTIVE' },
                select: { monthlyAmount: true },
            }),
            prisma.saaSProspect.count(),
            prisma.saaSProspect.count({ where: { stage: 'CERRADO' } }),
            prisma.saaSProspect.count({
                where: { NOT: { stage: { in: ['PROSPECTO', 'CERRADO', 'PERDIDO'] } } },
            }),
            prisma.saaSInvoice.count({ where: { status: 'OVERDUE' } }),
        ]);

        const mrr = activeContracts.reduce((sum, c) => sum + (c.monthlyAmount || 0), 0);
        const arr = mrr * 12;
        const cuposFounder = Math.max(0, 20 - cerrados);

        return NextResponse.json({
            success: true,
            overview: {
                sedesActivas,
                sedesTotal,
                mrr,
                arr,
                prospectos,
                prospectosEnProceso,
                cerrados,
                facturasVencidas,
                cuposFounder,
            },
        });
    } catch (e: any) {
        console.error('[/api/admin/overview]', e);
        return NextResponse.json({ success: false, error: 'Error cargando overview' }, { status: 500 });
    }
}
