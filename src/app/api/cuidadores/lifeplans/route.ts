import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';



export async function GET() {
    try {
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
