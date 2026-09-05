/**
 * CATÁLOGO DE ENTIDADES QUE DAN SERVICIO AL HOGAR
 * ──────────────────────────────────────────────
 * Lo que el kiosco ofrece cuando alguien se registra como servicio externo.
 *
 * NO ES UN CATÁLOGO NUEVO. `ExternalProvider` y `ExternalServiceCategory` ya
 * existen y Cupey los tiene llenos: 7 categorías y 19 proveedores (Hospicio La
 * Paz, Metro Pavia Home Care, Terapia Física…). Mayagüez no tiene ninguno, y
 * ahí es donde el registro de recepción los va a ir sembrando.
 *
 * El POST añade una entidad que llegó y no estaba. Recepción es la puerta: si
 * alguien se presenta de parte de un hospicio que nadie había registrado, se
 * anota en el momento en vez de perderlo — que es como el catálogo de Cupey
 * acabaría desactualizado.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireKioskDevice } from '@/lib/external-kiosk-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    const device = await requireKioskDevice(req);
    if (device instanceof NextResponse) return device;

    try {
        const categorias = await prisma.externalServiceCategory.findMany({
            where: { headquartersId: device.headquartersId, isActive: true },
            select: {
                id: true, name: true, icon: true,
                providers: {
                    where: { isActive: true },
                    select: { id: true, name: true },
                    orderBy: { name: 'asc' },
                },
            },
            orderBy: { displayOrder: 'asc' },
        });
        return NextResponse.json({ success: true, categorias });
    } catch (error) {
        console.error('Reception entidades error:', error);
        return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const device = await requireKioskDevice(req);
    if (device instanceof NextResponse) return device;

    try {
        const { nombre, categoriaId } = await req.json();
        const limpio = String(nombre ?? '').trim();
        if (!limpio) {
            return NextResponse.json({ success: false, error: 'Falta el nombre de la entidad' }, { status: 400 });
        }

        // La categoría tiene que ser de esta sede. Sin esto, un id de otra sede
        // colgaría un proveedor donde no va.
        const categoria = categoriaId
            ? await prisma.externalServiceCategory.findFirst({
                where: { id: String(categoriaId), headquartersId: device.headquartersId, isActive: true },
                select: { id: true },
            })
            : await prisma.externalServiceCategory.findFirst({
                where: { headquartersId: device.headquartersId, isActive: true },
                orderBy: { displayOrder: 'asc' },
                select: { id: true },
            });

        if (!categoria) {
            return NextResponse.json(
                { success: false, error: 'Esta sede todavía no tiene categorías de servicio configuradas.' },
                { status: 400 },
            );
        }

        // `@@unique([headquartersId, name])`: si ya existe, se devuelve la que
        // hay en vez de reventar. Dos personas del mismo hospicio en el mismo
        // día no pueden crear dos entradas iguales.
        const existente = await prisma.externalProvider.findFirst({
            where: { headquartersId: device.headquartersId, name: limpio },
            select: { id: true, name: true },
        });
        if (existente) return NextResponse.json({ success: true, entidad: existente, yaExistia: true });

        const creada = await prisma.externalProvider.create({
            data: { headquartersId: device.headquartersId, categoryId: categoria.id, name: limpio },
            select: { id: true, name: true },
        });
        return NextResponse.json({ success: true, entidad: creada, yaExistia: false });
    } catch (error) {
        console.error('Reception entidades POST error:', error);
        return NextResponse.json({ success: false, error: 'No se pudo añadir la entidad' }, { status: 500 });
    }
}
