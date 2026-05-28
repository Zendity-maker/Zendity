import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { requireRole } from '@/lib/api-auth';
import { resolveEffectiveHqId } from '@/lib/hq-resolver';
import { prisma } from "@/lib/prisma";

// Lectura del menú — personal que necesita verlo en piso/dirección.
const READ_ROLES = ['KITCHEN', 'ADMIN', 'DIRECTOR', 'SUPERVISOR', 'NURSE'];
// Edición del menú — cocina + dirección.
const WRITE_ROLES = ['KITCHEN', 'ADMIN', 'DIRECTOR'];

/**
 * GET /api/kitchen/menu?hqId=xyz&date=2024-10-25
 *
 * FIX seguridad: antes este endpoint NO verificaba sesión ni rol y tomaba
 * hqId del query string crudo — cualquiera (incluso sin login) podía leer
 * el menú de cualquier sede pasando el hqId. Ahora requiere rol (primary o
 * secondary vía requireRole) y resuelve el hqId efectivo desde la sesión
 * (los roles single-HQ quedan anclados a su sede; solo multi-HQ pueden
 * solicitar otra vía resolveEffectiveHqId).
 */
export async function GET(req: Request) {
    try {
        const auth = await requireRole(READ_ROLES);
        if (auth instanceof NextResponse) return auth;
        const session = await getServerSession(authOptions);

        const { searchParams } = new URL(req.url);
        const dateParam = searchParams.get('date');

        let headquartersId: string;
        try {
            headquartersId = await resolveEffectiveHqId(session!, searchParams.get('hqId'));
        } catch (e: any) {
            return NextResponse.json({ success: false, error: e.message || 'Sede inválida' }, { status: 400 });
        }

        if (!dateParam) {
            return NextResponse.json({ success: false, error: "Falta el parámetro date" }, { status: 400 });
        }

        const date = new Date(dateParam);
        if (isNaN(date.getTime())) {
            return NextResponse.json({ success: false, error: "Fecha inválida" }, { status: 400 });
        }

        const menu = await prisma.dailyMenu.findUnique({
            where: {
                headquartersId_date: {
                    headquartersId,
                    date,
                }
            },
            include: {
                supervisor: {
                    select: { name: true }
                }
            }
        });

        return NextResponse.json({ success: true, menu });
    } catch (error) {
        console.error("GET Kitchen Menu Error:", error);
        return NextResponse.json({ success: false, error: "Fallo al obtener el menú" }, { status: 500 });
    }
}

/**
 * POST /api/kitchen/menu
 * Body: { hqId?, date, breakfast, lunch, dinner, snacks, supervisorNotes }
 *
 * FIX seguridad: antes era escritura SIN auth con hqId del body — cualquiera
 * podía sobreescribir el menú de cualquier sede. Ahora requiere rol de
 * escritura + hqId resuelto desde la sesión. supervisorId se toma del
 * invoker autenticado, no del body (evita suplantación).
 */
export async function POST(req: Request) {
    try {
        const auth = await requireRole(WRITE_ROLES);
        if (auth instanceof NextResponse) return auth;
        const session = await getServerSession(authOptions);

        const body = await req.json();
        const { date: dateParam, breakfast, lunch, dinner, snacks, supervisorNotes } = body;

        let hqId: string;
        try {
            hqId = await resolveEffectiveHqId(session!, body.hqId);
        } catch (e: any) {
            return NextResponse.json({ success: false, error: e.message || 'Sede inválida' }, { status: 400 });
        }

        if (!dateParam) {
            return NextResponse.json({ success: false, error: "date es obligatorio" }, { status: 400 });
        }

        const date = new Date(dateParam);
        if (isNaN(date.getTime())) {
            return NextResponse.json({ success: false, error: "Fecha inválida" }, { status: 400 });
        }

        // supervisorId = invoker autenticado (no del body, para evitar suplantación)
        const supervisorId = auth.id;

        const menu = await prisma.dailyMenu.upsert({
            where: {
                headquartersId_date: {
                    headquartersId: hqId,
                    date,
                }
            },
            update: {
                breakfast,
                lunch,
                dinner,
                snacks,
                supervisorNotes,
                supervisorId,
            },
            create: {
                headquartersId: hqId,
                date,
                breakfast,
                lunch,
                dinner,
                snacks,
                supervisorNotes,
                supervisorId,
            }
        });

        return NextResponse.json({ success: true, menu });
    } catch (error) {
        console.error("POST Kitchen Menu Error:", error);
        return NextResponse.json({ success: false, error: "Fallo al guardar el menú" }, { status: 500 });
    }
}
