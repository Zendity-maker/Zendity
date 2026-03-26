import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';



// FASE 12: Vivid Senior Living Partners Dashboard KPI Aggregator
export async function GET(req: Request) {
    try {
        // Authenticate the user - For the API we would normally use NextAuth (getServerSession)
        // Since this is a server route invoked by a client component, we'll verify via the user role 
        // sent in headers or rely on the frontend to pass the user id. 
        // For security, an Investor OR Admin can see this.
        const { searchParams } = new URL(req.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json({ error: "Missing authentication" }, { status: 401 });
        }

        const user = await prisma.user.findUnique({ where: { id: userId } });
        // @ts-ignore: Next.js cached Prisma Client hasn't loaded 'INVESTOR' role yet
        if (!user || (user.role !== 'INVESTOR' && user.role !== 'ADMIN')) {
            return NextResponse.json({ error: "Unauthorized Access. Partners Only." }, { status: 403 });
        }

        // 1. Fetch the target Headquarters (Cupey and Mayaguez)
        const cupey = await prisma.headquarters.findFirst({
            where: { name: { contains: "Cupey", mode: 'insensitive' } }
        });
        const mayaguez = await prisma.headquarters.findFirst({
            where: { name: { contains: "Mayaguez", mode: 'insensitive' } }
        });

        const targetHqs = [cupey, mayaguez].filter(hq => hq !== null);
        const kpisByHq = [];

        for (const hq of targetHqs) {
            if (!hq) continue;

            // --- A) Occupancy (Ocupación) ---
            const activePatients = await prisma.patient.count({
                where: {
                    headquartersId: hq.id,
                    status: 'ACTIVE'
                }
            });
            // @ts-ignore: Next.js cached Prisma Client hasn't loaded capacity yet
            const occupancyRate = hq.capacity > 0 ? (activePatients / hq.capacity) * 100 : 0;

            // --- B) Monthly Revenue (Ingresos del Mes) ---
            // Calculate current month's start and end dates
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const invoices = await prisma.invoice.findMany({
                where: {
                    headquartersId: hq.id,
                    status: 'PAID',
                    createdAt: { gte: startOfMonth }
                }
            });
            const monthlyRevenue = invoices.reduce((acc, inv) => acc + inv.totalAmount, 0);

            // --- C) Clinical Compliance (Cumplimiento Clínico) ---
            // Average compliance score of CAREGIVER and NURSE staff
            const clinicalStaff = await prisma.user.findMany({
                where: {
                    headquartersId: hq.id,
                    role: { in: ['CAREGIVER', 'NURSE', 'SUPERVISOR'] },
                    isDeleted: false
                }
            });
            const totalCompliance = clinicalStaff.reduce((acc, emp) => acc + emp.complianceScore, 0);
            const clinicalComplianceRate = clinicalStaff.length > 0 ? (totalCompliance / clinicalStaff.length) : 0;

            // --- Package the KPI Object ---
            kpisByHq.push({
                hqId: hq.id,
                name: hq.name,
                // @ts-ignore
                capacity: hq.capacity,
                // @ts-ignore
                logoUrl: hq.logoUrl,
                // @ts-ignore
                isOpen: hq.isActive,
                occupancyRate: Math.round(occupancyRate),
                monthlyRevenue: monthlyRevenue,
                clinicalComplianceRate: Math.round(clinicalComplianceRate),
                activePatients: activePatients,
                staffCount: clinicalStaff.length
            });
        }

        return NextResponse.json({ success: true, targets: kpisByHq });

    } catch (error) {
        console.error("Error aggregating Investor KPIs:", error);
        return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
    }
}
