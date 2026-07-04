import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';

// Inscribir empleados a cursos es acción de gestión.
const ENROLL_ROLES = ['DIRECTOR', 'ADMIN', 'SUPERVISOR'];

export async function POST(request: Request) {
    try {
        const auth = await requireRole(ENROLL_ROLES);
        if (auth instanceof NextResponse) return auth;

        const body = await request.json();
        const { userId, courseId } = body;

        // Ownership: el empleado a inscribir debe pertenecer a la sede del gestor.
        const target = await prisma.user.findFirst({
            where: { id: userId, headquartersId: auth.headquartersId },
            select: { id: true, headquartersId: true }
        });
        if (!target) {
            return NextResponse.json({ success: false, error: 'Empleado no encontrado' }, { status: 404 });
        }

        // Check if enrollment already exists
        const existing = await prisma.userCourse.findFirst({
            where: { employeeId: userId, courseId }
        });

        if (existing) {
            // Update to IN_PROGRESS
            const updated = await prisma.userCourse.update({
                where: { id: existing.id },
                data: { status: 'IN_PROGRESS' }
            });
            return NextResponse.json({ success: true, record: updated }, { status: 200 });
        }

        // Create new enrollment
        const record = await prisma.userCourse.create({
            data: {
                employeeId: userId,
                courseId,
                headquartersId: target.headquartersId,
                status: 'IN_PROGRESS'
            }
        });

        return NextResponse.json({ success: true, record }, { status: 201 });
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ success: false, error: 'Failed to enroll in course' }, { status: 500 });
    }
}
