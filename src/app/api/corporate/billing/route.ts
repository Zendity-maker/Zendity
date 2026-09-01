import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { billableResidentsWhere } from '@/lib/billable-residents';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';



export async function GET(req: Request) {
    try {
        const auth = await requireRole(['ADMIN', 'DIRECTOR']);
        if (auth instanceof NextResponse) return auth;

        const headquartersId = auth.headquartersId;

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

        // Required for the UI Dropdown "Emitir Recibo".
        // Incluye TEMPORARY_LEAVE: un residente hospitalizado sigue pagando, así
        // que tiene que poder recibir factura manual. Antes solo listaba ACTIVE
        // y por eso no había forma —ni automática ni manual— de facturarle.
        const patients = await prisma.patient.findMany({
            where: billableResidentsWhere(headquartersId),
            // monthlyFee: sin ella el residente NO entra en la generacion del
            // mes, y hasta hoy eso no se veia en ninguna parte. El censo salia
            // con 30 de 34 y nadie sabia por que faltaban cuatro.
            select: { id: true, name: true, roomNumber: true, status: true, monthlyFee: true },
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
        const auth = await requireRole(['ADMIN', 'DIRECTOR']);
        if (auth instanceof NextResponse) return auth;

        const headquartersId = auth.headquartersId;
        const body = await req.json();

        const { patientId, items, dueDate, notes } = body;

        if (!patientId || !items || items.length === 0 || !dueDate) {
            return NextResponse.json({ success: false, error: "Datos incompletos para facturar" }, { status: 400 });
        }

        // Ownership: el patientId viene del body. Sin este chequeo, un DIRECTOR
        // podía emitir una factura contra un residente de OTRA sede pasando su
        // id, y la factura quedaba colgada de su propio headquartersId.
        const target = await prisma.patient.findFirst({
            where: { id: patientId, headquartersId },
            select: { id: true },
        });
        if (!target) {
            return NextResponse.json({ success: false, error: "Residente no encontrado en tu sede" }, { status: 404 });
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
