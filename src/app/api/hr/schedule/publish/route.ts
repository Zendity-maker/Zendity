import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
    try {
        const { scheduleId } = await req.json();
        const schedule = await prisma.schedule.update({
            where: { id: scheduleId },
            data: { status: 'PUBLISHED', publishedAt: new Date() }
        });
        return NextResponse.json({ success: true, schedule });
    } catch (e) {
        return NextResponse.json({ success: false, error: 'Error publicando horario' }, { status: 500 });
    }
}
