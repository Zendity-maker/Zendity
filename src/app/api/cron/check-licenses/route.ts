import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { format } from 'date-fns';



// This endpoint is meant to be hit by a Cron Service (like Vercel Cron or GitHub Actions) daily at midnight.
export async function GET(request: Request) {
    // Basic Security (Optional but recommended: Check a Bearer Token or Cron Secret from env)
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ success: false, error: 'Unauthorized Cron Request' }, { status: 401 });
    }

    try {
        const today = new Date();

        // 1. Find all active Headquarters where the licenseExpiry has already passed
        const expiredHqs = await prisma.headquarters.findMany({
            where: {
                licenseActive: true,
                licenseExpiry: {
                    lt: today // Expiry Date is Less Than Today
                }
            }
        });

        if (expiredHqs.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'Cron Completed. No active licenses have expired today.',
                suspendedCount: 0
            });
        }

        // 2. Suspend them
        const hqIdsToSuspend = expiredHqs.map(hq => hq.id);

        await prisma.headquarters.updateMany({
            where: {
                id: { in: hqIdsToSuspend }
            },
            data: {
                licenseActive: false
            }
        });

        // 3. Log results
        const suspendedNames = expiredHqs.map(hq => hq.name);
        console.log(`[CRON/ZENDITY-SAAS] Suspended ${suspendedNames.length} Headquarters due to expired licenses:`, suspendedNames);

        return NextResponse.json({
            success: true,
            message: 'Cron Successfully Suspended Expired Licenses.',
            suspendedCount: suspendedNames.length,
            suspendedTenants: suspendedNames
        });

    } catch (error) {
        console.error('Cron License Check Error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal Server Error while checking licenses' },
            { status: 500 }
        );
    }
}
