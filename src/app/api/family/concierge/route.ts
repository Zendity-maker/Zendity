import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { notifyRoles } from '@/lib/notifications';

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

        // Catálogo + reservas activas del familiar
        let [products, services, myAppointments] = await Promise.all([
            prisma.conciergeProduct.findMany({
                where: { headquartersId: familyMember.headquartersId, isActive: true },
                orderBy: { category: 'asc' }
            }),
            prisma.conciergeService.findMany({
                where: { headquartersId: familyMember.headquartersId, isActive: true },
                orderBy: { category: 'asc' }
            }),
            prisma.conciergeAppointment.findMany({
                where: {
                    patientId: familyMember.patientId,
                    status: { notIn: ['COMPLETED', 'CANCELLED'] },
                },
                include: {
                    service: { select: { name: true, category: true, imageUrl: true } },
                    specialist: { select: { name: true, role: true } },
                },
                orderBy: { scheduledAt: 'asc' },
            }),
        ]);

        // Auto-Seeder: servicios de ejemplo si está vacío
        if (services.length === 0) {
            await prisma.conciergeService.createMany({
                data: [
                    { headquartersId: familyMember.headquartersId, name: 'Fisioterapia Preventiva (8 Sesiones/mes)', price: 320.0, originalPrice: 400.0, isOffer: true, category: 'Salud Holística', providerType: 'THERAPIST', imageUrl: '/images/market/fisioterapia_senior_1774112845841.png' },
                    { headquartersId: familyMember.headquartersId, name: 'Masaje Terapéutico Vivid Relax', price: 80.0, category: 'Salud Holística', providerType: 'THERAPIST', imageUrl: '/images/market/masaje_senior_1774112862519.png' },
                    { headquartersId: familyMember.headquartersId, name: 'Taller Mente Activa (Mensual)', price: 150.0, category: 'Estimulación Cognitiva', providerType: 'SOCIAL_WORKER', imageUrl: '/images/market/taller_cognitivo_senior_1774112875316.png' },
                    { headquartersId: familyMember.headquartersId, name: 'Club Estilismo y Barbería (Mensual)', price: 90.0, category: 'Estética y Cuidado', providerType: 'BEAUTY_SPECIALIST', imageUrl: '/images/market/estilismo_senior_1774112895688.png' },
                    { headquartersId: familyMember.headquartersId, name: 'Experiencia Chef en tu Suite', price: 120.0, category: 'Gourmet y Celebraciones', providerType: 'KITCHEN', imageUrl: '/images/market/chef_suite_1774112910701.png' }
                ]
            });
            services = await prisma.conciergeService.findMany({
                where: { headquartersId: familyMember.headquartersId, isActive: true },
                orderBy: { category: 'asc' }
            });
        }

        return NextResponse.json({
            success: true,
            products,
            services,
            balance: familyMember.patient.conciergeBalance || 0.0,
            myAppointments,
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
        const { type, id, price, scheduledAt, notes } = body;

        // Validar fecha para servicios
        if (type === 'service') {
            if (!scheduledAt) {
                return NextResponse.json({ success: false, error: 'Debes seleccionar una fecha y hora para el servicio.' }, { status: 400 });
            }
            const dateObj = new Date(scheduledAt);
            if (isNaN(dateObj.getTime())) {
                return NextResponse.json({ success: false, error: 'Fecha inválida.' }, { status: 400 });
            }
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (dateObj < today) {
                return NextResponse.json({ success: false, error: 'La fecha no puede ser en el pasado.' }, { status: 400 });
            }
            // Lunes bloqueado
            if (dateObj.getDay() === 1) {
                return NextResponse.json({ success: false, error: 'Los lunes no están disponibles. Elige otro día.' }, { status: 400 });
            }
        }

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
            itemCategory = serv.category;
            // Los servicios se facturan en la cuenta mensual — no requieren saldo previo
        }

        await prisma.$transaction(async (tx) => {

            // ── CASO A: RECARGA DE SALDO (GIFT CARD) ─────────────────────────
            if (type === 'product' && itemCategory === 'GiftCards') {
                await tx.patient.update({
                    where: { id: familyMember.patientId },
                    data: { conciergeBalance: { increment: price } }
                });

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
                    currentInvoice = await tx.invoice.create({
                        data: {
                            headquartersId: familyMember.headquartersId,
                            patientId: familyMember.patientId,
                            invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
                            issueDate: new Date(),
                            dueDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 5),
                            status: 'PENDING',
                            notes: 'Generada automáticamente por recargas de saldo (Concierge Marketplace)'
                        }
                    });
                }

                await tx.invoiceItem.create({
                    data: {
                        invoiceId: currentInvoice.id,
                        description: `Recarga de Saldo Concierge: ${itemName}`,
                        quantity: 1,
                        unitPrice: price,
                        totalPrice: price
                    }
                });

                await tx.invoice.update({
                    where: { id: currentInvoice.id },
                    data: {
                        subtotal: { increment: price },
                        totalAmount: { increment: price }
                    }
                });
            }

            // ── CASO B: COMPRA DE PRODUCTO REGULAR ────────────────────────────
            else if (type === 'product') {
                await tx.patient.update({
                    where: { id: familyMember.patientId },
                    data: { conciergeBalance: { decrement: price } }
                });

                await tx.conciergeOrder.create({
                    data: {
                        patientId: familyMember.patientId,
                        productId: id,
                        orderedById: familyMember.id,
                        totalPrice: price,
                        status: 'PENDING'
                    }
                });

                await tx.conciergeProduct.update({
                    where: { id },
                    data: { stock: { decrement: 1 } }
                });
            }

            // ── CASO C: RESERVA DE SERVICIO CON FECHA → se carga a factura mensual ──
            else if (type === 'service') {
                const scheduledDate = new Date(scheduledAt);

                // Añadir a la factura mensual del residente
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
                    currentInvoice = await tx.invoice.create({
                        data: {
                            headquartersId: familyMember.headquartersId,
                            patientId: familyMember.patientId,
                            invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
                            issueDate: new Date(),
                            dueDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 5),
                            status: 'PENDING',
                            notes: 'Generada automáticamente por servicios Concierge Marketplace'
                        }
                    });
                }

                await tx.invoiceItem.create({
                    data: {
                        invoiceId: currentInvoice.id,
                        description: `Servicio Concierge: ${itemName} — ${scheduledDate.toLocaleDateString('es-PR', { day: '2-digit', month: 'long' })}`,
                        quantity: 1,
                        unitPrice: price,
                        totalPrice: price
                    }
                });

                await tx.invoice.update({
                    where: { id: currentInvoice.id },
                    data: {
                        subtotal: { increment: price },
                        totalAmount: { increment: price }
                    }
                });

                // Crear cita con fecha
                await tx.conciergeAppointment.create({
                    data: {
                        patientId: familyMember.patientId,
                        serviceId: id,
                        scheduledAt: scheduledDate,
                        notes: notes?.trim() || null,
                        status: 'SCHEDULED',
                    }
                });

                // Crear evento en el calendario del hogar
                const endTime = new Date(scheduledDate.getTime() + 60 * 60 * 1000); // +1h por defecto
                await tx.headquartersEvent.create({
                    data: {
                        headquartersId: familyMember.headquartersId,
                        title: `${itemName} — ${familyMember.patient.name}`,
                        description: `Servicio solicitado por familia. Habitación ${familyMember.patient.roomNumber || '—'}.${notes ? ` Nota: ${notes}` : ''}`,
                        type: 'CONCIERGE_SERVICE' as any,
                        startTime: scheduledDate,
                        endTime,
                        patientId: familyMember.patientId,
                        targetPopulation: 'ALL',
                        targetGroups: [],
                        targetPatients: [familyMember.patientId],
                    }
                });

                // Mensaje de confirmación a la familia
                await tx.familyMessage.create({
                    data: {
                        patientId: familyMember.patientId,
                        senderType: 'SYSTEM',
                        senderId: 'SYSTEM',
                        content: `✅ Tu solicitud de *${itemName}* fue registrada para el ${scheduledDate.toLocaleDateString('es-PR', { weekday: 'long', day: '2-digit', month: 'long' })} a las ${scheduledDate.toLocaleTimeString('es-PR', { hour: '2-digit', minute: '2-digit' })}. El cargo de $${price.toFixed(2)} aparecerá en tu próxima factura mensual. El equipo confirmará la asignación del especialista en breve.`,
                    }
                });
            }
        });

        // ── Notificar al staff de la sede (fuera de la transaction) ──────────
        if (type === 'service' && scheduledAt) {
            const serv = await prisma.conciergeService.findUnique({ where: { id } });
            const scheduledDate = new Date(scheduledAt);
            const formattedDate = scheduledDate.toLocaleDateString('es-PR', { weekday: 'long', day: '2-digit', month: 'short' });
            const formattedTime = scheduledDate.toLocaleTimeString('es-PR', { hour: '2-digit', minute: '2-digit' });

            // Notificar al rol del proveedor + supervisores
            const rolesToNotify = ['DIRECTOR', 'ADMIN', 'SUPERVISOR'];
            if (serv?.providerType) rolesToNotify.push(serv.providerType as string);

            await notifyRoles(
                familyMember.headquartersId,
                [...new Set(rolesToNotify)],
                {
                    type: 'CONCIERGE_SERVICE',
                    title: '🛎️ Nueva solicitud de servicio',
                    message: `${familyMember.name} solicitó "${itemName}" para ${familyMember.patient.name} (Hab. ${familyMember.patient.roomNumber || '—'}) el ${formattedDate} a las ${formattedTime}`,
                    link: '/corporate/concierge',
                }
            );
        }

        return NextResponse.json({ success: true, message: 'Operación completada con éxito' });

    } catch (error: any) {
        console.error("Transaction Error:", error);
        return NextResponse.json({ success: false, error: 'Hubo un problema al procesar su solicitud.' }, { status: 500 });
    }
}
