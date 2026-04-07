import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ success: false }, { status: 401 });

        const { notificationIds } = await req.json();
        await prisma.notification.updateMany({
            where: {
                id: { in: notificationIds },
                userId: session.user.id
            },
            data: { isRead: true }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Mark read error:', error);
        return NextResponse.json({ success: false });
    }
}
