import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logError } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/family/external-services
 *
 * Lista visitas externas PUBLISHED que afectaron al residente del familiar
 * logueado, últimos 60 días. Incluye facilityWide. Solo si el visitante marcó
 * notifyFamilies=true.
 *
 * Endpoint independiente del /feed para cuando la familia quiera una vista
 * dedicada (sección "Servicios" del portal en el futuro). Hoy también
 * alimenta el feed combinado.
 */
export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session || (session.user as any).role !== 'FAMILY') {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }

        const familyMember = await prisma.familyMember.findUnique({
            where: { email: session.user?.email as string },
            select: { patientId: true, patient: { select: { status: true } } },
        });
        if (!familyMember?.patientId) {
            return NextResponse.json({ success: false, error: 'Cuenta no vinculada' }, { status: 404 });
        }
        // Defensa: si el paciente cambió a DECEASED/DISCHARGED, no servir nada.
        // (auth.ts ya bloquea el sign-in, pero session cacheada puede sobrevivir
        // brevemente — defensa runtime adicional.)
        if (!['ACTIVE', 'TEMPORARY_LEAVE'].includes(familyMember.patient?.status || '')) {
            return NextResponse.json({ success: true, visits: [] });
        }

        const since = new Date();
        since.setDate(since.getDate() - 60);

        const visits = await prisma.externalServiceVisit.findMany({
            where: {
                status: 'PUBLISHED',
                notifyFamilies: true,
                registeredAt: { gte: since },
                OR: [
                    { patientVisits: { some: { patientId: familyMember.patientId } } },
                    { isFacilityWide: true },
                ],
            },
            include: {
                provider: { include: { category: { select: { name: true, icon: true } } } },
            },
            orderBy: { registeredAt: 'desc' },
        });

        return NextResponse.json({
            success: true,
            visits: visits.map(v => ({
                id: v.id,
                providerName: v.provider.name,
                categoryName: v.provider.category.name,
                categoryIcon: v.provider.category.icon,
                serviceType: v.serviceType,
                comment: v.comment,
                isFacilityWide: v.isFacilityWide,
                registeredAt: v.registeredAt,
            })),
        });
    } catch (err: any) {
        logError('family.external-services', err);
        return NextResponse.json({ success: false, error: 'Error cargando visitas externas' }, { status: 500 });
    }
}
