import { NextResponse } from "next/server";
import { prisma } from '@/lib/prisma';



export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const patientId = searchParams.get('patientId');

        if (!patientId) {
            return NextResponse.json({ success: false, error: "PatientID required." }, { status: 400 });
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
