import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateReceiptPDF } from '@/lib/receipt-pdf';
import { logError } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/family/billing/[id]/receipt-pdf
 *
 * El familiar descarga su propio recibo. Verifica:
 *   - Sesión FAMILY válida
 *   - El familyMember pertenece al paciente de la factura
 *   - La factura está PAID
 *   - Mismo HQ (defensa multi-tenant)
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const session = await getServerSession(authOptions);
        if (!session || (session.user as any).role !== 'FAMILY') {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }

        const familyMember = await prisma.familyMember.findUnique({
            where: { email: session.user?.email as string },
            select: { patientId: true, headquartersId: true },
        });
        if (!familyMember?.patientId) {
            return NextResponse.json({ success: false, error: 'Cuenta no vinculada' }, { status: 404 });
        }

        const inv = await prisma.invoice.findFirst({
            where: {
                id,
                patientId: familyMember.patientId,
                headquartersId: familyMember.headquartersId,
            },
            include: {
                items: true,
                patient: { select: { name: true, roomNumber: true, primaryFamilyMember: { select: { name: true } } } },
                headquarters: { select: { name: true, phone: true } },
            },
        });
        if (!inv) return NextResponse.json({ success: false, error: 'Factura no encontrada' }, { status: 404 });
        if (inv.status !== 'PAID' || !inv.paidAt) {
            return NextResponse.json({ success: false, error: 'El recibo aún no está disponible' }, { status: 409 });
        }

        const pdfBuffer = generateReceiptPDF({
            hqName: inv.headquarters?.name || 'Sede',
            hqPhone: inv.headquarters?.phone || null,
            invoiceNumber: inv.invoiceNumber,
            issueDate: inv.issueDate,
            paidAt: inv.paidAt,
            paymentMethod: inv.paymentMethod || 'OTHER',
            referenceNumber: inv.referenceNumber,
            patientName: inv.patient?.name || 'Residente',
            patientRoom: inv.patient?.roomNumber || null,
            familyName: inv.patient?.primaryFamilyMember?.name || null,
            items: inv.items.map(i => ({
                description: i.description,
                quantity: i.quantity,
                unitPrice: i.unitPrice,
                totalPrice: i.totalPrice,
            })),
            subtotal: inv.subtotal,
            totalAmount: inv.totalAmount,
            notes: inv.notes,
        });

        return new NextResponse(pdfBuffer as any, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="Recibo_${inv.invoiceNumber}.pdf"`,
                'Cache-Control': 'no-store',
            },
        });
    } catch (err: any) {
        logError('family.billing.receipt-pdf', err);
        return NextResponse.json({ success: false, error: 'Error generando PDF' }, { status: 500 });
    }
}
