import { NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";

// GET /api/kitchen/menu?hqId=xyz&date=2024-10-25
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const headquartersId = searchParams.get('hqId');
        const dateParam = searchParams.get('date');

        if (!headquartersId || !dateParam) {
            return NextResponse.json({ success: false, error: "Faltan parámetros requeridos" }, { status: 400 });
        }

        const date = new Date(dateParam);

        // Ensure date is valid
        if (isNaN(date.getTime())) {
            return NextResponse.json({ success: false, error: "Fecha inválida" }, { status: 400 });
        }

        const menu = await prisma.dailyMenu.findUnique({
            where: {
                headquartersId_date: {
                    headquartersId: headquartersId,
                    date: date
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

// POST /api/kitchen/menu
// Body: { hqId, date, breakfast, lunch, dinner, snacks }
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { hqId, date: dateParam, breakfast, lunch, dinner, snacks, supervisorNotes, supervisorId } = body;

        if (!hqId || !dateParam) {
            return NextResponse.json({ success: false, error: "hqId y date son obligatorios" }, { status: 400 });
        }

        const date = new Date(dateParam);

        if (isNaN(date.getTime())) {
            return NextResponse.json({ success: false, error: "Fecha inválida" }, { status: 400 });
        }

        const menu = await prisma.dailyMenu.upsert({
            where: {
                headquartersId_date: {
                    headquartersId: hqId,
                    date: date
                }
            },
            update: {
                breakfast,
                lunch,
                dinner,
                snacks,
                supervisorNotes,
                supervisorId
            },
            create: {
                headquartersId: hqId,
                date: date,
                breakfast,
                lunch,
                dinner,
                snacks,
                supervisorNotes,
                supervisorId
            }
        });

        return NextResponse.json({ success: true, menu });
    } catch (error) {
        console.error("POST Kitchen Menu Error:", error);
        return NextResponse.json({ success: false, error: "Fallo al guardar el menú" }, { status: 500 });
    }
}
