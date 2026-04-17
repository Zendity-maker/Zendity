import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['CAREGIVER', 'NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN'];

/**
 * GET /api/care/fall-incident/[id]
 * Retorna un FallIncident con patient + headquarters + último FallRiskAssessment,
 * todo lo necesario para imprimir el Reporte de Incidente oficial.
 */
export async function GET(
    _req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });

        const role = (session.user as any).role;
        if (!ALLOWED_ROLES.includes(role)) {
            return NextResponse.json({ success: false, error: 'Rol no autorizado' }, { status: 403 });
        }

        const invokerHqId = (session.user as any).headquartersId;
        const { id } = await params;

        const incident = await prisma.fallIncident.findUnique({
            where: { id },
            include: {
                patient: {
                    select: {
                        id: true, name: true, roomNumber: true, dateOfBirth: true, photoUrl: true,
                        colorGroup: true, downtonRisk: true, headquartersId: true,
                        headquarters: { select: { name: true, logoUrl: true, phone: true, billingAddress: true } }
                    }
                }
            }
        });

        if (!incident) return NextResponse.json({ success: false, error: 'Incidente no encontrado' }, { status: 404 });

        // Tenant check
        if (incident.patient.headquartersId !== invokerHqId) {
            return NextResponse.json({ success: false, error: 'Incidente fuera de tu sede' }, { status: 403 });
        }

        // Último assessment vinculado (por patientId + fecha cercana)
        const lastAssessment = await prisma.fallRiskAssessment.findFirst({
            where: {
                patientId: incident.patientId,
                evaluatedAt: { gte: new Date(new Date(incident.incidentDate).getTime() - 60 * 60 * 1000) },
            },
            orderBy: { evaluatedAt: 'desc' },
            include: { evaluator: { select: { id: true, name: true, role: true } } },
        });

        return NextResponse.json({
            success: true,
            incident,
            riskAssessment: lastAssessment,
        });
    } catch (err: any) {
        console.error('[fall-incident GET]', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
