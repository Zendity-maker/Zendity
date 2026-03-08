import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
export const dynamic = 'force-dynamic';

export async function PATCH(request: Request, context: { params: { id: string } }) {
    try {
        const { id } = await context.params;

        if (!id) {
            return NextResponse.json({ success: false, error: 'Missing invoice id' }, { status: 400 });
        }

        const updatedInvoice = await prisma.saasInvoice.update({
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
