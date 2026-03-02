import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
    try {
        const lifePlans = await prisma.lifePlan.findMany({
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
