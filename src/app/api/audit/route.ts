import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET: Fetch all incidents (pending signatures & history)
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const hqId = searchParams.get('hqId');

        if (!hqId) {
            return NextResponse.json({ error: 'hqId is required' }, { status: 400 });
        }

        const incidents = await prisma.incident.findMany({
            where: {
                headquartersId: hqId
            },
            include: {
                patient: true,
            },
            orderBy: {
                reportedAt: 'desc'
            }
        });

        return NextResponse.json({ success: true, data: incidents });
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ success: false, error: 'Failed to fetch incidents' }, { status: 500 });
    }
}

// POST: Create a new incident (requires signature later or immediately)
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { hqId, patientId, type, severity, description, biometricSignature } = body;

        const incident = await prisma.incident.create({
            data: {
                headquartersId: hqId,
                patientId,
                type,
                severity,
                description,
                biometricSignature,
            }
        });

        return NextResponse.json({ success: true, incident }, { status: 201 });
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ success: false, error: 'Failed to record incident' }, { status: 500 });
    }
}
