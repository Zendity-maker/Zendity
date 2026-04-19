import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const HR_ROLES = ['SUPERVISOR', 'DIRECTOR', 'ADMIN'];

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }
        const invokerId = (session.user as any).id;
        const invokerRole = (session.user as any).role;
        const hqId = (session.user as any).headquartersId;

        const incident = await prisma.incidentReport.findUnique({
            where: { id },
            include: {
                employee: { select: { id: true, name: true, role: true, email: true, complianceScore: true } },
                supervisor: { select: { id: true, name: true, role: true } },
                hq: { select: { id: true, name: true } }
            }
        });

        if (!incident) {
            return NextResponse.json({ success: false, error: 'Observación no encontrada' }, { status: 404 });
        }

        // Tenant check
        if (incident.headquartersId !== hqId) {
            return NextResponse.json({ success: false, error: 'Tenant mismatch' }, { status: 403 });
        }

        const isHr = HR_ROLES.includes(invokerRole);
        const isOwnEmployee = incident.employeeId === invokerId;

        // Empleado sólo puede ver si está marcado visible
        if (!isHr && !(isOwnEmployee && incident.visibleToEmployee)) {
            return NextResponse.json({ success: false, error: 'No tienes permiso para ver esta observación' }, { status: 403 });
        }

        return NextResponse.json({ success: true, incident });
    } catch (error: any) {
        console.error("Error fetching HR incident:", error);
        return NextResponse.json({ success: false, error: error.message || String(error) }, { status: 500 });
    }
}
