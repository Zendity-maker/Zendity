import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user || !['ADMIN', 'DIRECTOR', 'HR', 'NURSE'].includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const hqId = (session.user as any).headquartersId;
        const { searchParams } = new URL(request.url);

        // Optional filters
        const startDateParam = searchParams.get('startDate');
        const endDateParam = searchParams.get('endDate');

        let dateFilter = {};
        if (startDateParam && endDateParam) {
            dateFilter = {
                startTime: { gte: new Date(startDateParam) },
                endTime: { lte: new Date(endDateParam) }
            };
        }

        const shifts = await prisma.shiftSchedule.findMany({
            where: {
                headquartersId: hqId,
                ...dateFilter
            },
            include: {
                employee: {
                    select: { id: true, name: true, role: true }
                }
            },
            orderBy: { startTime: 'asc' }
        });

        return NextResponse.json({ success: true, shifts });
    } catch (error) {
        console.error("GET Shifts Error:", error);
        return NextResponse.json({ success: false, error: 'Failed to fetch shifts' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user || !['ADMIN', 'DIRECTOR', 'HR', 'NURSE'].includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const hqId = (session.user as any).headquartersId;
        const body = await request.json();

        const { employeeId, startTime, endTime, zoneColor } = body;

        if (!employeeId || !startTime || !endTime) {
            return NextResponse.json({ success: false, error: 'Faltan datos requeridos.' }, { status: 400 });
        }

        // Validate dates
        const start = new Date(startTime);
        const end = new Date(endTime);

        if (start >= end) {
            return NextResponse.json({ success: false, error: 'La hora de inicio no puede ser posterior a la de fin.' }, { status: 400 });
        }

        // Very basic overlap check
        const overlappingCount = await prisma.shiftSchedule.count({
            where: {
                employeeId,
                headquartersId: hqId,
                OR: [
                    { startTime: { lt: end }, endTime: { gt: start } }
                ]
            }
        });

        if (overlappingCount > 0) {
            return NextResponse.json({ success: false, error: 'El empleado ya tiene un turno en este horario.' }, { status: 400 });
        }

        const newShift = await prisma.shiftSchedule.create({
            data: {
                headquartersId: hqId,
                employeeId,
                startTime: start,
                endTime: end,
                zoneColor: zoneColor || null
            },
            include: {
                employee: { select: { id: true, name: true, role: true } }
            }
        });

        console.log("SUCCESS NEW SHIFT:", newShift);
        return NextResponse.json({ success: true, shift: newShift });
    } catch (error) {
        console.error("POST Shift Error:", error);
        console.error("Payload was:", body);
        return NextResponse.json({ success: false, error: 'Failed to create shift' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        const userRole = (session?.user as any)?.role;
        if (!session || !session.user || !['ADMIN', 'DIRECTOR', 'HR', 'NURSE'].includes(userRole)) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        const hqId = (session.user as any).headquartersId;

        if (!id) {
            return NextResponse.json({ success: false, error: 'Missing Shift ID' }, { status: 400 });
        }

        // Verify the shift belongs to this HQ
        const existing = await prisma.shiftSchedule.findUnique({ where: { id } });
        if (!existing || existing.headquartersId !== hqId) {
            return NextResponse.json({ success: false, error: 'Shift not found or unauthorized' }, { status: 404 });
        }

        await prisma.shiftSchedule.delete({ where: { id } });

        return NextResponse.json({ success: true, message: 'Shift deleted' });
    } catch (error) {
        console.error("DELETE Shift Error:", error);
        return NextResponse.json({ success: false, error: 'Failed to delete shift' }, { status: 500 });
    }
}
