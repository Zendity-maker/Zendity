import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const hqId = session.user.headquartersId;

        // Polling optimization: Only grab announcements from the last 15 seconds
        const fifteenSecondsAgo = new Date(Date.now() - 15000);

        const announcements = await prisma.globalAnnouncement.findMany({
            where: {
                headquartersId: hqId,
                createdAt: {
                    gte: fifteenSecondsAgo
                }
            },
            orderBy: {
                createdAt: 'desc'
            },
            take: 1
        });

        // Omit current user's own announcements if desired, but for walkie-talkie it's good to hear confirmation
        // that your broadcast went through.

        if (announcements.length > 0) {
            return NextResponse.json({ success: true, announcement: announcements[0] });
        }

        return NextResponse.json({ success: true, announcement: null });

    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Failed to fetch announcements' }, { status: 500 });
    }
}
