import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';

// Publicar/despublicar horarios es operación de gestión (Schedule Builder).
const MANAGE_ROLES = ['DIRECTOR', 'ADMIN', 'SUPERVISOR'];

export async function POST(req: Request) {
    try {
        const auth = await requireRole(MANAGE_ROLES);
        if (auth instanceof NextResponse) return auth;

        const { scheduleId } = await req.json();
        if (!scheduleId) {
            return NextResponse.json({ success: false, error: 'scheduleId requerido' }, { status: 400 });
        }

        // Ownership: el horario debe pertenecer a la sede del invocador (anti cross-tenant).
        const owned = await prisma.schedule.findFirst({
            where: { id: scheduleId, headquartersId: auth.headquartersId },
            select: { id: true },
        });
        if (!owned) {
            return NextResponse.json({ success: false, error: 'Horario no encontrado' }, { status: 404 });
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
