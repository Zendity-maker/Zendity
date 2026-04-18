import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { todayStartAST } from '@/lib/dates';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['DIRECTOR', 'ADMIN', 'SUPERVISOR'];

/**
 * GET /api/corporate/modules
 * "Módulos Corporativos" dinámicos para el Dashboard Gerencial.
 * Reemplaza las 3 cards hardcoded por señales reales de actividad en la sede.
 *
 * Siempre usa session.user.headquartersId (nunca acepta hqId del cliente).
 */
export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }
        const role = (session.user as any).role;
        if (!ALLOWED_ROLES.includes(role)) {
            return NextResponse.json({ success: false, error: 'Rol no autorizado' }, { status: 403 });
        }
        const hqId = (session.user as any).headquartersId;
        if (!hqId) {
            return NextResponse.json({ success: false, error: 'Usuario sin sede asignada' }, { status: 400 });
        }

        const todayStart = todayStartAST();

        const [openTriage, unreadFamily, draftSchedules] = await Promise.all([
            // A) Tickets de triage abiertos hoy
            prisma.triageTicket.count({
                where: {
                    headquartersId: hqId,
                    status: 'OPEN',
                    isVoided: false,
                    createdAt: { gte: todayStart },
                },
            }),
            // B) Mensajes familiares sin leer hoy (desde FAMILY hacia STAFF)
            prisma.familyMessage.count({
                where: {
                    senderType: 'FAMILY',
                    isRead: false,
                    createdAt: { gte: todayStart },
                    patient: { headquartersId: hqId },
                },
            }),
            // C) Schedules en estado DRAFT (horarios sin publicar)
            prisma.schedule.count({
                where: {
                    headquartersId: hqId,
                    status: 'DRAFT',
                },
            }),
        ]);

        return NextResponse.json({
            success: true,
            modules: {
                openTriage,
                unreadFamily,
                draftSchedules,
            },
        });
    } catch (err: any) {
        console.error('[corporate/modules]', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
