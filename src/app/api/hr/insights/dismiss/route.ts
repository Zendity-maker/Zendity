import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['DIRECTOR', 'ADMIN', 'SUPERVISOR'];

// POST /api/hr/insights/dismiss
// Body: { employeeId: string, insightType: string }
// Crea un InsightDismissal con 24h de vigencia para suprimir esa bandera.
export async function POST(req: Request) {
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
        const dismissedById = (session.user as any).id;

        const { employeeId, insightType } = await req.json();
        if (!employeeId || !insightType) {
            return NextResponse.json({ success: false, error: 'Faltan campos: employeeId, insightType' }, { status: 400 });
        }

        const now = new Date();
        const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 horas

        // Upsert: si ya existe un dismissal activo para este insight, lo reemplazamos
        await prisma.insightDismissal.deleteMany({
            where: { headquartersId: hqId, employeeId, insightType },
        });

        const dismissal = await prisma.insightDismissal.create({
            data: {
                headquartersId: hqId,
                employeeId,
                insightType,
                dismissedById,
                dismissedAt: now,
                expiresAt,
            },
        });

        return NextResponse.json({ success: true, dismissal, expiresAt: expiresAt.toISOString() });

    } catch (error: any) {
        console.error('[insights/dismiss] Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
