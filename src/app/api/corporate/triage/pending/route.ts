import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { requireRole } from '@/lib/api-auth';
import { resolveEffectiveHqId } from '@/lib/hq-resolver';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ALLOWED_ROLES = ['SUPERVISOR', 'DIRECTOR', 'ADMIN', 'NURSE'];

export async function GET(req: Request) {
    try {
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;

        // `resolveEffectiveHqId` requiere el objeto Session de NextAuth.
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const requestedHqId = searchParams.get("hqId");
        const includeResolved = searchParams.get("includeResolved") === "true";

        // Resolver hqId efectivo respetando rol (roles limitados anclados a su sede)
        let effectiveHq: string;
        try {
            effectiveHq = await resolveEffectiveHqId(session, requestedHqId);
        } catch (e: any) {
            return NextResponse.json({ success: false, error: e.message || 'Sede inválida' }, { status: 400 });
        }

        const tickets = await prisma.triageTicket.findMany({
            where: {
                headquartersId: effectiveHq,
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
