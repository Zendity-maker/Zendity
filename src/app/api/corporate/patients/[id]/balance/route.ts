import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

/**
 * POST /api/corporate/patients/[id]/balance
 * Recarga de saldo Concierge por parte del Director/Admin.
 * Crea un item en la factura mensual del residente.
 */
export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: patientId } = await params;
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

        const role   = (session.user as any).role;
        const hqId   = (session.user as any).headquartersId;
        const userId = (session.user as any).id;

        if (!['DIRECTOR', 'ADMIN'].includes(role)) {
            return NextResponse.json({ error: 'Solo Director o Admin pueden recargar saldo' }, { status: 403 });
        }

        const { amount, note } = await req.json();
        if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
            return NextResponse.json({ error: 'Monto inválido' }, { status: 400 });
        }

        const monto = Number(amount);

        // Verificar que el paciente pertenece a esta sede
        const patient = await prisma.patient.findFirst({
            where: { id: patientId, headquartersId: hqId },
            select: { id: true, name: true, conciergeBalance: true }
        });
        if (!patient) return NextResponse.json({ error: 'Residente no encontrado' }, { status: 404 });

        const hq = await prisma.headquarters.findUnique({ where: { id: hqId }, select: { name: true } });

        await prisma.$transaction(async (tx) => {
            // 1. Incrementar saldo
            await tx.patient.update({
                where: { id: patientId },
                data: { conciergeBalance: { increment: monto } }
            });

            // 2. Añadir a factura mensual
            const startOfMonth = new Date();
            startOfMonth.setDate(1);
            startOfMonth.setHours(0, 0, 0, 0);

            let invoice = await tx.invoice.findFirst({
                where: { patientId, status: 'PENDING', issueDate: { gte: startOfMonth } }
            });

            if (!invoice) {
                invoice = await tx.invoice.create({
                    data: {
                        headquartersId: hqId,
                        patientId,
                        invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
                        issueDate: new Date(),
                        dueDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 5),
                        status: 'PENDING',
                        notes: 'Generada automáticamente — Recarga Concierge Administrativa'
                    }
                });
            }

            await tx.invoiceItem.create({
                data: {
                    invoiceId: invoice.id,
                    description: `Recarga Saldo Concierge${note ? ` — ${note}` : ''} (autorizado por ${hq?.name || 'Dirección'})`,
                    quantity: 1,
                    unitPrice: monto,
                    totalPrice: monto
                }
            });

            await tx.invoice.update({
                where: { id: invoice.id },
                data: { subtotal: { increment: monto }, totalAmount: { increment: monto } }
            });
        });

        // Saldo actualizado
        const updated = await prisma.patient.findUnique({
            where: { id: patientId },
            select: { conciergeBalance: true }
        });

        return NextResponse.json({
            success: true,
            newBalance: updated?.conciergeBalance ?? 0,
            message: `Saldo de ${patient.name} recargado con $${monto.toFixed(2)}`
        });

    } catch (err: any) {
        console.error('[balance PATCH]', err);
        return NextResponse.json({ error: 'Error procesando recarga' }, { status: 500 });
    }
}
