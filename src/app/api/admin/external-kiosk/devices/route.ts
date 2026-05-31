import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { logError } from '@/lib/logger';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/external-kiosk/devices
 * Lista todas las tablets de la sede con su lastSeenAt para que el admin sepa
 * cuáles están vivas.
 *
 * POST /api/admin/external-kiosk/devices
 * Body: { floorNumber, label }
 * Genera deviceToken aleatorio criptográficamente fuerte (32 bytes hex).
 * Devuelve la URL de setup completa para que el admin la abra en la tablet.
 */
export async function GET() {
    try {
        const auth = await requireRole(['DIRECTOR', 'ADMIN']);
        if (auth instanceof NextResponse) return auth;

        const devices = await prisma.externalKioskDevice.findMany({
            where: { headquartersId: auth.headquartersId },
            orderBy: [{ isActive: 'desc' }, { floorNumber: 'asc' }],
            select: {
                id: true,
                floorNumber: true,
                label: true,
                isActive: true,
                lastSeenAt: true,
                createdAt: true,
                revokedAt: true,
                // NO incluir deviceToken aquí — solo se ve una vez al crear
            },
        });
        return NextResponse.json({ success: true, devices });
    } catch (err: any) {
        logError('admin.external-kiosk.devices.get', err);
        return NextResponse.json({ success: false, error: 'Error cargando tablets' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const auth = await requireRole(['DIRECTOR', 'ADMIN']);
        if (auth instanceof NextResponse) return auth;
        const body = await req.json().catch(() => ({}));
        const floorNumber = parseInt(body.floorNumber, 10);
        const label = (body.label || '').toString().trim();

        if (!floorNumber || floorNumber < 1 || !label) {
            return NextResponse.json({ success: false, error: 'floorNumber (≥1) y label requeridos' }, { status: 400 });
        }

        // Token criptográfico fuerte. 32 bytes hex = 64 caracteres.
        const deviceToken = crypto.randomBytes(32).toString('hex');

        const created = await prisma.externalKioskDevice.create({
            data: {
                headquartersId: auth.headquartersId,
                floorNumber,
                label,
                deviceToken,
                isActive: true,
            },
        });

        // Construir URL de setup completa (NEXTAUTH_URL es la base de la app)
        const baseUrl = process.env.NEXTAUTH_URL || 'https://app.zendity.com';
        const setupUrl = `${baseUrl}/external-kiosk/setup?token=${deviceToken}`;

        return NextResponse.json({
            success: true,
            device: {
                id: created.id,
                floorNumber: created.floorNumber,
                label: created.label,
                createdAt: created.createdAt,
            },
            // El token se devuelve UNA SOLA VEZ. Después el admin no puede verlo.
            deviceToken,
            setupUrl,
            message: 'Abre esta URL en la tablet (una sola vez) para configurarla. Después no podrás ver este token de nuevo.',
        });
    } catch (err: any) {
        logError('admin.external-kiosk.devices.post', err);
        return NextResponse.json({ success: false, error: 'Error creando tablet' }, { status: 500 });
    }
}
