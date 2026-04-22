import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { startOfDay, endOfDay } from 'date-fns';
import { todayStartAST } from '@/lib/dates';
import { inferShiftTypeFromAST } from '@/lib/shift-coverage';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const userId = searchParams.get('userId');
        const hqId = searchParams.get('hqId');

        if (!userId || !hqId) {
            return NextResponse.json({ success: false, color: null });
        }

        const today = new Date();
        // Sprint — turno actual en horario AST (Vercel corre en UTC;
        // `new Date().getHours()` devolvería la hora UTC incorrecta).
        const currentShiftType = inferShiftTypeFromAST();

        // Resolver color del día (prioridad: asignación manual → roster publicado del turno ACTUAL)
        let resolvedColor: string | null = null;
        let source: 'assignment' | 'roster' | 'none' | 'no_color_assigned' = 'none';

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
            // Filtro por shiftType actual: previene que un shift futuro (ej. NIGHT)
            // contamine el turno actual (ej. EVENING). Antes: sin filtro de shiftType,
            // cualquier shift del día matcheaba.
            const todayShift = await prisma.scheduledShift.findFirst({
                where: {
                    userId,
                    date: { gte: startOfDay(today), lte: endOfDay(today) },
                    shiftType: currentShiftType as any,
                    isAbsent: false,
                    schedule: {
                        headquartersId: hqId,
                        status: 'PUBLISHED'
                    }
                },
                orderBy: { date: 'desc' }
            });
            if (todayShift) {
                if (todayShift.colorGroup) {
                    resolvedColor = todayShift.colorGroup;
                    source = 'roster';
                } else {
                    // Shift existe pero sin colorGroup (ej. KITCHEN, MAINTENANCE, limpieza).
                    // Devolver color=null + source especial para que el tablet NO caiga
                    // a localStorage — en su lugar muestra "sin residentes asignados".
                    source = 'no_color_assigned';
                }
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

        // Sin color. source puede ser:
        //  - 'no_color_assigned' → shift encontrado pero sin color asignado (no caer a localStorage)
        //  - 'none' → no hay shift del turno actual ni asignación manual
        return NextResponse.json({ success: true, color: null, source });

    } catch (error) {
        console.error('my-color error:', error);
        return NextResponse.json({ success: false, color: null });
    }
}
