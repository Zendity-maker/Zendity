import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { logError } from '@/lib/logger';
import { clinicalDayCalendarUTCRange } from '@/lib/dates';
import { inferShiftTypeFromAST } from '@/lib/shift-coverage';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
    try {
        const auth = await requireRole(['DIRECTOR', 'ADMIN', 'SUPERVISOR']);
        if (auth instanceof NextResponse) return auth;
        const hqId = auth.headquartersId;
        const scheduledDayRange = clinicalDayCalendarUTCRange();

        // Traer Staff para armar los horarios
        const staff = await prisma.user.findMany({
            where: { headquartersId: hqId, role: { in: ['NURSE', 'CAREGIVER'] } },
            select: { id: true, name: true, role: true }
        });

        // Traer Horarios del turno activo actual (ScheduledShift publicado).
        // Fix: antes usaba new Date().getHours() — eso es UTC del servidor.
        // En Puerto Rico (UTC-4) entre 8pm-medianoche local, getHours()
        // retornaba 0-4 y marcaba MORNING/NIGHT incorrectamente.
        const activeShiftType = inferShiftTypeFromAST();

        const schedules = await prisma.scheduledShift.findMany({
            where: {
                date: { gte: scheduledDayRange.start, lt: scheduledDayRange.end },
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
        logError('care.supervisor.get', error);
        return NextResponse.json({ error: 'Failed to fetch supervisor data' }, { status: 500 });
    }
}

// Endpoints deprecados. Apuntaban al modelo `ShiftSchedule` que ya no existe.
// La gestión de turnos vive en el Schedule Builder: /hr/schedule (modelo ScheduledShift).
export async function POST() {
    return NextResponse.json(
        {
            success: false,
            error: 'Endpoint deprecado. Usa el Schedule Builder en /hr/schedule para crear turnos.',
        },
        { status: 410 }
    );
}

export async function DELETE() {
    return NextResponse.json(
        {
            success: false,
            error: 'Endpoint deprecado. Usa el Schedule Builder en /hr/schedule para eliminar turnos.',
        },
        { status: 410 }
    );
}
