import { NextResponse } from "next/server";
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['DIRECTOR', 'ADMIN', 'SUPERVISOR', 'NURSE'];

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

        // Auth — antes CERO check. El propio empleado o roles de gestión + tenant.
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        const isSelf = (session.user as any).id === employeeId;
        if (!isSelf && !ALLOWED_ROLES.includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 403 });
        }

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
        // Tenant check — salvo el propio empleado, debe ser de tu sede
        if (!isSelf && employee.headquartersId !== (session.user as any).headquartersId) {
            return NextResponse.json({ success: false, error: "Empleado fuera de tu sede" }, { status: 403 });
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
