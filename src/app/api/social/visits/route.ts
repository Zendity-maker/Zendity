import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const ALLOWED_ROLES = ['SOCIAL_WORKER', 'DIRECTOR', 'ADMIN', 'SUPERVISOR', 'NURSE'];

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !ALLOWED_ROLES.includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const patientId = searchParams.get('patientId');

        if (!patientId) {
            return NextResponse.json({ success: false, error: 'patientId requerido' }, { status: 400 });
        }

        const visits = await prisma.specialistVisit.findMany({
            where: { patientId, headquartersId: (session.user as any).headquartersId },
            include: { createdBy: { select: { id: true, name: true } } },
            orderBy: { visitDate: 'desc' },
        });

        return NextResponse.json({ success: true, visits });
    } catch (error) {
        console.error('Social Visits GET Error:', error);
        return NextResponse.json({ success: false, error: 'Error cargando visitas' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !ALLOWED_ROLES.includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const { patientId, specialistType, specialistName, visitDate, nextVisitDate, notes } = await req.json();

        if (!patientId || !specialistType || !visitDate) {
            return NextResponse.json({ success: false, error: 'patientId, specialistType y visitDate requeridos' }, { status: 400 });
        }

        const visit = await prisma.specialistVisit.create({
            data: {
                patientId,
                headquartersId: (session.user as any).headquartersId,
                createdById: session.user.id,
                specialistType,
                specialistName: specialistName || null,
                visitDate: new Date(visitDate),
                nextVisitDate: nextVisitDate ? new Date(nextVisitDate) : null,
                notes: notes || null,
            },
            include: { createdBy: { select: { id: true, name: true } } },
        });

        return NextResponse.json({ success: true, visit });
    } catch (error) {
        console.error('Social Visits POST Error:', error);
        return NextResponse.json({ success: false, error: 'Error registrando visita' }, { status: 500 });
    }
}
