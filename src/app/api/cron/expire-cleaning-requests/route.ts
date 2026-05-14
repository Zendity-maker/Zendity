import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

// Cron: marca como EXPIRED las cleaningRequest cuyo SLA (45 min) venció.
// Antes esto vivía como side-effect dentro del GET de /api/cleaning/requests
// — lo movimos aquí para que el GET sea idempotente y no genere writes.
// Schedule: cada 5 minutos (ver vercel.json).
export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const now = new Date();
        const result = await prisma.cleaningRequest.updateMany({
            where: {
                status: { in: ['PENDING', 'IN_PROGRESS'] },
                expiresAt: { lt: now },
            },
            data: { status: 'EXPIRED' },
        });

        return NextResponse.json({
            success: true,
            expiredCount: result.count,
            ranAt: now.toISOString(),
        });
    } catch (error) {
        console.error('[CRON expire-cleaning-requests] Error:', error);
        return NextResponse.json(
            { success: false, error: 'Error expirando solicitudes' },
            { status: 500 }
        );
    }
}
