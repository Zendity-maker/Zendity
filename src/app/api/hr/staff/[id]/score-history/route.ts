import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const ALLOWED_ROLES = ['DIRECTOR', 'ADMIN', 'SUPERVISOR', 'NURSE'];

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: targetUserId } = await params;
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });

        const sessionUserId = (session.user as any).id;
        const sessionRole   = (session.user as any).role;
        const hqId          = (session.user as any).headquartersId;

        // El propio empleado puede ver su historial; roles de gestión también
        const isSelf  = sessionUserId === targetUserId;
        const isStaff = ALLOWED_ROLES.includes(sessionRole);
        if (!isSelf && !isStaff) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 403 });
        }

        // Verificar que el usuario objetivo pertenece a la misma sede
        const targetUser = await prisma.user.findUnique({
            where:  { id: targetUserId },
            select: { complianceScore: true, headquartersId: true, name: true },
        });
        if (!targetUser) return NextResponse.json({ success: false, error: 'Empleado no encontrado' }, { status: 404 });
        if (!isSelf && targetUser.headquartersId !== hqId) {
            return NextResponse.json({ success: false, error: 'Empleado fuera de tu sede' }, { status: 403 });
        }

        // Últimos 90 días
        const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

        const events = await prisma.scoreEvent.findMany({
            where:   { userId: targetUserId, createdAt: { gte: since } },
            orderBy: { createdAt: 'desc' },
            take:    200,
        });

        // ── Agrupar por semana para la gráfica ────────────────────────────
        // Semana = lunes de la semana (ISO)
        function getWeekKey(d: Date): string {
            const day = d.getDay(); // 0=sun
            const diff = (day === 0 ? -6 : 1) - day;
            const monday = new Date(d);
            monday.setDate(d.getDate() + diff);
            return monday.toISOString().slice(0, 10);
        }

        const weekMap: Record<string, number[]> = {};
        for (const ev of events) {
            const wk = getWeekKey(new Date(ev.createdAt));
            if (!weekMap[wk]) weekMap[wk] = [];
            weekMap[wk].push(ev.scoreAfter);
        }

        // Si no hay eventos en una semana, interpolamos con el evento más cercano previo
        const weeklyAverage = Object.entries(weekMap)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([week, scores]) => ({
                week,
                avgScore: Math.round(scores.reduce((s, v) => s + v, 0) / scores.length),
            }));

        // ── Resumen ────────────────────────────────────────────────────────
        const totalPositive = events.filter(e => e.delta > 0).reduce((s, e) => s + e.delta, 0);
        const totalNegative = events.filter(e => e.delta < 0).reduce((s, e) => s + e.delta, 0);

        const catCount: Record<string, number> = {};
        for (const e of events) {
            catCount[e.category] = (catCount[e.category] || 0) + Math.abs(e.delta);
        }
        const topCategory = Object.entries(catCount).sort(([, a], [, b]) => b - a)[0]?.[0] ?? null;

        return NextResponse.json({
            success: true,
            currentScore: targetUser.complianceScore,
            weeklyAverage,
            events: events.slice(0, 60).map(e => ({
                id:          e.id,
                date:        e.createdAt,
                delta:       e.delta,
                reason:      e.reason,
                category:    e.category,
                scoreBefore: e.scoreBefore,
                scoreAfter:  e.scoreAfter,
            })),
            summary: { totalPositive, totalNegative, topCategory },
        });

    } catch (err) {
        console.error('[score-history GET]', err);
        return NextResponse.json({ success: false, error: 'Error cargando historial' }, { status: 500 });
    }
}
