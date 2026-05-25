import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';



export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user || !['ADMIN', 'DIRECTOR'].includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const hqId = (session.user as any).headquartersId;
        const hq = await prisma.headquarters.findUnique({
            where: { id: hqId },
            select: { logoUrl: true, name: true, familyWhatsAppNumber: true }
        });

        return NextResponse.json({ success: true, hq });
    } catch (error) {
        return NextResponse.json({ success: false, error: 'Failed' }, { status: 500 });
    }
}

// Guard de tamaño: el logo se reenvía en cada carga del portal familiar.
// 400KB de string base64 ≈ 300KB de imagen raw. Más que suficiente para un logo h-8.
const MAX_LOGO_PAYLOAD_BYTES = 400 * 1024;

export async function PATCH(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user || !['ADMIN', 'DIRECTOR'].includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { logoUrl, familyWhatsAppNumber } = body;
        const hqId = (session.user as any).headquartersId;

        if (typeof logoUrl === 'string' && logoUrl.length > MAX_LOGO_PAYLOAD_BYTES) {
            return NextResponse.json(
                {
                    success: false,
                    error: `Logo demasiado grande (${Math.round(logoUrl.length / 1024)}KB). Máximo ${Math.round(MAX_LOGO_PAYLOAD_BYTES / 1024)}KB. Redimensiona o usa una URL externa.`,
                },
                { status: 413 }
            );
        }

        // Normalizar WhatsApp number: trim + acepta vacío como null (limpiar el campo).
        // Validación liviana: caracteres permitidos para teléfonos internacionales.
        let waNumber: string | null | undefined = undefined;
        if (typeof familyWhatsAppNumber === 'string') {
            const trimmed = familyWhatsAppNumber.trim();
            waNumber = trimmed.length === 0 ? null : trimmed;
            if (waNumber && !/^[+()\-.\d\s]{6,30}$/.test(waNumber)) {
                return NextResponse.json(
                    { success: false, error: 'Número de WhatsApp inválido. Usa formato internacional, ej: +1 787-414-6858' },
                    { status: 400 }
                );
            }
        }

        // Update parcial — solo los campos enviados (undefined los ignora Prisma).
        const updatedHq = await prisma.headquarters.update({
            where: { id: hqId },
            data: {
                ...(logoUrl !== undefined ? { logoUrl } : {}),
                ...(waNumber !== undefined ? { familyWhatsAppNumber: waNumber } : {}),
            },
            select: { logoUrl: true, familyWhatsAppNumber: true },
        });

        return NextResponse.json({ success: true, ...updatedHq });
    } catch (error) {
        return NextResponse.json({ success: false, error: 'Failed' }, { status: 500 });
    }
}
