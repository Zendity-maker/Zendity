import { NextResponse } from "next/server";
import { prisma } from '@/lib/prisma';



export async function GET() {
    try {
        const staffList = await prisma.user.findMany({
            where: {
                isDeleted: false,
                role: {
                    in: ['ADMIN', 'DIRECTOR', 'SUPERVISOR', 'NURSE', 'CAREGIVER', 'SOCIAL_WORKER', 'KITCHEN', 'MAINTENANCE']
                }
            },
            include: {
                headquarters: true,
                evalsReceived: true,
            },
            orderBy: [
                { headquarters: { name: 'asc' } },
                { role: 'asc' },
                { name: 'asc' }
            ]
        });

        const formattedStaff = staffList.map(user => {
            const evaluationScores = user.evalsReceived.map(e => e.score);
            const avgEvalScore = evaluationScores.length > 0
                ? Math.round(evaluationScores.reduce((a, b) => a + b, 0) / evaluationScores.length)
                : null; // null si no tiene todavía evaluaciones

            const complianceScore = user.complianceScore || 0;

            // Combine compliance score from Zendi Academy with Clinical Evaluation Score for a Unified performance Grade
            const finalScore = avgEvalScore !== null
                ? Math.round((avgEvalScore + complianceScore) / 2)
                : complianceScore;

            return {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                isActive: user.isActive,
                isShiftBlocked: user.isShiftBlocked,
                photoUrl: user.photoUrl,
                facility: user.headquarters.name,
                evaluationsCount: user.evalsReceived.length,
                performanceScore: finalScore,
                complianceScore: complianceScore,
                avgEvalScore: avgEvalScore
            };
        });

        // Get unique facilities for the frontend filter select
        const uniqueFacilities = Array.from(new Set(staffList.map(s => s.headquarters.name)));

        return NextResponse.json({
            success: true,
            staff: formattedStaff,
            facilities: uniqueFacilities
        });

    } catch (error) {
        console.error("Corporate HR Fetch Error:", error);
        return NextResponse.json({ success: false, error: "Failed to fetch staff data" }, { status: 500 });
    }
}
