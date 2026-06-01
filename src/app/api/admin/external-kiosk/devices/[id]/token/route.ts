import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { logError } from '@/lib/logger';
import { SystemAuditAction } from '@prisma/client';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/external-kiosk/devices/[id]/token
 *
 * Re-expone el deviceToken de una tablet que TODAVÍA NO se ha configurado.
 * Use case: el admin creó la tablet, cerró el modal antes de copiar el QR,
 * y necesita re-verlo.
 *
 * SEGURIDAD — ventana de pre-uso únicamente:
 *   - Solo devuelve token si lastSeenAt === null (nunca conectada).
 *   - Si la tablet YA se conectó (ya hay un dispositivo físico con el token
 *     guardado en localStorage), devuelve 410 GONE. No queremos que el
 *     dashboard permita duplicar el token a otra tablet.
 *   - Cada consulta deja audit log para trazabilidad.
 *
 * Auth: DIRECTOR/ADMIN, hqId desde sesión (tenant guard estricto).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const auth = await requireRole(['DIRECTOR', 'ADMIN']);
        if (auth instanceof NextResponse) return auth;

        const device = await prisma.externalKioskDevice.findFirst({
            where: { id, headquartersId: auth.headquartersId },
            select: {
                id: true,
                label: true,
                floorNumber: true,
                deviceToken: true,
                isActive: true,
                lastSeenAt: true,
                revokedAt: true,
            },
        });

        if (!device) {
            return NextResponse.json({ success: false, error: 'Tablet no encontrada' }, { status: 404 });
        }
        if (!device.isActive || device.revokedAt) {
            return NextResponse.json(
                { success: false, error: 'Tablet revocada. Genera una nueva.' },
                { status: 410 },
            );
        }
        if (device.lastSeenAt !== null) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Esta tablet ya está activa. Por seguridad el token no se vuelve a mostrar. Si necesitas reconfigurar, revoca y crea una nueva.',
                    lastSeenAt: device.lastSeenAt,
                },
                { status: 410 },
            );
        }

        const baseUrl = process.env.NEXTAUTH_URL || 'https://app.zendity.com';
        const setupUrl = `${baseUrl}/external-kiosk/setup?token=${device.deviceToken}`;

        // Audit log: quién pidió re-ver el token y cuándo
        try {
            await prisma.systemAuditLog.create({
                data: {
                    headquartersId: auth.headquartersId,
                    entityName: 'ExternalKioskDevice',
                    entityId: device.id,
                    action: SystemAuditAction.CREATED,
                    performedById: auth.id,
                    payloadChanges: {
                        trigger: 'KIOSK_TOKEN_REVEAL',
                        label: device.label,
                        floor: device.floorNumber,
                    },
                },
            });
        } catch { /* audit best-effort */ }

        return NextResponse.json({
            success: true,
            label: device.label,
            floorNumber: device.floorNumber,
            deviceToken: device.deviceToken,
            setupUrl,
        });
    } catch (err: any) {
        logError('admin.external-kiosk.devices.token', err);
        return NextResponse.json({ success: false, error: 'Error obteniendo token' }, { status: 500 });
    }
}
