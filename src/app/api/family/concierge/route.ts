import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { topeDelMes } from '@/lib/concierge';
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
            // Sin prepago no hay saldo que mostrar. Se deja en 0 para no romper
            // el contrato de la pantalla mientras se limpia.
            balance: 0,
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

            // Ya NO se exige saldo previo, ni existe la gift card. Antes habia
            // que recargar antes de comprar: de 33 residentes activos UNO tenia
            // saldo ($20, y era una prueba) y el producto mas barato costaba
            // $32.50. Cero pedidos en toda la historia del modulo.
            if (prod.stock <= 0) {
                return NextResponse.json({ success: false, error: 'Producto agotado temporalmente.' }, { status: 400 });
            }
        } else {
            const serv = await prisma.conciergeService.findUnique({ where: { id } });
            if (!serv) return NextResponse.json({ success: false, error: 'Servicio no encontrado' }, { status: 404 });
            itemName = serv.name;
            itemCategory = serv.category;
            // Los servicios se facturan en la cuenta mensual — no requieren saldo previo
        }

        // Tope mensual por residente. Sin prepago desaparece el freno natural,
        // y esto evita que una familia acumule sin darse cuenta.
        const tope = await topeDelMes(familyMember.patientId);
        if (price > tope.disponible) {
            return NextResponse.json({
                success: false,
                error: `Este mes quedan $${tope.disponible.toFixed(2)} disponibles de un límite de $${tope.tope}. Habla con la administración si necesitas más.`,
            }, { status: 400 });
        }

        await prisma.$transaction(async (tx) => {

            // El CASO A era la recarga de saldo con gift card. Se retira con el
            // paso a post-pago: sin prepago la recarga no tiene funcion y solo
            // anade un concepto que la familia tiene que entender antes de
            // poder pedir nada.
            // ── COMPRA DE PRODUCTO ────────────────────────────────────────────
            if (type === 'product') {
                // Ni se descuenta saldo ni se toca el stock todavia: el pedido
                // queda PENDING hasta que alguien lo apruebe, y se cobra al
                // ENTREGAR. Descontar aqui reservaria producto y dinero por algo
                // que todavia puede rechazarse.
                await tx.conciergeOrder.create({
                    data: {
                        patientId: familyMember.patientId,
                        productId: id,
                        orderedById: familyMember.id,
                        totalPrice: price,
                        status: 'PENDING'
                    }
                });
            }

            // ── CASO C: RESERVA DE SERVICIO CON FECHA → se carga a factura mensual ──
            else if (type === 'service') {
                const scheduledDate = new Date(scheduledAt);

                // YA NO se factura al reservar.
                //
                // De las dos citas que llegaron a existir, una se cancelo sin
                // especialista asignado. Con el cobro al reservar, esa familia
                // habria pagado una barberia que nunca ocurrio y alguien habria
                // tenido que explicarselo y devolverlo. Se cobra al COMPLETAR,
                // en /api/corporate/concierge — asi la factura solo contiene
                // cosas que de verdad pasaron.
                await tx.conciergeAppointment.create({
                    data: {
                        patientId: familyMember.patientId,
                        serviceId: id,
                        scheduledAt: scheduledDate,
                        notes: notes?.trim() || null,
                        // Pendiente de que direccion apruebe y asigne especialista.
                        status: 'PENDING_APPROVAL',
                        // Precio congelado: el del catalogo puede cambiar entre
                        // que la familia pide y que se realiza, y se cobra lo
                        // que se le dijo.
                        agreedPrice: price,
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
