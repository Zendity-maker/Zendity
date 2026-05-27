import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['CAREGIVER', 'NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN'];

/**
 * GET /api/care/fall-risk?patientId=X
 * Retorna:
 *  - patient: { id, name, downtonRisk }
 *  - fallIncidents: historial ordenado por fecha desc
 *  - riskAssessments: últimos 5 assessments
 *  - currentRiskLevel: del último assessment, o "LOW" si no hay
 */
export async function GET(req: Request) {
    try {
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;

        const invokerHqId = auth.headquartersId;
        const { searchParams } = new URL(req.url);
        const patientId = searchParams.get('patientId');
        if (!patientId) return NextResponse.json({ success: false, error: 'patientId requerido' }, { status: 400 });

        const patient = await prisma.patient.findFirst({
            where: { id: patientId, headquartersId: invokerHqId },
            select: { id: true, name: true, downtonRisk: true }
        });
        if (!patient) return NextResponse.json({ success: false, error: 'Residente no encontrado' }, { status: 404 });

        const [fallIncidents, riskAssessments] = await Promise.all([
            prisma.fallIncident.findMany({
                where: { patientId },
                orderBy: { incidentDate: 'desc' },
                take: 50,
            }),
            prisma.fallRiskAssessment.findMany({
                where: { patientId },
                orderBy: { evaluatedAt: 'desc' },
                take: 5,
                include: { evaluator: { select: { name: true, role: true } } },
            }),
        ]);

        const currentRiskLevel = riskAssessments[0]?.riskLevel || 'LOW';

        return NextResponse.json({
            success: true,
            patient,
            fallIncidents,
            riskAssessments,
            currentRiskLevel,
        });
    } catch (err: any) {
        console.error('[fall-risk GET]', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
