import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from '@/lib/prisma';



export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);

        if (!session || !['ADMIN', 'DIRECTOR'].includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: "Privilegios insuficientes." }, { status: 403 });
        }

        const hqId = (session.user as any).headquartersId;
        const body = await req.json();

        const invoiceId = body.invoiceId;
        const amount = parseFloat(body.amount);
        const source = body.source || 'PRIVATE';
        const notes = body.notes || '';

        if (!invoiceId || isNaN(amount) || amount <= 0) {
            return NextResponse.json({ success: false, error: "Datos inválidos para el abono." }, { status: 400 });
        }

        // Buscar factura
        const invoice = await prisma.invoice.findUnique({
            where: { id: invoiceId }
        });

        if (!invoice || invoice.headquartersId !== hqId) {
            return NextResponse.json({ success: false, error: "Factura no encontrada." }, { status: 404 });
        }

        if (invoice.status === 'PAID') {
            return NextResponse.json({ success: false, error: "La factura ya está totalmente pagada." }, { status: 400 });
        }

        if (invoice.status === 'CANCELLED') {
            return NextResponse.json({ success: false, error: "La factura está cancelada." }, { status: 400 });
        }

        // Verificar que no se pague más de lo que se debe
        const remainingBalance = invoice.totalAmount - invoice.amountPaid;
        
        // Permite pagar más (tips?) o ajustalo
        // Usaremos el monto íntegro depositado
        const paymentAmount = amount; 

        // Transacción
        const result = await prisma.$transaction(async (tx) => {
            // 1. Crear el registro de abono
            const payment = await tx.invoicePayment.create({
                data: {
                    invoiceId: invoiceId,
                    amount: paymentAmount,
                    source: source,
                    notes: notes
                }
            });

            // 2. Actualizar monto pagado
            const newAmountPaid = invoice.amountPaid + paymentAmount;
            
            // 3. Evaluar nuevo estado
            let newStatus = invoice.status;
            if (newAmountPaid >= invoice.totalAmount) {
                newStatus = 'PAID';
            }

            // 4. Actualizar Factura
            const updatedInvoice = await tx.invoice.update({
                where: { id: invoiceId },
                data: {
                    amountPaid: newAmountPaid,
                    status: newStatus
                }
            });

            return { payment, updatedInvoice };
        });

        return NextResponse.json({ 
            success: true, 
            message: "Abono registrado correctamente.",
            invoice: result.updatedInvoice
        });

    } catch (error) {
        console.error("Error processing payment:", error);
        return NextResponse.json({ success: false, error: "Error de servidor procesando el abono." }, { status: 500 });
    }
}
