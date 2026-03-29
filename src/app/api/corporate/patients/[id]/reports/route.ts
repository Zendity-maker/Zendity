import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';



export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const resolvedParams = await params;
        const notes = await prisma.clinicalNote.findMany({
            where: { patientId: resolvedParams.id },
            include: { author: { select: { name: true, role: true } } },
            orderBy: { createdAt: 'desc' }
        });
        return NextResponse.json({ success: true, notes });
    } catch (e: unknown) {
        return NextResponse.json({ success: false, error: (e as Error).message }, { status: 500 });
    }
}
