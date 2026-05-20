import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/family/unread
 * Retorna el número de mensajes no leídos del staff para el familiar autenticado.
 */
export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session || (session.user as any).role !== "FAMILY") {
            return NextResponse.json({ count: 0 });
        }

        const familyMember = await prisma.familyMember.findUnique({
            where: { email: session.user?.email as string },
            select: { patientId: true },
        });

        if (!familyMember?.patientId) {
            return NextResponse.json({ count: 0 });
        }

        const count = await prisma.familyMessage.count({
            where: {
                patientId: familyMember.patientId,
                senderType: 'STAFF',
                isRead: false,
            },
        });

        return NextResponse.json({ count });
    } catch {
        return NextResponse.json({ count: 0 });
    }
}
