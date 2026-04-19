import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSuperAdmin } from '@/lib/admin-auth';


export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const guard = await requireSuperAdmin();
    if (!guard.ok) return guard.response;
    try {
        const hqs = await prisma.headquarters.findMany({
            select: {
                id: true,
                name: true
            },
            orderBy: {
                name: 'asc'
            }
        });

        return NextResponse.json({ success: true, hqs });
    } catch (error: any) {
        console.error("Error fetching HQs for SuperAdmin:", error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
