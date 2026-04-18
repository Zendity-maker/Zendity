import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['DIRECTOR', 'ADMIN', 'SUPERVISOR', 'NURSE'];

/**
 * GET /api/insights/digest
 * Retorna el último ShiftHandover con aiSummaryReport de la sede del usuario.
 * Es el "Zendi Digest del Día" — resumen generado por zendi-digest (POST).
 */
export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }
        const role = (session.user as any).role;
        if (!ALLOWED_ROLES.includes(role)) {
            return NextResponse.json({ success: false, error: 'Rol no autorizado' }, { status: 403 });
        }
        const hqId = (session.user as any).headquartersId;
        if (!hqId) {
            return NextResponse.json({ success: false, error: 'Usuario sin sede asignada' }, { status: 400 });
        }

        const latest = await prisma.shiftHandover.findFirst({
            where: {
                headquartersId: hqId,
                aiSummaryReport: { not: null },
            },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                shiftType: true,
                aiSummaryReport: true,
                createdAt: true,
                outgoingNurse: { select: { name: true, role: true } },
            },
        });

        if (!latest) {
            return NextResponse.json({ success: true, digest: null });
        }

        return NextResponse.json({
            success: true,
            digest: {
                id: latest.id,
                shiftType: latest.shiftType,
                summary: latest.aiSummaryReport,
                createdAt: latest.createdAt,
                outgoingNurse: latest.outgoingNurse?.name || null,
            },
        });
    } catch (err: any) {
        console.error('[insights/digest]', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
