import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';



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
