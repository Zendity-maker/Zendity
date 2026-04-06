import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { startOfDay, endOfDay } from 'date-fns';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !['DIRECTOR', 'ADMIN', 'SUPERVISOR'].includes(session.user.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const hqId = session.user.headquartersId;
        const todayStart = startOfDay(new Date());
        const todayEnd = endOfDay(new Date());

        // Traer Staff para armar los horarios
        const staff = await prisma.user.findMany({
            where: { headquartersId: hqId, role: { in: ['NURSE', 'CAREGIVER'] } },
            select: { id: true, name: true, role: true }
        });

        // Traer Horarios del turno activo actual (ScheduledShift publicado)
        const currentHour = new Date().getHours();
        const activeShiftType = currentHour >= 22 || currentHour < 6 ? 'NIGHT'
            : currentHour >= 14 ? 'EVENING' : 'MORNING';

        const schedules = await prisma.scheduledShift.findMany({
            where: {
                date: { gte: todayStart, lte: todayEnd },
                shiftType: activeShiftType,
                isAbsent: false,
                schedule: { status: 'PUBLISHED' }
            },
            include: {
                user: { select: { id: true, name: true, role: true } },
                schedule: { select: { headquartersId: true } }
            }
        });

        return NextResponse.json({ success: true, staff, schedules });

    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Failed to fetch supervisor data' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !['DIRECTOR', 'ADMIN', 'SUPERVISOR'].includes(session.user.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const hqId = session.user.headquartersId;
        const body = await request.json();
        const { employeeId, startTime, endTime } = body;

        const newShift = await prisma.shiftSchedule.create({
            data: {
                headquartersId: hqId,
                employeeId,
                startTime: new Date(startTime),
                endTime: new Date(endTime)
            },
            include: { employee: { select: { name: true, role: true } } }
        });

        return NextResponse.json({ success: true, schedule: newShift }, { status: 201 });
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Failed to create shift' }, { status: 500 });
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

        await prisma.shiftSchedule.delete({ where: { id } });
        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Failed to delete shift' }, { status: 500 });
    }
}
