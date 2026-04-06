import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
    try {
        const { scheduleId } = await req.json();
        if (!scheduleId) {
            return NextResponse.json({ success: false, error: 'scheduleId requerido' }, { status: 400 });
        }
        const schedule = await prisma.schedule.update({
            where: { id: scheduleId },
            data: { status: 'DRAFT', publishedAt: null }
        });
        return NextResponse.json({ success: true, schedule });
    } catch (error) {
        console.error('Unpublish error:', error);
        return NextResponse.json({ success: false, error: 'Error editando horario' }, { status: 500 });
    }
}
