import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const hqId = searchParams.get('hqId');
    const weekStart = searchParams.get('weekStart');

    if (!hqId) return NextResponse.json({ success: false, error: 'hqId requerido' }, { status: 400 });

    try {
        const where: any = { headquartersId: hqId };
        if (weekStart) where.weekStartDate = new Date(weekStart);

        const schedules = await prisma.schedule.findMany({
            where,
            include: {
                shifts: {
                    include: {
                        user: { select: { id: true, name: true, role: true } },
                        colorAssignments: true
                    },
                    orderBy: [{ date: 'asc' }, { shiftType: 'asc' }]
                }
            },
            orderBy: { weekStartDate: 'desc' },
            take: 4
        });

        return NextResponse.json({ success: true, schedules });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ success: false, error: 'Error cargando horarios' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const { hqId, weekStartDate, createdByUserId, shifts } = await req.json();

        const existing = await prisma.schedule.findFirst({
            where: { headquartersId: hqId, weekStartDate: new Date(weekStartDate) }
        });
        if (existing) {
            await prisma.scheduledShift.deleteMany({ where: { scheduleId: existing.id } });
            await prisma.schedule.delete({ where: { id: existing.id } });
        }

        const schedule = await prisma.schedule.create({
            data: {
                headquartersId: hqId,
                weekStartDate: new Date(weekStartDate),
                createdByUserId,
                status: 'DRAFT',
                shifts: {
                    create: shifts.map((s: any) => ({
                        userId: s.userId,
                        date: new Date(s.date),
                        shiftType: s.shiftType,
                        colorGroup: s.colorGroup || null,
                        notes: s.notes || null
                    }))
                }
            },
            include: { shifts: { include: { user: { select: { id: true, name: true, role: true } } } } }
        });

        return NextResponse.json({ success: true, schedule });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ success: false, error: 'Error creando horario' }, { status: 500 });
    }
}
