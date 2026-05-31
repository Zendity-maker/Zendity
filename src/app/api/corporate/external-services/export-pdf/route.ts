import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { logError } from '@/lib/logger';
import { generateExternalServicesPDF, type ExternalVisitRow } from '@/lib/external-services-pdf';

export const dynamic = 'force-dynamic';

const MONTHS_ES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/**
 * GET /api/corporate/external-services/export-pdf?month=YYYY-MM
 *
 * Genera y devuelve el PDF mensual de visitas externas PUBLISHED.
 * Por defecto, mes en curso. El director descarga 1-click desde el dashboard.
 *
 * Response: application/pdf con Content-Disposition: attachment.
 */
export async function GET(req: Request) {
    try {
        const auth = await requireRole(['DIRECTOR', 'ADMIN']);
        if (auth instanceof NextResponse) return auth;
        const hqId = auth.headquartersId;

        const { searchParams } = new URL(req.url);
        const monthParam = searchParams.get('month'); // YYYY-MM
        const now = new Date();
        let year = now.getFullYear();
        let month = now.getMonth(); // 0-11
        if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
            const [y, m] = monthParam.split('-').map(Number);
            year = y;
            month = m - 1;
        }
        const from = new Date(year, month, 1);
        const to = new Date(year, month + 1, 1);

        const hq = await prisma.headquarters.findUnique({ where: { id: hqId }, select: { name: true } });

        const visits = await prisma.externalServiceVisit.findMany({
            where: {
                headquartersId: hqId,
                status: 'PUBLISHED',
                registeredAt: { gte: from, lt: to },
            },
            orderBy: { registeredAt: 'asc' },
            include: {
                provider: { include: { category: true } },
                patientVisits: { include: { patient: { select: { name: true, roomNumber: true } } } },
                reviewedBy: { select: { name: true } },
            },
        });

        const autoPublishedCount = visits.filter(v => v.autoPublished).length;

        const rows: ExternalVisitRow[] = visits.map(v => ({
            registeredAt: v.registeredAt,
            providerName: v.provider.name,
            categoryName: v.provider.category.name,
            categoryIcon: v.provider.category.icon,
            serviceType: v.serviceType,
            comment: v.comment,
            isFacilityWide: v.isFacilityWide,
            patients: v.patientVisits.map(pv => ({
                name: pv.patient.name,
                roomNumber: pv.patient.roomNumber,
            })),
            reviewedByName: v.reviewedBy?.name || null,
            autoPublished: v.autoPublished,
        }));

        const monthLabel = `${MONTHS_ES[month]} ${year}`;
        const pdfBuffer = generateExternalServicesPDF({
            hqName: hq?.name || 'Sede',
            monthLabel,
            totalPublished: visits.length,
            autoPublishedCount,
            visits: rows,
        });

        const filename = `Visitas_Externas_${monthLabel.replace(/ /g, '_')}.pdf`;
        return new NextResponse(pdfBuffer as any, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Cache-Control': 'no-store',
            },
        });
    } catch (err: any) {
        logError('corporate.external-services.export-pdf', err);
        return NextResponse.json({ success: false, error: 'Error generando PDF' }, { status: 500 });
    }
}
