import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { withPhiAccessLog } from '@/lib/phi-audit';

/**
 * GET /api/corporate/billing/director-census
 *
 * Censo financiero para el Director — lista de residentes activos +
 * hospitalizados (TEMPORARY_LEAVE) con su tarifa mensual y fecha de
 * admisión en sistema (Patient.createdAt).
 *
 * Acceso: ESTRICTAMENTE DIRECTOR. Ni ADMIN ni SUPERVISOR — esta es la vista
 * privada del Director sobre las tarifas, no es accesible a otros roles.
 *
 * Audit: cada lectura escribe PhiAccessLog (READ, resourceType=DirectorFinancialCensus).
 *
 * Multi-tenant: filtra por headquartersId del invocador (session-side).
 *
 * Excluye DISCHARGED/DECEASED — no aplican operativamente al censo diario.
 */

const ALLOWED_ROLES = ['DIRECTOR'];

export const GET = withPhiAccessLog(getDirectorCensusHandler, {
    resourceType: 'DirectorFinancialCensus',
});

async function getDirectorCensusHandler(_req: Request) {
    const auth = await requireRole(ALLOWED_ROLES);
    if (auth instanceof NextResponse) return auth;

    const hqId = auth.headquartersId;

    const [hq, residents] = await Promise.all([
        prisma.headquarters.findUnique({
            where: { id: hqId },
            select: {
                name: true, logoUrl: true, phone: true, billingAddress: true,
                brandName: true, brandPrimary: true,
            },
        }),
        prisma.patient.findMany({
            where: {
                headquartersId: hqId,
                status: { in: ['ACTIVE', 'TEMPORARY_LEAVE'] },
            },
            select: {
                id: true, name: true, roomNumber: true, status: true,
                monthlyFee: true, createdAt: true,
            },
            orderBy: { name: 'asc' },
        }),
    ]);

    if (!hq) {
        return NextResponse.json({ success: false, error: 'Sede no encontrada' }, { status: 404 });
    }

    // Totales (solo cuenta residentes con tarifa > 0; los Sin asignar y Laboy
    // multi-cuenta no entran en el promedio para no sesgarlo).
    const withFee = residents.filter(r => r.monthlyFee > 0);
    const totalMonthly = withFee.reduce((sum, r) => sum + r.monthlyFee, 0);
    const averageMonthly = withFee.length > 0 ? totalMonthly / withFee.length : 0;

    return NextResponse.json({
        success: true,
        hq: {
            name: hq.name,
            logoUrl: hq.logoUrl,
            phone: hq.phone,
            billingAddress: hq.billingAddress,
            brandName: hq.brandName,
            brandPrimary: hq.brandPrimary,
        },
        residents,
        summary: {
            totalCount: residents.length,
            countWithFee: withFee.length,
            countWithoutFee: residents.length - withFee.length,
            totalMonthly,
            averageMonthly,
            estimatedAnnual: totalMonthly * 12,
        },
        generatedAt: new Date().toISOString(),
    });
}
