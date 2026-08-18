import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSuperAdmin } from '@/lib/admin-auth';
import { calculateMonthlyFee } from '@/lib/entitlements';

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
                select: {
                    monthlyAmount: true,
                    beds: true,
                    headquarters: { select: { name: true, capacity: true } },
                },
            }),
            prisma.saaSProspect.count(),
            prisma.saaSProspect.count({ where: { stage: 'CERRADO' } }),
            prisma.saaSProspect.count({
                where: { NOT: { stage: { in: ['PROSPECTO', 'CERRADO', 'PERDIDO'] } } },
            }),
            prisma.saaSInvoice.count({ where: { status: 'OVERDUE' } }),
        ]);

        // MRR = lo que REALMENTE se factura (suma de contratos). No se calcula
        // de la capacidad: un contrato puede tener precio fundador o un acuerdo
        // especial, y sustituirlo por el cálculo teórico reportaría ingresos
        // que no existen.
        const mrr = activeContracts.reduce((sum, c) => sum + (c.monthlyAmount || 0), 0);
        const arr = mrr * 12;

        // Contratos cuyas camas no coinciden con la capacidad autorizada de la
        // sede. Desde el modelo de tarifa por cama, ese desfase es dinero mal
        // facturado — en cualquiera de las dos direcciones. Se expone en vez de
        // esconderse detrás de un MRR que parece correcto.
        const contratosDesalineados = activeContracts
            .filter(c => c.headquarters && c.beds !== c.headquarters.capacity)
            .map(c => ({
                sede: c.headquarters!.name,
                camasContrato: c.beds,
                camasAutorizadas: c.headquarters!.capacity,
                facturaActual: c.monthlyAmount,
                facturaSegunModelo: calculateMonthlyFee(c.headquarters!.capacity),
            }));
        const mrrSegunModelo = activeContracts.reduce(
            (sum, c) => sum + (c.headquarters ? calculateMonthlyFee(c.headquarters.capacity) : c.monthlyAmount || 0), 0
        );
        const cuposFounder = Math.max(0, 20 - cerrados);

        return NextResponse.json({
            success: true,
            overview: {
                sedesActivas,
                sedesTotal,
                mrr,
                arr,
                mrrSegunModelo,
                contratosDesalineados,
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
