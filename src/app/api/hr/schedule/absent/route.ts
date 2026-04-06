import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
    try {
        const { scheduledShiftId, markedById, hqId } = await req.json();

        if (!scheduledShiftId || !markedById || !hqId) {
            return NextResponse.json({ success: false, error: 'Datos incompletos' }, { status: 400 });
        }

        // 1. Marcar el turno como ausente
        const shift = await prisma.scheduledShift.update({
            where: { id: scheduledShiftId },
            data: {
                isAbsent: true,
                absentMarkedAt: new Date(),
                absentMarkedById: markedById
            },
            include: { user: { select: { id: true, name: true } } }
        });

        // 2. Obtener todos los residentes del color del ausente
        const absentColorGroup = shift.colorGroup;

        if (absentColorGroup === 'ALL') {
            // Turno nocturno con todos los colores — buscar cuidadores activos del mismo turno
            const activeShifts = await prisma.scheduledShift.findMany({
                where: {
                    scheduleId: shift.scheduleId,
                    date: shift.date,
                    shiftType: shift.shiftType,
                    isAbsent: false,
                    id: { not: scheduledShiftId }
                },
                include: { user: { select: { id: true, name: true } } }
            });

            return NextResponse.json({
                success: true,
                shift,
                absentColorGroup,
                activeShifts,
                redistributionPending: true,
                redistributionDeadline: new Date(Date.now() + 15 * 60 * 1000).toISOString()
            });
        }

        // 3. Obtener residentes activos del color del ausente
        const residents = await prisma.patient.findMany({
            where: { headquartersId: hqId, status: 'ACTIVE', colorGroup: absentColorGroup as any },
            select: { id: true, name: true, colorGroup: true }
        });

        // 4. Obtener cuidadores activos en el mismo turno (excepto el ausente)
        const activeShifts = await prisma.scheduledShift.findMany({
            where: {
                scheduleId: shift.scheduleId,
                date: shift.date,
                shiftType: shift.shiftType,
                isAbsent: false,
                id: { not: scheduledShiftId }
            },
            include: {
                user: { select: { id: true, name: true } },
                colorAssignments: true
            }
        });

        // 5. Calcular carga actual de cada cuidador activo
        const caregiverLoads = await Promise.all(
            activeShifts.map(async (s: any) => {
                const colors = s.colorAssignments.map((a: any) => a.color);
                // Si no tiene asignaciones, usar su colorGroup del roster
                const colorsToCount = colors.length > 0 ? colors : [s.colorGroup];
                const resCount = await prisma.patient.count({
                    where: {
                        headquartersId: hqId,
                        status: 'ACTIVE',
                        colorGroup: { in: colorsToCount as any[] }
                    }
                });
                return { shift: s, currentLoad: resCount };
            })
        );

        // 6. Algoritmo de redistribucion: asignar al de menor carga
        if (caregiverLoads.length === 0) {
            return NextResponse.json({
                success: true,
                shift,
                residents,
                activeShifts: [],
                redistributionPending: false,
                message: 'No hay cuidadores activos para redistribuir'
            });
        }

        const targetCaregiver = caregiverLoads.sort((a: any, b: any) => a.currentLoad - b.currentLoad)[0];

        return NextResponse.json({
            success: true,
            shift,
            absentColorGroup,
            residents,
            activeShifts: caregiverLoads,
            suggestedAssignee: targetCaregiver.shift.user,
            redistributionPending: true,
            redistributionDeadline: new Date(Date.now() + 15 * 60 * 1000).toISOString()
        });

    } catch (error) {
        console.error('Absent API error:', error);
        return NextResponse.json({ success: false, error: 'Error procesando ausencia' }, { status: 500 });
    }
}
