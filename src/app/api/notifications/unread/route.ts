import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ success: false }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const type = searchParams.get('type');

        const where: Record<string, unknown> = {
            userId: session.user.id,
            isRead: false
        };
        if (type) where.type = type;

        const notifications = await prisma.notification.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: 10
        });

        return NextResponse.json({ success: true, notifications });
    } catch (error) {
        console.error('Notifications unread error:', error);
        return NextResponse.json({ success: false, notifications: [] });
    }
}
