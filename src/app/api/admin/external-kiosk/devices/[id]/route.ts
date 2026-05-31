import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { logError } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * DELETE /api/admin/external-kiosk/devices/[id]
 *
 * Revoca una tablet: isActive=false, revokedAt=now. NO borra el row (conserva
 * audit trail de visitas registradas con ese device). Tras revocar, el kiosko
 * en la tablet devuelve 401 al siguiente request y el visitante verá el
 * mensaje "Tablet revocada".
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const auth = await requireRole(['DIRECTOR', 'ADMIN']);
        if (auth instanceof NextResponse) return auth;

        const existing = await prisma.externalKioskDevice.findFirst({
            where: { id, headquartersId: auth.headquartersId },
        });
        if (!existing) return NextResponse.json({ success: false, error: 'Tablet no encontrada' }, { status: 404 });

        await prisma.externalKioskDevice.update({
            where: { id },
            data: { isActive: false, revokedAt: new Date() },
        });
        return NextResponse.json({ success: true, message: 'Tablet revocada' });
    } catch (err: any) {
        logError('admin.external-kiosk.devices.delete', err);
        return NextResponse.json({ success: false, error: 'Error revocando' }, { status: 500 });
    }
}
