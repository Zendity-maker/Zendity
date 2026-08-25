import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { rotacionVencida } from '@/lib/rotacion-upp';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { requireRole } from '@/lib/api-auth';
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
        const ALLOWED = ['SUPERVISOR', 'DIRECTOR', 'ADMIN', 'NURSE'];
        const auth = await requireRole(ALLOWED);
        if (auth instanceof NextResponse) return auth;

        // `resolveEffectiveHqId` requiere el objeto Session de NextAuth; lo
        // leemos por separado tras pasar el gate de auth.
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, count: 0 }, { status: 401 });
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
        const [complaints, incidents, clinicalAlerts, conUlcera] = await Promise.all([
            prisma.complaint.count({ where: { headquartersId: hqId, status: 'PENDING' } }),
            prisma.incident.count({ where: { headquartersId: hqId, reportedAt: { gte: twentyFourHrsAgo } } }),
            prisma.dailyLog.count({ where: { patient: { headquartersId: hqId }, isClinicalAlert: true, isResolved: false, createdAt: { gte: twentyFourHrsAgo } } }),
            // Antes esto contaba "residentes con úlcera activa", que no es una
            // tarea sino una condición: sumaba al badge todos los días durante
            // meses y el supervisor no podía quitarla haciendo nada. En Cupey
            // llevaba 73, 65 y 48 días — y uno de los tres residentes estaba
            // FALLECIDO, porque tampoco se miraba su estado.
            //
            // Ahora cuenta lo que sí es accionable: residente activo con úlcera
            // activa cuya rotación está VENCIDA, con el umbral canónico
            // compartido de src/lib/rotacion-upp.ts.
            prisma.patient.findMany({
                where: {
                    headquartersId: hqId,
                    status: 'ACTIVE',
                    pressureUlcers: { some: { status: 'ACTIVE' } },
                },
                select: {
                    posturalChanges: {
                        orderBy: { performedAt: 'desc' },
                        take: 1,
                        select: { performedAt: true },
                    },
                },
            }),
        ]);

        // Sin ningún cambio registrado también cuenta: es el caso peor.
        const uppVencidas = conUlcera.filter(
            p => rotacionVencida(p.posturalChanges[0]?.performedAt),
        ).length;

        // Estimado conservador: suma bruta menos referidos
        const rawCount = complaints + incidents + clinicalAlerts + uppVencidas;
        const count = Math.max(0, rawCount - referredIds.size);

        return NextResponse.json({ success: true, count });
    } catch (error: any) {
        console.error('[inbox-count]', error);
        return NextResponse.json({ success: false, count: 0 });
    }
}
