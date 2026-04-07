import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const token = searchParams.get('token');
        if (!token) return NextResponse.json({ valid: false });

        const fm = await prisma.familyMember.findFirst({
            where: {
                inviteToken: token,
                inviteExpiry: { gt: new Date() },
                isRegistered: false
            },
            select: { id: true, name: true, email: true, patient: { select: { name: true } } }
        });

        if (!fm) return NextResponse.json({ valid: false });
        return NextResponse.json({ valid: true, familyMember: fm });
    } catch {
        return NextResponse.json({ valid: false });
    }
}
