import { NextResponse } from "next/server";
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { requireRole } from '@/lib/api-auth';

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

        // Turnos futuros: el modal de baja necesita advertir ANTES de que el
        // director confirme, no después de dejar el itinerario con un hueco.
        const futureShifts = await prisma.scheduledShift.count({
            where: { userId: employeeId, date: { gte: new Date() } },
        });

        // Nunca enviar el hash al cliente — solo un booleano
        const { pinCode, ...safeEmployee } = employee as any;

        return NextResponse.json({
            success: true,
            employee: { ...safeEmployee, hasPinCode: !!pinCode, futureShifts },
            performanceHistory
        });

    } catch (error: any) {
        console.error("Error fetching employee profile:", error);
        return NextResponse.json({ success: false, error: "Error interno del servidor" }, { status: 500 });
    }
}

/**
 * Baja y reactivación de un empleado.
 *
 * Origen (19-ago-2026): el sistema tenía flujo completo de alta —usuario, PIN,
 * correo de bienvenida, ruta de cursos— y nada del otro lado. Cuatro cuidadoras
 * que ya no trabajaban seguían con acceso vigente al kiosko, y por tanto a
 * expedientes de residentes.
 *
 * `isActive: false` es la puerta real: src/lib/auth.ts la verifica y es el
 * único punto de entrada, PIN de kiosko incluido.
 *
 * No borra nada. El historial clínico que la persona documentó es expediente
 * y se conserva; la baja es reversible si regresa.
 */
export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: employeeId } = await params;

        // Dar de baja es decisión de RRHH, no de operación: SUPERVISOR y NURSE
        // pueden emitir faltas pero no cerrar el acceso de nadie.
        const auth = await requireRole(['DIRECTOR', 'ADMIN', 'SUPER_ADMIN']);
        if (auth instanceof NextResponse) return auth;

        const body = await req.json().catch(() => ({}));
        if (typeof body?.isActive !== 'boolean') {
            return NextResponse.json({ success: false, error: 'Falta isActive' }, { status: 400 });
        }
        const activar = body.isActive as boolean;

        const target = await prisma.user.findUnique({
            where: { id: employeeId },
            select: { id: true, name: true, role: true, isActive: true, headquartersId: true },
        });
        if (!target) {
            return NextResponse.json({ success: false, error: 'Empleado no encontrado' }, { status: 404 });
        }

        // Multi-tenant: un director solo toca a gente de su sede.
        if (auth.role !== 'SUPER_ADMIN' && target.headquartersId !== auth.headquartersId) {
            return NextResponse.json({ success: false, error: 'Empleado fuera de tu sede' }, { status: 403 });
        }
        // Nadie se cierra el acceso a sí mismo: quedaría fuera sin poder revertirlo.
        if (target.id === auth.id) {
            return NextResponse.json({ success: false, error: 'No puedes darte de baja a ti mismo' }, { status: 400 });
        }
        // Un director no da de baja al administrador de la plataforma.
        if (target.role === 'SUPER_ADMIN' && auth.role !== 'SUPER_ADMIN') {
            return NextResponse.json({ success: false, error: 'No autorizado sobre este usuario' }, { status: 403 });
        }

        const futureShifts = await prisma.scheduledShift.count({
            where: { userId: employeeId, date: { gte: new Date() } },
        });

        await prisma.$transaction(async (tx) => {
            // Al reactivar se limpia isDeleted también: el GET de la lista filtra
            // por ambos flags, así que restaurar solo isActive devolvía el acceso
            // pero dejaba a la persona invisible en /hr/staff.
            await tx.user.update({
                where: { id: employeeId },
                data: activar ? { isActive: true, isDeleted: false } : { isActive: false },
            });
            // Al dar de baja, la sesión abierta se cae en el acto. Sin esto
            // alguien ya autenticado sigue navegando hasta que expire.
            if (!activar) {
                await tx.session.deleteMany({ where: { userId: employeeId } });
            }
        });

        return NextResponse.json({
            success: true,
            isActive: activar,
            futureShifts,
            message: activar
                ? `${target.name ?? 'El empleado'} fue reactivado.`
                : `${target.name ?? 'El empleado'} quedó fuera del sistema.`,
        });
    } catch (error: any) {
        console.error('Error en baja/reactivación de empleado:', error);
        return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
    }
}
