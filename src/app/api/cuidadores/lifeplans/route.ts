import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !['DIRECTOR', 'ADMIN', 'NURSE', 'SUPERVISOR'].includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }

        const lifePlans = await prisma.lifePlan.findMany({
            where: {
                patient: {
                    status: { notIn: ['DISCHARGED', 'DECEASED'] }
                }
            },
            include: {
                patient: true,
                signedBy: { select: { name: true, role: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        return NextResponse.json({ success: true, lifePlans });
    } catch (error) {
        console.error("Error fetching Life Plans:", error);
        return NextResponse.json({ success: false, error: "Error de lectura PAI" }, { status: 500 });
    }
}
