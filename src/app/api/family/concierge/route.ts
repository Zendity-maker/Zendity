import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user || !session.user.email) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const familyMember = await prisma.familyMember.findUnique({
            where: { email: session.user.email },
            include: { patient: true }
        });

        if (!familyMember) {
            return NextResponse.json({ success: false, error: 'Family member not found' }, { status: 404 });
        }

        // Obtener todos los productos y servicios activos de la misma sede
        const [products, services] = await Promise.all([
            prisma.conciergeProduct.findMany({
                where: { headquartersId: familyMember.headquartersId, isActive: true },
                orderBy: { category: 'asc' }
            }),
            prisma.conciergeService.findMany({
                where: { headquartersId: familyMember.headquartersId, isActive: true },
                orderBy: { category: 'asc' }
            })
        ]);

        return NextResponse.json({
            success: true,
            products,
            services,
            balance: familyMember.patient.conciergeBalance || 0.0
        });

    } catch (error: any) {
        console.error("Error fetching Concierge items:", error);
        return NextResponse.json({ success: false, error: 'Failed to fetch catalog' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user || !session.user.email) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const familyMember = await prisma.familyMember.findUnique({
            where: { email: session.user.email },
            include: { patient: true }
        });

        if (!familyMember) {
            return NextResponse.json({ success: false, error: 'Family profile not found' }, { status: 404 });
        }

        const body = await request.json();
        const { type, id, price } = body;

        // 1. Validar que tiene saldo suficiente (a menos que esté comprando una recarga/GiftCard)
        const isGiftCard = type === 'product' && id; // Necesitamos buscar el producto para saber si es GiftCard

        let itemCategory = "";
        let itemName = "";

        if (type === 'product') {
            const prod = await prisma.conciergeProduct.findUnique({ where: { id } });
            if (!prod) return NextResponse.json({ success: false, error: 'Producto no encontrado' }, { status: 404 });
            itemCategory = prod.category;
            itemName = prod.name;

            if (itemCategory !== 'GiftCards' && familyMember.patient.conciergeBalance < price) {
                return NextResponse.json({ success: false, error: 'Saldo Insuficiente. Adquiere una Gift Card para recargar.' }, { status: 400 });
            }
            if (itemCategory !== 'GiftCards' && prod.stock <= 0) {
                return NextResponse.json({ success: false, error: 'Producto agotado temporalmente.' }, { status: 400 });
            }
        } else {
            const serv = await prisma.conciergeService.findUnique({ where: { id } });
            if (!serv) return NextResponse.json({ success: false, error: 'Servicio no encontrado' }, { status: 404 });
            itemName = serv.name;

            if (familyMember.patient.conciergeBalance < price) {
                return NextResponse.json({ success: false, error: 'Saldo Insuficiente. Adquiere una Gift Card para recargar.' }, { status: 400 });
            }
        }

        // ==========================================
        // TRANSACTION START
        // ==========================================
        await prisma.$transaction(async (tx) => {

            // CASO A: RECARGA DE SALDO (COMPRA DE GIFT CARD)
            if (type === 'product' && itemCategory === 'GiftCards') {

                // 1. Agregar el saldo ficticio al residente
                await tx.patient.update({
                    where: { id: familyMember.patientId },
                    data: { conciergeBalance: { increment: price } }
                });

                // 2. Buscar si hay un Invoice PENDIENTE de este mes.
                // Si no hay, crear uno nuevo para fin de mes.
                const startOfMonth = new Date();
                startOfMonth.setDate(1);
                startOfMonth.setHours(0, 0, 0, 0);

                let currentInvoice = await tx.invoice.findFirst({
                    where: {
                        patientId: familyMember.patientId,
                        status: 'PENDING',
                        issueDate: { gte: startOfMonth }
                    }
                });

                if (!currentInvoice) {
                    // Generar Factura comodín
                    currentInvoice = await tx.invoice.create({
                        data: {
                            headquartersId: familyMember.headquartersId,
                            patientId: familyMember.patientId,
                            invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
                            issueDate: new Date(),
                            dueDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 5), // El 5 del prox mes
                            status: 'PENDING',
                            notes: 'Generada automáticamente por recargas de saldo (Concierge Marketplace)'
                        }
                    });
                }

                // 3. Añadir el Item ("Cargar a la habitación")
                await tx.invoiceItem.create({
                    data: {
                        invoiceId: currentInvoice.id,
                        description: `Recarga de Saldo Concierge: ${itemName}`,
                        quantity: 1,
                        unitPrice: price,
                        totalPrice: price
                    }
                });

                // 4. Actualizar totales del Invoice
                await tx.invoice.update({
                    where: { id: currentInvoice.id },
                    data: {
                        subtotal: { increment: price },
                        totalAmount: { increment: price } // Simplificando tax por ahora
                    }
                });

            }
            // CASO B: COMPRA DE PRODUCTO REGULAR
            else if (type === 'product') {
                // Descontar saldo
                await tx.patient.update({
                    where: { id: familyMember.patientId },
                    data: { conciergeBalance: { decrement: price } }
                });

                // Crear Orden
                await tx.conciergeOrder.create({
                    data: {
                        patientId: familyMember.patientId,
                        productId: id,
                        orderedById: familyMember.id,
                        totalPrice: price,
                        status: 'PENDING'
                    }
                });

                // Restar inventario
                await tx.conciergeProduct.update({
                    where: { id },
                    data: { stock: { decrement: 1 } }
                });
            }
            // CASO C: RESERVA DE SERVICIO (TERAPIA/BELLEZA)
            else if (type === 'service') {
                // Descontar saldo
                await tx.patient.update({
                    where: { id: familyMember.patientId },
                    data: { conciergeBalance: { decrement: price } }
                });

                // Crear Cita
                await tx.conciergeAppointment.create({
                    data: {
                        patientId: familyMember.patientId,
                        serviceId: id,
                        status: 'SCHEDULED'
                    }
                });
            }
        });

        return NextResponse.json({ success: true, message: 'Operación completada con éxito' });

    } catch (error: any) {
        console.error("Transaction Error:", error);
        return NextResponse.json({ success: false, error: 'Hubo un problema al procesar su solicitud.' }, { status: 500 });
    }
}
