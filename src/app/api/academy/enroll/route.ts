import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { userId, courseId } = body;

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

        // Fetch User to get their HQ
        const user = await prisma.user.findUnique({ where: { id: userId } });

        // Create new enrollment
        const record = await prisma.userCourse.create({
            data: {
                employeeId: userId,
                courseId,
                headquartersId: user?.headquartersId || "",
                status: 'IN_PROGRESS'
            }
        });

        return NextResponse.json({ success: true, record }, { status: 201 });
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ success: false, error: 'Failed to enroll in course' }, { status: 500 });
    }
}
