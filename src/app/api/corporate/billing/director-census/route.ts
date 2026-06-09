import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { withPhiAccessLog } from '@/lib/phi-audit';
import { generateDirectorCensusPDF, DirectorCensusRow } from '@/lib/director-census-pdf';

/**
 * GET /api/corporate/billing/director-census
 *
 * Devuelve el Censo Financiero del Director como PDF descargable
 * (Content-Type: application/pdf, Content-Disposition: attachment).
 *
 * Acceso: ESTRICTAMENTE DIRECTOR. Ni ADMIN ni SUPERVISOR.
 *
 * Audit: cada descarga escribe PhiAccessLog (READ, resourceType=
 * DirectorFinancialCensus). El header del PDF lo cita.
 *
 * Multi-tenant: residentes del headquartersId del invocador (session-side).
 * Excluye DISCHARGED/DECEASED.
 */

const ALLOWED_ROLES = ['DIRECTOR'];

export const dynamic = 'force-dynamic';

// Casos especiales hardcoded por patient id — etiquetas inline en el PDF
// para que el Director recuerde el contexto. Mantener acoplado al backfill
// de monthly fees (sesión 9-jun-2026).
const SPECIAL_NOTES: Record<string, string> = {
    'a6308ad7-242a-4ac2-93d8-56fde83a3b06': '$900 + $1,050 multi-cuenta',
    '1cdac219-06a7-4e32-96d2-1991f1da2c9d': 'Sin asignar todavía',
};

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
            select: { name: true, brandName: true, phone: true, billingAddress: true },
        }),
        prisma.patient.findMany({
            where: { headquartersId: hqId, status: { in: ['ACTIVE', 'TEMPORARY_LEAVE'] } },
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

    const withFee = residents.filter(r => r.monthlyFee > 0);
    const totalMonthly = withFee.reduce((sum, r) => sum + r.monthlyFee, 0);
    const averageMonthly = withFee.length > 0 ? totalMonthly / withFee.length : 0;

    const rows: DirectorCensusRow[] = residents.map(r => ({
        name: r.name,
        roomNumber: r.roomNumber,
        status: r.status,
        monthlyFee: r.monthlyFee,
        createdAt: r.createdAt,
        specialNote: SPECIAL_NOTES[r.id],
    }));

    const pdfBuffer = generateDirectorCensusPDF({
        hqName: hq.name,
        brandName: hq.brandName,
        billingAddress: hq.billingAddress,
        phone: hq.phone,
        residents: rows,
        summary: {
            totalCount: residents.length,
            countWithFee: withFee.length,
            countWithoutFee: residents.length - withFee.length,
            totalMonthly,
            averageMonthly,
            estimatedAnnual: totalMonthly * 12,
        },
        generatedAt: new Date(),
    });

    // Filename: Censo_Director_Vivid_Senior_Living_Cupey_2026-06-09.pdf
    const fileDate = new Date().toISOString().slice(0, 10);
    const safeName = (hq.brandName || hq.name).replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `Censo_Director_${safeName}_${fileDate}.pdf`;

    return new NextResponse(pdfBuffer as any, {
        status: 200,
        headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Cache-Control': 'no-store',
        },
    });
}
