import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Auth helper para el módulo Servicios Externos.
 *
 * El kiosko NO usa sesión de NextAuth — es una tablet en el piso que registra
 * proveedores externos. Auth via header `x-device-token` cuyo valor está en
 * ExternalKioskDevice.deviceToken (configurado una sola vez por el admin).
 *
 * Patrón: validar token → derivar headquartersId + floorNumber. Si revocado o
 * inactivo, 401.
 *
 * Uso típico:
 *   const dev = await requireKioskDevice(req);
 *   if (dev instanceof NextResponse) return dev;
 *   // dev.headquartersId, dev.floorNumber, dev.id están disponibles
 */
export async function requireKioskDevice(req: Request): Promise<
    | { id: string; headquartersId: string; floorNumber: number; label: string }
    | NextResponse
> {
    const token = req.headers.get('x-device-token');
    if (!token) {
        return NextResponse.json(
            { success: false, error: 'Tablet no autorizada. Token de dispositivo requerido.' },
            { status: 401 },
        );
    }

    const device = await prisma.externalKioskDevice.findUnique({
        where: { deviceToken: token },
        select: {
            id: true,
            headquartersId: true,
            floorNumber: true,
            label: true,
            isActive: true,
            revokedAt: true,
        },
    });

    if (!device || !device.isActive || device.revokedAt) {
        return NextResponse.json(
            { success: false, error: 'Tablet revocada. Contacta al administrador.' },
            { status: 401 },
        );
    }

    return {
        id: device.id,
        headquartersId: device.headquartersId,
        floorNumber: device.floorNumber,
        label: device.label,
    };
}

/**
 * Best-effort heartbeat. Actualiza lastSeenAt del device. No bloquea ni lanza
 * si falla — solo loguea. Llamar después de validar token.
 */
export async function touchKioskDevice(deviceId: string): Promise<void> {
    try {
        await prisma.externalKioskDevice.update({
            where: { id: deviceId },
            data: { lastSeenAt: new Date() },
        });
    } catch {
        // best-effort
    }
}
