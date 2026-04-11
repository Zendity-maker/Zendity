import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const ALLOWED_ROLES = ['DIRECTOR', 'ADMIN', 'SUPERVISOR', 'NURSE', 'SOCIAL_WORKER'];

export async function GET(req: Request, { params }: { params: Promise<{ patientId: string }> }) {
    try {
        const { patientId } = await params;
        const session = await getServerSession(authOptions);
        if (!session || !ALLOWED_ROLES.includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }
        const hqId = (session.user as any).headquartersId;

        const [notes, tasks, benefits, specialistVisits, patient] = await Promise.all([
            prisma.socialWorkNote.findMany({
                where: { patientId, headquartersId: hqId },
                include: { createdBy: { select: { id: true, name: true, role: true } } },
                orderBy: { createdAt: 'desc' },
            }),
            prisma.socialWorkTask.findMany({
                where: { patientId, headquartersId: hqId },
                include: {
                    createdBy: { select: { id: true, name: true } },
                    assignedTo: { select: { id: true, name: true } },
                },
                orderBy: [{ status: 'asc' }, { priority: 'desc' }, { createdAt: 'desc' }],
            }),
            prisma.socialWorkBenefit.findMany({
                where: { patientId, headquartersId: hqId },
                orderBy: { type: 'asc' },
            }),
            prisma.specialistVisit.findMany({
                where: { patientId, headquartersId: hqId },
                include: { createdBy: { select: { id: true, name: true } } },
                orderBy: { visitDate: 'desc' },
            }),
            prisma.patient.findUnique({
                where: { id: patientId },
                select: {
                    id: true,
                    name: true,
                    dateOfBirth: true,
                    status: true,
                    roomNumber: true,
                    diet: true,
                    familyMembers: { select: { id: true, name: true, email: true, accessLevel: true } },
                    vitalSigns: { orderBy: { createdAt: 'desc' }, take: 1 },
                    dailyLogs: { orderBy: { createdAt: 'desc' }, take: 3 },
                },
            }),
        ]);

        return NextResponse.json({ success: true, notes, tasks, benefits, specialistVisits, patient });
    } catch (error) {
        console.error('Social Work GET Error:', error);
        return NextResponse.json({ success: false, error: 'Error cargando datos sociales' }, { status: 500 });
    }
}
