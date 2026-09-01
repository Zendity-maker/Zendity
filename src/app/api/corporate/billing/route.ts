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

        /**
         * Abiertas SIEMPRE; cerradas solo del mes que se pida.
         *
         * Antes traia las 90 sin filtro ni limite. A ~30 facturas al mes eso son
         * 360 en un año y 720 en dos — mismo anti-patron que ya arreglamos en
         * los relevos de turno. Y dos tercios de lo cargado (59 de 90) eran
         * trabajo terminado.
         *
         * Las PENDING y OVERDUE viajan enteras porque son el trabajo del dia y
         * nunca van a ser muchas: son las del mes corriente mas lo que se quedo
         * sin cobrar. Las PAID se piden por mes con ?cerradasDe=YYYY-MM, que es
         * como se buscan: "la de agosto de Fulano".
         */
        const url = new URL(req.url);
        const cerradasDe = url.searchParams.get('cerradasDe');   // YYYY-MM
        let rangoCerradas: { gte: Date; lt: Date } | undefined;
        if (cerradasDe && /^\d{4}-\d{2}$/.test(cerradasDe)) {
            const [a, m] = cerradasDe.split('-').map(Number);
            rangoCerradas = {
                gte: new Date(Date.UTC(a, m - 1, 1)),
                lt: new Date(Date.UTC(a, m, 1)),
            };
        }

        const invoices = await prisma.invoice.findMany({
            where: {
                headquartersId,
                OR: [
                    { status: { in: ['PENDING', 'OVERDUE'] } },
                    rangoCerradas
                        ? { status: 'PAID', issueDate: rangoCerradas }
                        // Sin mes pedido, las cerradas del mes en curso: la
                        // pantalla abre util sin traerse dos años de historia.
                        : { status: 'PAID', issueDate: { gte: new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)) } },
                ],
            },
            include: {
                patient: true,
                items: true,
                headquarters: true
            },
            orderBy: {
                issueDate: 'desc'
            }
        });

        /**
         * Meses que TIENEN cerradas, para el selector. Se cuenta aparte porque
         * la lista de arriba ya no las trae todas — y sin esto el selector no
         * sabria que meses ofrecer.
         */
        const cerradas = await prisma.invoice.findMany({
            where: { headquartersId, status: 'PAID' },
            select: { issueDate: true, totalAmount: true },
        });
        const mesesCerradas = [...cerradas.reduce((m, c) => {
            const k = c.issueDate.toISOString().slice(0, 7);
            const v = m.get(k) ?? { mes: k, n: 0, total: 0 };
            v.n++; v.total += c.totalAmount ?? 0;
            return m.set(k, v);
        }, new Map<string, { mes: string; n: number; total: number }>()).values()]
            .sort((a, b) => b.mes.localeCompare(a.mes));

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

        return NextResponse.json({ success: true, invoices, totalPending, totalPaid, patients, mesesCerradas });
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
