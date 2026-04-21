import { NextResponse } from "next/server";
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['SUPERVISOR', 'DIRECTOR', 'ADMIN'];

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }
        if (!ALLOWED_ROLES.includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: 'Rol no autorizado' }, { status: 403 });
        }
        const invokerHqId = (session.user as any).headquartersId;

        const resolvedParams = await params;
        const staffId = resolvedParams.id;

        // Tenant check preview: el empleado debe estar en la sede del invocador
        const staffCheck = await prisma.user.findUnique({
            where: { id: staffId },
            select: { headquartersId: true },
        });
        if (!staffCheck || staffCheck.headquartersId !== invokerHqId) {
            return NextResponse.json({ success: false, error: 'Empleado fuera de tu sede' }, { status: 403 });
        }

        const staff = await prisma.user.findUnique({
            where: { id: staffId },
            include: {
                headquarters: true,
                evalsReceived: {
                    include: { evaluator: true },
                    orderBy: { createdAt: 'desc' }
                },
                courseEnrolls: {
                    include: { course: true }
                },
                // Fetch recent administration compliance info if they are medical staff
                administeredMeds: {
                    take: 50,
                    orderBy: { administeredAt: 'desc' },
                    include: {
                        patientMedication: {
                            include: { medication: true, patient: true }
                        }
                    }
                },
                // Fetch HR Incident Reports (Disciplinarios)
                incidentsEmployee: {
                    include: { supervisor: { select: { name: true, role: true } } },
                    orderBy: { createdAt: 'desc' }
                }
            }
        });

        if (!staff) {
            return NextResponse.json({ success: false, error: "Staff not found" }, { status: 404 });
        }

        // Calculate Average Performance
        const evaluationScores = staff.evalsReceived.map(e => e.score);
        const avgEvalScore = evaluationScores.length > 0
            ? Math.round(evaluationScores.reduce((a, b) => a + b, 0) / evaluationScores.length)
            : null;

        const complianceScore = staff.complianceScore || 0;
        const finalScore = avgEvalScore !== null
            ? Math.round((avgEvalScore + complianceScore) / 2)
            : complianceScore;

        // EMAR Admin Stats (Medicamentos administrados exitosamente vs Omitidos)
        let medsGiven = 0;
        let medsMissed = 0;
        staff.administeredMeds.forEach(admin => {
            if (admin.status === 'ADMINISTERED') medsGiven++;
            else medsMissed++;
        });

        const emarCompliance = staff.administeredMeds.length > 0
            ? Math.round((medsGiven / staff.administeredMeds.length) * 100)
            : null;

        return NextResponse.json({
            success: true,
            staff: {
                id: staff.id,
                name: staff.name,
                email: staff.email,
                role: staff.role,
                isActive: staff.isActive,
                isShiftBlocked: staff.isShiftBlocked,
                blockReason: staff.blockReason,
                photoUrl: staff.photoUrl,
                facility: staff.headquarters.name,
                performanceScore: finalScore,
                complianceScore: complianceScore,
                avgEvalScore: avgEvalScore,
                evaluationsCount: staff.evalsReceived.length,

                // Detailed Arrays
                evalsReceived: staff.evalsReceived,
                courseEnrolls: staff.courseEnrolls,
                incidents: staff.incidentsEmployee,

                // EMAR Clinical Metrics
                emarCompliance: emarCompliance,
                medsGivenRecord: medsGiven,
                medsMissedRecord: medsMissed
            }
        });

    } catch (error) {
        console.error("Staff Fetch Error:", error);
        return NextResponse.json({ success: false, error: "Failed to fetch staff profile" }, { status: 500 });
    }
}
