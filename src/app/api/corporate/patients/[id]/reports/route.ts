import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';



export async function GET(req: Request, { params }: { params: { id: string } }) {
    try {
        const notes = await prisma.clinicalNote.findMany({
            where: { patientId: params.id },
            include: { author: { select: { name: true, role: true } } },
            orderBy: { createdAt: 'desc' }
        });
        return NextResponse.json({ success: true, notes });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
