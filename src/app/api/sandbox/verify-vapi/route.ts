import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
    try {
        const leads = await prisma.cRMLead.findMany({
            orderBy: { createdAt: 'desc' },
            take: 3
        });
        return NextResponse.json({ success: true, leads });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message });
    }
}
