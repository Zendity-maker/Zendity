/**
 * GET /api/audit/logs?hqId=&entityName=&action=&from=&to=&page=
 *
 * Retorna el Registro de Actividad (SystemAuditLog) de una sede.
 * Solo accesible para DIRECTOR y ADMIN.
 * Paginado: 50 registros por página.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { resolveEffectiveHqId } from '@/lib/hq-resolver';

const ALLOWED_ROLES = ['DIRECTOR', 'ADMIN'];
const PAGE_SIZE = 50;

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }
        const invokerRole = (session.user as any).role;
        if (!ALLOWED_ROLES.includes(invokerRole)) {
            return NextResponse.json({ error: 'Solo DIRECTOR o ADMIN pueden ver el registro de actividad' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const hqId = await resolveEffectiveHqId(session, searchParams.get('hqId'));

        const entityName = searchParams.get('entityName') || undefined;
        const action = searchParams.get('action') || undefined;
        const performedById = searchParams.get('userId') || undefined;
        const from = searchParams.get('from');
        const to = searchParams.get('to');
        const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));

        const where: any = { headquartersId: hqId };
        if (entityName) where.entityName = entityName;
        if (action) where.action = action;
        if (performedById) where.performedById = performedById;
        if (from || to) {
            where.createdAt = {};
            if (from) where.createdAt.gte = new Date(from + 'T00:00:00');
            if (to) where.createdAt.lte = new Date(to + 'T23:59:59.999');
        }

        const [total, logs] = await Promise.all([
            prisma.systemAuditLog.count({ where }),
            prisma.systemAuditLog.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * PAGE_SIZE,
                take: PAGE_SIZE,
                select: {
                    id: true,
                    action: true,
                    entityName: true,
                    entityId: true,
                    payloadChanges: true,
                    clientIp: true,
                    createdAt: true,
                    performedById: true,
                    headquarters: { select: { name: true } },
                },
            }),
        ]);

        // Enriquecer con nombre del actor
        const actorIds = [...new Set(logs.map(l => l.performedById).filter(Boolean))] as string[];
        const actors = actorIds.length > 0
            ? await prisma.user.findMany({
                where: { id: { in: actorIds } },
                select: { id: true, name: true, role: true },
            })
            : [];
        const actorMap = new Map(actors.map(a => [a.id, a]));

        const enriched = logs.map(log => ({
            ...log,
            actor: log.performedById ? actorMap.get(log.performedById) || null : null,
        }));

        return NextResponse.json({
            success: true,
            logs: enriched,
            total,
            page,
            pages: Math.ceil(total / PAGE_SIZE),
        });
    } catch (error) {
        console.error('GET /api/audit/logs Error:', error);
        return NextResponse.json({ error: 'Failed to fetch audit logs' }, { status: 500 });
    }
}
