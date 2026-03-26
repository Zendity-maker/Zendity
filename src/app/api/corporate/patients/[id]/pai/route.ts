import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';



export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const resolvedParams = await params;
        const patientId = resolvedParams.id;
        if (!patientId) return NextResponse.json({ success: false, error: 'Patient ID missing' }, { status: 400 });

        const lifePlan = await prisma.lifePlan.findUnique({
            where: { patientId }
        });

        // Even if empty, return success to let frontend know it's a blank draft
        return NextResponse.json({ success: true, lifePlan });
    } catch (error) {
        console.error("GET PAI Error:", error);
        return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
    }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const resolvedParams = await params;
        const patientId = resolvedParams.id;
        const body = await req.json();

        if (!patientId) return NextResponse.json({ success: false, error: 'Patient ID missing' }, { status: 400 });

        const {
            supportSource, clinicalSummary, continence, cognitiveLevel, mobility, dietDetails,
            risks, interdisciplinarySummary, goals, familyEducation, preferences,
            monitoringMethod, revisionCriteria, recommendedServices, signedById, status,
            startDate, nextReview
        } = body;

        const updatedLifePlan = await prisma.lifePlan.upsert({
            where: { patientId },
            update: {
                supportSource, clinicalSummary, continence, cognitiveLevel, mobility, dietDetails,
                risks, interdisciplinarySummary, goals, familyEducation, preferences,
                monitoringMethod, revisionCriteria, recommendedServices, signedById, 
                signedAt: signedById ? new Date() : null,
                status: status || 'DRAFT',
                startDate: startDate ? new Date(startDate) : null,
                nextReview: nextReview ? new Date(nextReview) : null
            },
            create: {
                patientId,
                supportSource, clinicalSummary, continence, cognitiveLevel, mobility, dietDetails,
                risks, interdisciplinarySummary, goals, familyEducation, preferences,
                monitoringMethod, revisionCriteria, recommendedServices, signedById,
                signedAt: signedById ? new Date() : null,
                status: status || 'DRAFT',
                startDate: startDate ? new Date(startDate) : null,
                nextReview: nextReview ? new Date(nextReview) : null
            }
        });

        return NextResponse.json({ success: true, lifePlan: updatedLifePlan });
    } catch (error) {
        console.error("UPSERT PAI Error:", error);
        return NextResponse.json({ success: false, error: 'Fallo al guardar el Plan Asistencial' }, { status: 500 });
    }
}
