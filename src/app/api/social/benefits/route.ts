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

        const benefits = await prisma.socialWorkBenefit.findMany({
            where: { patientId, headquartersId: (session.user as any).headquartersId },
            orderBy: { type: 'asc' },
        });

        return NextResponse.json({ success: true, benefits });
    } catch (error) {
        console.error('Social Benefits GET Error:', error);
        return NextResponse.json({ success: false, error: 'Error cargando beneficios' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !ALLOWED_ROLES.includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const { patientId, type, status, details, expirationDate } = await req.json();

        if (!patientId || !type) {
            return NextResponse.json({ success: false, error: 'patientId y type requeridos' }, { status: 400 });
        }

        const benefit = await prisma.socialWorkBenefit.create({
            data: {
                patientId,
                headquartersId: (session.user as any).headquartersId,
                type,
                status: status || 'ACTIVE',
                details: details || null,
                expirationDate: expirationDate ? new Date(expirationDate) : null,
            },
        });

        return NextResponse.json({ success: true, benefit });
    } catch (error) {
        console.error('Social Benefits POST Error:', error);
        return NextResponse.json({ success: false, error: 'Error creando beneficio' }, { status: 500 });
    }
}

export async function PATCH(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !ALLOWED_ROLES.includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const { benefitId, status, details, expirationDate } = await req.json();

        if (!benefitId) {
            return NextResponse.json({ success: false, error: 'benefitId requerido' }, { status: 400 });
        }

        const updateData: any = {};
        if (status) updateData.status = status;
        if (details !== undefined) updateData.details = details;
        if (expirationDate !== undefined) updateData.expirationDate = expirationDate ? new Date(expirationDate) : null;

        const benefit = await prisma.socialWorkBenefit.update({
            where: { id: benefitId },
            data: updateData,
        });

        return NextResponse.json({ success: true, benefit });
    } catch (error) {
        console.error('Social Benefits PATCH Error:', error);
        return NextResponse.json({ success: false, error: 'Error actualizando beneficio' }, { status: 500 });
    }
}
