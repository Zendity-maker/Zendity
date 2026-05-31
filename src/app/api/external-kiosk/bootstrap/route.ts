import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireKioskDevice, touchKioskDevice } from '@/lib/external-kiosk-auth';
import { logError } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/external-kiosk/bootstrap
 *
 * Auth: header `x-device-token`.
 *
 * Devuelve TODO lo que la tablet necesita para operar en un solo payload:
 *   - headquartersId / floor / label (identificación visual del kiosko)
 *   - categories[] con providers anidados (catálogo completo)
 *   - patients[] activos de la sede (para multi-select de residentes)
 *
 * Una sola request al cargar el kiosko. Después POST /visit por cada visita
 * registrada. La tablet no necesita pollear nada más.
 *
 * Filtros aplicados:
 *   - Solo categorías y providers con isActive: true
 *   - Solo pacientes con status ACTIVE | TEMPORARY_LEAVE (no DISCHARGED/DECEASED)
 *
 * También dispara touchKioskDevice() para actualizar lastSeenAt.
 */
export async function GET(req: Request) {
    try {
        const device = await requireKioskDevice(req);
        if (device instanceof NextResponse) return device;
        const { headquartersId, floorNumber, label } = device;

        // touch en paralelo, no bloqueamos al cliente esperando esta escritura.
        // void: ignoramos el promise deliberadamente.
        void touchKioskDevice(device.id);

        const [categories, patients] = await Promise.all([
            prisma.externalServiceCategory.findMany({
                where: { headquartersId, isActive: true },
                orderBy: { displayOrder: 'asc' },
                select: {
                    id: true,
                    name: true,
                    icon: true,
                    providers: {
                        where: { isActive: true },
                        orderBy: { name: 'asc' },
                        select: { id: true, name: true },
                    },
                },
            }),
            prisma.patient.findMany({
                where: {
                    headquartersId,
                    status: { in: ['ACTIVE', 'TEMPORARY_LEAVE'] },
                },
                orderBy: [{ roomNumber: 'asc' }, { name: 'asc' }],
                select: {
                    id: true,
                    name: true,
                    roomNumber: true,
                    photoUrl: true,
                    colorGroup: true,
                },
            }),
        ]);

        return NextResponse.json({
            success: true,
            device: { headquartersId, floor: floorNumber, label },
            categories,
            patients,
        });
    } catch (err: any) {
        logError('external-kiosk.bootstrap', err);
        return NextResponse.json(
            { success: false, error: 'Error cargando kiosko' },
            { status: 500 },
        );
    }
}
