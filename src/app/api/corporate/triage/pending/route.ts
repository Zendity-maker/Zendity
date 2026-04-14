import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const hqId = searchParams.get("hqId");
        const includeResolved = searchParams.get("includeResolved") === "true";

        const filterHQ = hqId && hqId !== "ALL" ? { headquartersId: hqId } : {};

        const tickets = await prisma.triageTicket.findMany({
            where: {
                ...filterHQ,
                isVoided: false,
                ...(includeResolved ? {} : { status: { not: 'RESOLVED' } }),
            },
            include: {
                patient: { select: { id: true, name: true, colorGroup: true, roomNumber: true } },
                assignedTo: { select: { id: true, name: true, role: true } },
                resolvedBy: { select: { id: true, name: true } },
            },
            orderBy: [
                { priority: 'desc' },
                { createdAt: 'desc' },
            ]
        });

        return NextResponse.json({ success: true, tickets });

    } catch (e: any) {
        console.error("Triage Pending Error:", e);
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
