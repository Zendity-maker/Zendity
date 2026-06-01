import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { requireRole } from '@/lib/api-auth';
import { resolveEffectiveHqId } from '@/lib/hq-resolver';
import { TicketOriginType } from '@prisma/client';

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

        // Filtro opcional por originType. Acepta CSV ("FALL,COMPLAINT") o valor único.
        // Valores válidos: COMPLAINT | INCIDENT | DAILY_LOG | FALL | MANUAL | MEDICATION_ERROR
        // Cualquier valor inválido se ignora silenciosamente; "ALL" o vacío = sin filtro.
        const VALID_ORIGIN_TYPES = ['COMPLAINT', 'INCIDENT', 'DAILY_LOG', 'FALL', 'MANUAL', 'MEDICATION_ERROR'];
        const originTypeParam = searchParams.get('originType');
        let originTypeFilter: string[] | null = null;
        if (originTypeParam && originTypeParam !== 'ALL') {
            const requested = originTypeParam.split(',').map(s => s.trim()).filter(Boolean);
            const valid = requested.filter(s => VALID_ORIGIN_TYPES.includes(s));
            if (valid.length > 0) originTypeFilter = valid;
        }

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
                ...(originTypeFilter ? { originType: { in: originTypeFilter as TicketOriginType[] } } : {}),
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

        // Counters POR originType sobre el universo total (mismo hqId/includeResolved/isVoided),
        // para alimentar el KPI strip y los conteos de los filtros UI. Calculado con
        // groupBy de Prisma — barato comparado con re-fetch.
        const allByOrigin = await prisma.triageTicket.groupBy({
            by: ['originType'],
            where: {
                headquartersId: effectiveHq,
                isVoided: false,
                ...(includeResolved ? {} : { status: { not: 'RESOLVED' } }),
            },
            _count: { _all: true },
        });
        const counts: Record<string, number> = {};
        let totalCount = 0;
        for (const g of allByOrigin) {
            counts[g.originType] = g._count._all;
            totalCount += g._count._all;
        }

        // Conteo de escalados (cualquier originType, status != RESOLVED) — siempre relevante.
        const escalatedCount = await prisma.triageTicket.count({
            where: {
                headquartersId: effectiveHq,
                isVoided: false,
                isEscalated: true,
                status: { not: 'RESOLVED' },
            },
        });

        return NextResponse.json({
            success: true,
            tickets,
            counts: { ...counts, ALL: totalCount, ESCALATED: escalatedCount },
        });

    } catch (e: any) {
        console.error("Triage Pending Error:", e);
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
