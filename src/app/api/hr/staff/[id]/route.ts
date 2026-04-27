import { NextResponse } from "next/server";
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// Formateador de mes abreviado en español (Ej: "Ene 26")
const MONTH_ABBR_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const formatMonthLabel = (date: Date): string => {
    const m = MONTH_ABBR_ES[date.getMonth()];
    const y = String(date.getFullYear()).slice(-2);
    return `${m} ${y}`;
};

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: employeeId } = await params;

        const employee = await prisma.user.findUnique({
            where: { id: employeeId },
            include: {
                headquarters: true,
                _count: {
                    select: {
                        administeredMeds: true,
                        shiftSessions: true,
                    }
                }
            }
        });

        if (!employee) {
            return NextResponse.json({ success: false, error: "Empleado no encontrado" }, { status: 404 });
        }

        // Historial de desempeño REAL desde EmployeeEvaluation
        // Tomamos las últimas 6 evaluaciones en orden cronológico ascendente
        const realEvals = await prisma.employeeEvaluation.findMany({
            where: { employeeId },
            orderBy: { createdAt: 'desc' },
            take: 6,
            select: {
                score: true,
                createdAt: true,
                evaluatorId: true,
            },
        });

        // Invertimos para mostrar del más antiguo al más reciente en el chart
        const performanceHistory = realEvals
            .slice()
            .reverse()
            .map(ev => ({
                month: formatMonthLabel(new Date(ev.createdAt)),
                score: ev.score,
                date: ev.createdAt,
            }));

        // Nunca enviar el hash al cliente — solo un booleano
        const { pinCode, ...safeEmployee } = employee as any;

        return NextResponse.json({
            success: true,
            employee: { ...safeEmployee, hasPinCode: !!pinCode },
            performanceHistory
        });

    } catch (error: any) {
        console.error("Error fetching employee profile:", error);
        return NextResponse.json({ success: false, error: "Error interno del servidor" }, { status: 500 });
    }
}
