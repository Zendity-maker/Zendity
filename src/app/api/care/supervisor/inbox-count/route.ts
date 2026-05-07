import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { resolveEffectiveHqId } from '@/lib/hq-resolver';
import { todayStartAST } from '@/lib/dates';
import { SystemAuditAction } from '@prisma/client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/care/supervisor/inbox-count
 *
 * Cuenta ligera de tickets activos en el Inbox Operativo.
 * Usado por el badge del sidebar — no construye el feed completo.
 */
export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, count: 0 }, { status: 401 });
        }

        const ALLOWED = ['SUPERVISOR', 'DIRECTOR', 'ADMIN', 'NURSE'];
        if (!ALLOWED.includes((session.user as any).role)) {
            return NextResponse.json({ success: false, count: 0 }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        let hqId: string;
        try {
            hqId = await resolveEffectiveHqId(session, searchParams.get('hqId'));
        } catch {
            return NextResponse.json({ success: false, count: 0 }, { status: 400 });
        }

        const todayStart = todayStartAST();
        const twentyFourHrsAgo = new Date(Date.now() - 24 * 3600000);

        // Tickets referidos hoy → no contar
        const referredLogs = await prisma.systemAuditLog.findMany({
            where: { headquartersId: hqId, action: SystemAuditAction.ESCALATED, createdAt: { gte: todayStart } },
            select: { payloadChanges: true },
        });
        const referredIds = new Set<string>(
            referredLogs
                .map((r: any) => {
                    const p = r.payloadChanges as any;
                    return p?.kind === 'REFERRED_TO_NURSING' ? p.sourceId : null;
                })
                .filter(Boolean)
        );

        // Contar fuentes del feed (queries ligeras)
        const [complaints, incidents, clinicalAlerts, uppPatients] = await Promise.all([
            prisma.complaint.count({ where: { headquartersId: hqId, status: 'PENDING' } }),
            prisma.incident.count({ where: { headquartersId: hqId, reportedAt: { gte: twentyFourHrsAgo } } }),
            prisma.dailyLog.count({ where: { patient: { headquartersId: hqId }, isClinicalAlert: true, createdAt: { gte: twentyFourHrsAgo } } }),
            prisma.patient.count({ where: { headquartersId: hqId, pressureUlcers: { some: { status: 'ACTIVE' } } } }),
        ]);

        // Estimado conservador: suma bruta menos referidos
        const rawCount = complaints + incidents + clinicalAlerts + uppPatients;
        const count = Math.max(0, rawCount - referredIds.size);

        return NextResponse.json({ success: true, count });
    } catch (error: any) {
        console.error('[inbox-count]', error);
        return NextResponse.json({ success: false, count: 0 });
    }
}
