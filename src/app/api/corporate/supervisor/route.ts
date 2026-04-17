import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { todayStartAST } from '@/lib/dates';

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !['DIRECTOR', 'ADMIN', 'SUPERVISOR'].includes(session.user.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const hqId = session.user.headquartersId;
        const todayStart = todayStartAST();
        const todayEnd = new Date();

        // Traer Staff para armar los horarios
        const staff = await prisma.user.findMany({
            where: { headquartersId: hqId, role: { in: ['NURSE', 'CAREGIVER'] } },
            select: { id: true, name: true, role: true }
        });

        // Traer Horarios de Hoy y Futuros
        const schedules = await prisma.shiftSchedule.findMany({
            where: { headquartersId: hqId, startTime: { gte: todayStart } },
            include: { employee: { select: { name: true, role: true } } },
            orderBy: { startTime: 'asc' }
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
