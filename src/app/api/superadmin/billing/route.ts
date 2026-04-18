import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';


export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const hqId = searchParams.get('hqId');

        const whereClause = hqId ? { headquartersId: hqId } : {};

        const invoices = await prisma.saaSInvoice.findMany({
            where: whereClause,
            include: {
                headquarters: {
                    select: { name: true, logoUrl: true }
                },
                items: true
            },
            orderBy: {
                issueDate: 'desc'
            }
        });

        return NextResponse.json({ success: true, invoices });
    } catch (error: any) {
        console.error("Error fetching SaaS invoices:", error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { headquartersId, dueDate, items, notes, taxRate } = body;

        if (!headquartersId || !dueDate || !items || !Array.isArray(items) || items.length === 0) {
            return NextResponse.json({ success: false, error: 'Faltan datos requeridos (headquartersId, dueDate, items)' }, { status: 400 });
        }

        // Generate a unique invoice number: ZEN-{YYMM}-{UUID8}
        // Usamos crypto.randomUUID() en vez de Math.random() para evitar
        // enumeración (4 chars base36 ≈ 1.6M combinaciones → vulnerable).
        const shortId = randomUUID().split('-')[0].toUpperCase();
        const mm = String(new Date().getMonth() + 1).padStart(2, '0');
        const yy = String(new Date().getFullYear()).slice(-2);
        const invoiceNumber = `ZEN-${yy}${mm}-${shortId}`;

        // Calculate totals
        const subtotal = items.reduce((acc: number, item: any) => acc + (item.quantity * item.unitPrice), 0);
        const taxVal = taxRate ? (subtotal * (taxRate / 100)) : 0;
        const totalAmount = subtotal + taxVal;

        // Create the invoice and items in a transaction
        const newInvoice = await prisma.saaSInvoice.create({
            data: {
                headquartersId,
                invoiceNumber,
                dueDate: new Date(dueDate),
                subtotal,
                taxRate: taxRate || 0.0,
                totalAmount,
                notes: notes || null,
                items: {
                    create: items.map((item: any) => ({
                        description: item.description,
                        quantity: Number(item.quantity),
                        unitPrice: Number(item.unitPrice),
                        totalPrice: Number(item.quantity) * Number(item.unitPrice)
                    }))
                }
            },
            include: {
                items: true,
                headquarters: true
            }
        });

        return NextResponse.json({ success: true, invoice: newInvoice });

    } catch (error: any) {
        console.error("Error creating SaaS invoice:", error);
        return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
