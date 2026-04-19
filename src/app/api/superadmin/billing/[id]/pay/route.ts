import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSuperAdmin } from '@/lib/admin-auth';


export const dynamic = 'force-dynamic';

export async function PATCH(request: Request, context: any) {
    const guard = await requireSuperAdmin();
    if (!guard.ok) return guard.response;
    try {
        const { id } = await context.params;

        if (!id) {
            return NextResponse.json({ success: false, error: 'Missing invoice id' }, { status: 400 });
        }

        const updatedInvoice = await prisma.saaSInvoice.update({
            where: { id },
            data: {
                status: 'PAID',
                paidAt: new Date()
            }
        });

        return NextResponse.json({ success: true, invoice: updatedInvoice });

    } catch (error: any) {
        console.error("Error marking SaaS invoice as paid:", error);
        return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
