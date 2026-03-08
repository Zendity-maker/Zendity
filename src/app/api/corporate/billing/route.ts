import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';

const prisma = new PrismaClient();

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !['ADMIN', 'DIRECTOR'].includes((session.user as any).role)) return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });

        const headquartersId = (session.user as any).headquartersId;

        const invoices = await prisma.invoice.findMany({
            where: { headquartersId },
            include: {
                patient: true,
                items: true,
                headquarters: true
            },
            orderBy: {
                issueDate: 'desc'
            }
        });

        // Calculamos resumen gerencial
        const totalPending = invoices.filter(i => i.status === 'PENDING' || i.status === 'OVERDUE').reduce((acc, curr) => acc + curr.totalAmount, 0);
        const totalPaid = invoices.filter(i => i.status === 'PAID').reduce((acc, curr) => acc + curr.totalAmount, 0);

        // Required for the UI Dropdown "Emitir Recibo"
        const patients = await prisma.patient.findMany({
            where: { headquartersId, status: "ACTIVE" },
            select: { id: true, name: true, roomNumber: true },
            orderBy: { name: 'asc' }
        });

        return NextResponse.json({ success: true, invoices, totalPending, totalPaid, patients });
    } catch (e: any) {
        console.error("DEBUG BILLING GET:", e);
        return NextResponse.json({ success: false, error: "Error al cargar facturación", msg: e.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !['ADMIN', 'DIRECTOR'].includes((session.user as any).role)) return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });

        const headquartersId = (session.user as any).headquartersId;
        const body = await req.json();

        const { patientId, items, dueDate, notes } = body;

        if (!patientId || !items || items.length === 0 || !dueDate) {
            return NextResponse.json({ success: false, error: "Datos incompletos para facturar" }, { status: 400 });
        }

        let subtotal = 0;
        const processedItems = items.map((item: any) => {
            const totalPrice = item.quantity * item.unitPrice;
            subtotal += totalPrice;
            return {
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                totalPrice: totalPrice
            };
        });

        const taxRate = 0;
        const totalAmount = subtotal + (subtotal * taxRate);

        const shortId = crypto.randomUUID().split('-')[0].toUpperCase();
        const invoiceNumber = `INV-${shortId}`;

        const newInvoice = await prisma.invoice.create({
            data: {
                headquartersId,
                patientId,
                invoiceNumber,
                dueDate: new Date(dueDate),
                subtotal,
                taxRate,
                totalAmount,
                status: "PENDING",
                notes,
                items: {
                    create: processedItems
                }
            },
            include: { items: true, patient: true, headquarters: true }
        });

        return NextResponse.json({ success: true, invoice: newInvoice });

    } catch (error) {
        console.error("Create Invoice Error:", error);
        return NextResponse.json({ success: false, error: "Error creando factura" }, { status: 500 });
    }
}
