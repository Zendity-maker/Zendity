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
            select: { logoUrl: true, name: true }
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
        const { logoUrl } = body;
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

        const updatedHq = await prisma.headquarters.update({
            where: { id: hqId },
            data: { logoUrl }
        });

        return NextResponse.json({ success: true, logoUrl: updatedHq.logoUrl });
    } catch (error) {
        return NextResponse.json({ success: false, error: 'Failed' }, { status: 500 });
    }
}
