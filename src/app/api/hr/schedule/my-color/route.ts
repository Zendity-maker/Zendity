import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { startOfDay, endOfDay } from 'date-fns';
import { todayStartAST } from '@/lib/dates';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const userId = searchParams.get('userId');
        const hqId = searchParams.get('hqId');

        if (!userId || !hqId) {
            return NextResponse.json({ success: false, color: null });
        }

        const today = new Date();

        // Resolver color del día (prioridad: asignación manual → roster publicado)
        let resolvedColor: string | null = null;
        let source: 'assignment' | 'roster' | 'none' = 'none';

        const colorAssignment = await prisma.shiftColorAssignment.findFirst({
            where: {
                userId,
                headquartersId: hqId,
                assignedAt: { gte: startOfDay(today), lte: endOfDay(today) }
            },
            orderBy: { assignedAt: 'desc' }
        });

        if (colorAssignment) {
            resolvedColor = colorAssignment.color;
            source = 'assignment';
        } else {
            const todayShift = await prisma.scheduledShift.findFirst({
                where: {
                    userId,
                    date: { gte: startOfDay(today), lte: endOfDay(today) },
                    isAbsent: false,
                    schedule: {
                        headquartersId: hqId,
                        status: 'PUBLISHED'
                    }
                },
                orderBy: { date: 'desc' }
            });
            if (todayShift) {
                resolvedColor = todayShift.colorGroup;
                source = 'roster';
            }
        }

        // FIX solitario: si el color resuelto NO es null y NO es 'ALL',
        // contar cuántos ShiftSessions abiertos hay hoy en la sede.
        // Si hay ≤ 1 sesión activa, el cuidador es único → ve todos los residentes.
        if (resolvedColor && resolvedColor !== 'ALL') {
            const activeSessions = await prisma.shiftSession.count({
                where: {
                    headquartersId: hqId,
                    actualEndTime: null,
                    startTime: { gte: todayStartAST() }
                }
            });

            if (activeSessions <= 1) {
                return NextResponse.json({
                    success: true,
                    color: 'ALL',
                    auto: true,
                    originalColor: resolvedColor,
                    source,
                });
            }
        }

        if (resolvedColor) {
            return NextResponse.json({ success: true, color: resolvedColor, source });
        }

        // Sin asignación manual ni roster publicado → color null.
        // El tablet muestra el selector manual / fallback localStorage.
        return NextResponse.json({ success: true, color: null, source: 'none' });

    } catch (error) {
        console.error('my-color error:', error);
        return NextResponse.json({ success: false, color: null });
    }
}
