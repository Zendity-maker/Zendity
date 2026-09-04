/**
 * REGISTRO DE SALIDA EN EL KIOSCO DE RECEPCIÓN
 * ────────────────────────────────────────────
 * Cierra la visita: pone `departedAt` en la entrada abierta del visitante.
 *
 * Un registro de visitas con solo la entrada no responde a la pregunta para la
 * que existe —quién está dentro del edificio ahora mismo—, que es la que
 * importa en una evacuación.
 *
 * POR QUÉ EL VISITANTE ESCRIBE SU NOMBRE Y NO ELIGE DE UNA LISTA.
 * Enseñar en la tablet del lobby las visitas abiertas sería enseñarle a
 * cualquiera que pase quién está en el edificio y a quién vino a ver. Se pide
 * el nombre y solo se devuelve lo que coincide: quien no sabe a quién busca,
 * no ve nada.
 *
 * NO SE INVENTAN SALIDAS. Si alguien se va sin registrarse, su visita queda
 * abierta y la bitácora la muestra como "sin registrar". Rellenar la hora por
 * nuestra cuenta en un documento que se firma sería falsearlo; el hueco visible
 * es información, y alguien puede actuar sobre él.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireKioskDevice, touchKioskDevice } from '@/lib/external-kiosk-auth';

export const dynamic = 'force-dynamic';

/** Visitas abiertas de HOY que coinciden con el nombre. Nunca la lista entera. */
export async function GET(req: Request) {
    const device = await requireKioskDevice(req);
    if (device instanceof NextResponse) return device;

    try {
        const nombre = (new URL(req.url).searchParams.get('nombre') || '').trim();
        if (nombre.length < 3) {
            return NextResponse.json({ success: true, visitas: [] });
        }

        const inicioDelDia = new Date();
        inicioDelDia.setHours(0, 0, 0, 0);

        const visitas = await prisma.familyVisit.findMany({
            where: {
                headquartersId: device.headquartersId,
                departedAt: null,
                visitedAt: { gte: inicioDelDia },
                visitorName: { contains: nombre, mode: 'insensitive' },
            },
            select: { id: true, visitorName: true, residentName: true, visitedAt: true },
            orderBy: { visitedAt: 'desc' },
            take: 5,
        });

        return NextResponse.json({ success: true, visitas });
    } catch (error) {
        console.error('Reception salida GET error:', error);
        return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const device = await requireKioskDevice(req);
    if (device instanceof NextResponse) return device;

    try {
        const { visitId } = await req.json();
        if (!visitId) {
            return NextResponse.json({ success: false, error: 'Falta la visita' }, { status: 400 });
        }

        const inicioDelDia = new Date();
        inicioDelDia.setHours(0, 0, 0, 0);

        // La sede y el "sigue abierta" van en el WHERE del update, no se
        // comprueban antes: así no hay ventana entre leer y escribir, y una
        // visita de otra sede simplemente no encuentra fila.
        const { count } = await prisma.familyVisit.updateMany({
            where: {
                id: visitId,
                headquartersId: device.headquartersId,
                departedAt: null,
                visitedAt: { gte: inicioDelDia },
            },
            data: { departedAt: new Date() },
        });

        if (count === 0) {
            return NextResponse.json(
                { success: false, error: 'Esa visita ya se cerró o no es de hoy.' },
                { status: 404 },
            );
        }

        touchKioskDevice(device.id);

        const visita = await prisma.familyVisit.findUnique({
            where: { id: visitId },
            select: { visitorName: true, residentName: true, visitedAt: true, departedAt: true },
        });

        return NextResponse.json({ success: true, visita });
    } catch (error) {
        console.error('Reception salida POST error:', error);
        return NextResponse.json(
            { success: false, error: 'No se pudo registrar la salida. Avisa al personal.' },
            { status: 500 },
        );
    }
}
