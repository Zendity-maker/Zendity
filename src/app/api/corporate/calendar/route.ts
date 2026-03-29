import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const hqId = session.user.headquartersId;

        const events = await prisma.headquartersEvent.findMany({
            where: { headquartersId: hqId },
            include: {
                patient: { select: { id: true, name: true } }
            },
            orderBy: { startTime: 'asc' }
        });

        return NextResponse.json({ success: true, events });
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        // Only higher ups can create events
        if (!session || !['DIRECTOR', 'ADMIN', 'SUPERVISOR', 'NURSE'].includes(session.user.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const hqId = session.user.headquartersId;
        const body = await request.json();
        const { title, description, type, startTime, endTime, patientId, targetPopulation, targetGroups, targetPatients } = body;

        if (!title || !startTime || !endTime) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const newEvent = await prisma.headquartersEvent.create({
            data: {
                headquartersId: hqId,
                title,
                description: description || null,
                type: type || 'OTHER',
                startTime: new Date(startTime),
                endTime: new Date(endTime),
                patientId: patientId || null,
                targetPopulation: targetPopulation || 'ALL',
                targetGroups: targetGroups || [],
                targetPatients: targetPatients || []
            },
            include: {
                patient: { select: { id: true, name: true } }
            }
        });

        return NextResponse.json({ success: true, event: newEvent }, { status: 201 });
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Failed to create event' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !['DIRECTOR', 'ADMIN', 'SUPERVISOR'].includes(session.user.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Missing ID' }, { status: 400 });
        }

        const deleted = await prisma.headquartersEvent.delete({
            where: { id }
        });

        return NextResponse.json({ success: true, event: deleted }, { status: 200 });
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Failed to delete event' }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

        const body = await request.json();
        const { status, dismissReason } = body;

        const updated = await prisma.headquartersEvent.update({
            where: { id },
            data: {
                status: status || undefined,
                ...(dismissReason ? { description: dismissReason } : {}),
            },
        });

        return NextResponse.json({ success: true, event: updated });
    } catch (error) {
        console.error('PATCH Error:', error);
        return NextResponse.json({ error: 'Failed to update event' }, { status: 500 });
    }
}
