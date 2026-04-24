import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// FASE 12: Vivid Senior Living Partners Dashboard KPI Aggregator
// Seguridad: getServerSession en lugar de userId por query param.
// INVESTOR → ve todas las sedes del grupo.
// DIRECTOR → ve solo su propia sede.
const ALLOWED_ROLES = ['INVESTOR', 'ADMIN', 'DIRECTOR', 'SUPER_ADMIN'];

export async function GET(_req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const role = (session.user as any).role as string;
        const hqId = (session.user as any).headquartersId as string;

        if (!ALLOWED_ROLES.includes(role)) {
            return NextResponse.json({ error: 'Acceso exclusivo para inversores y administradores.' }, { status: 403 });
        }

        // INVESTOR / ADMIN / SUPER_ADMIN → todas las sedes activas del grupo
        // DIRECTOR → solo su sede
        let targetHqs: any[] = [];

        if (role === 'DIRECTOR') {
            const hq = await prisma.headquarters.findUnique({ where: { id: hqId } });
            if (hq) targetHqs = [hq];
        } else {
            // INVESTOR, ADMIN, SUPER_ADMIN: todas las sedes activas
            targetHqs = await prisma.headquarters.findMany({
                where: { isActive: true },
                orderBy: { name: 'asc' },
            });
        }

        const kpisByHq = [];

        for (const hq of targetHqs) {
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

            // A) Ocupación
            const activePatients = await prisma.patient.count({
                where: { headquartersId: hq.id, status: 'ACTIVE' },
            });
            const capacity = (hq as any).capacity ?? 1;
            const occupancyRate = capacity > 0 ? (activePatients / capacity) * 100 : 0;

            // B) Ingresos MTD — facturas PAID emitidas en el mes actual
            const invoices = await prisma.invoice.findMany({
                where: {
                    headquartersId: hq.id,
                    status: 'PAID',
                    issueDate: { gte: startOfMonth },
                },
            });
            const monthlyRevenue = invoices.reduce((acc: number, inv: any) => acc + inv.totalAmount, 0);

            // C) Índice Clínico Laboral — promedio complianceScore staff clínico
            const clinicalStaff = await prisma.user.findMany({
                where: {
                    headquartersId: hq.id,
                    role: { in: ['CAREGIVER', 'NURSE', 'SUPERVISOR'] as any[] },
                    isDeleted: false,
                    isActive: true,
                },
                select: { complianceScore: true },
            });
            const avgCompliance = clinicalStaff.length > 0
                ? clinicalStaff.reduce((acc: number, e: any) => acc + e.complianceScore, 0) / clinicalStaff.length
                : 0;

            kpisByHq.push({
                hqId: hq.id,
                name: hq.name,
                capacity,
                logoUrl: (hq as any).logoUrl ?? null,
                isOpen: (hq as any).isActive ?? true,
                occupancyRate: Math.round(occupancyRate),
                monthlyRevenue,
                clinicalComplianceRate: Math.round(avgCompliance),
                activePatients,
                staffCount: clinicalStaff.length,
            });
        }

        return NextResponse.json({ success: true, targets: kpisByHq });

    } catch (error) {
        console.error('Error aggregating Investor KPIs:', error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
