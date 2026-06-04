import { NextResponse } from "next/server";
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';

const ALLOWED_ROLES = ['CAREGIVER', 'NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN'];

export async function GET(req: Request) {
    try {
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;

        const { searchParams } = new URL(req.url);
        const patientId = searchParams.get('patientId');

        if (!patientId) {
            return NextResponse.json({ success: false, error: "PatientID required." }, { status: 400 });
        }

        // Tenant check HIPAA — solo residentes de tu sede
        const owner = await prisma.patient.findUnique({ where: { id: patientId }, select: { headquartersId: true } });
        if (!owner || owner.headquartersId !== auth.headquartersId) {
            return NextResponse.json({ success: false, error: "Residente fuera de tu sede" }, { status: 403 });
        }

        // Fetch the absolute last Night Round (whether sleeping, awake, anomaly)
        const lastRound = await prisma.dailyLog.findFirst({
            where: {
                patientId,
                notes: { contains: '[RONDA NOCTURNA]' }
            },
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true }
        });

        if (!lastRound) {
            return NextResponse.json({ success: true, minutesSinceLastRound: 9999 }); // Safe to proceed
        }

        const now = new Date();
        const diffInMs = now.getTime() - lastRound.createdAt.getTime();
        const minutesSinceLastRound = Math.floor(diffInMs / 60000);

        return NextResponse.json({ success: true, minutesSinceLastRound });
    } catch (e: any) {
        console.error("Error checking round:", e);
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
