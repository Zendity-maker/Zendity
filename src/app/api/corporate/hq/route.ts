import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['DIRECTOR', 'ADMIN', 'SUPERVISOR'];
const MULTI_HQ_ROLES = ['DIRECTOR', 'ADMIN'];

/**
 * GET /api/corporate/hq?hqId=X
 * Lista documentos corporativos filtrados por sede.
 *  - SUPERVISOR → solo documentos de su sede
 *  - DIRECTOR/ADMIN → todas las sedes, o filtrar por ?hqId=
 */
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }
        const role = (session.user as any).role;
        if (!ALLOWED_ROLES.includes(role)) {
            return NextResponse.json({ success: false, error: 'Rol no autorizado' }, { status: 403 });
        }
        const sessionHqId = (session.user as any).headquartersId;
        if (!sessionHqId) {
            return NextResponse.json({ success: false, error: 'Usuario sin sede asignada' }, { status: 400 });
        }

        const requestedHqId = request.nextUrl.searchParams.get('hqId');
        let whereClause: any = {};
        if (MULTI_HQ_ROLES.includes(role)) {
            if (requestedHqId && requestedHqId !== 'ALL') {
                whereClause.headquartersId = requestedHqId;
            }
        } else {
            whereClause.headquartersId = sessionHqId;
        }

        const documents = await prisma.corporateDocument.findMany({
            where: whereClause,
            include: { headquarters: true },
            orderBy: { expirationDate: 'asc' }
        });

        // Recalcular estatus al vuelo
        const today = new Date();
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(today.getDate() + 30);

        for (const doc of documents) {
            let newStatus = doc.status;
            if (doc.expirationDate < today) {
                newStatus = 'EXPIRED';
            } else if (doc.expirationDate <= thirtyDaysFromNow) {
                newStatus = 'WARNING';
            } else {
                newStatus = 'ACTIVE';
            }

            if (doc.status !== newStatus) {
                await prisma.corporateDocument.update({
                    where: { id: doc.id },
                    data: { status: newStatus as any }
                });
                doc.status = newStatus as any;
            }
        }

        return NextResponse.json({ success: true, documents });

    } catch (error) {
        console.error("Error fetching corporate docs:", error);
        return NextResponse.json({ success: false, error: "Failed to fetch documents" }, { status: 500 });
    }
}

/**
 * POST /api/corporate/hq
 * Body: { name, type, expirationDate, fileUrl?, hqId }
 *  - SUPERVISOR → hqId debe coincidir con su sede
 *  - DIRECTOR/ADMIN → cualquier sede existente
 */
export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }
        const role = (session.user as any).role;
        if (!ALLOWED_ROLES.includes(role)) {
            return NextResponse.json({ success: false, error: 'Rol no autorizado' }, { status: 403 });
        }
        const sessionHqId = (session.user as any).headquartersId;
        if (!sessionHqId) {
            return NextResponse.json({ success: false, error: 'Usuario sin sede asignada' }, { status: 400 });
        }

        const body = await req.json();

        if (!body.name || !body.type || !body.expirationDate) {
            return NextResponse.json(
                { success: false, error: "Faltan campos obligatorios" },
                { status: 400 }
            );
        }

        // Determinar hqId efectivo
        let effectiveHqId: string;
        if (MULTI_HQ_ROLES.includes(role)) {
            if (!body.hqId) {
                return NextResponse.json(
                    { success: false, error: "Selecciona la sede para el documento" },
                    { status: 400 }
                );
            }
            // Validar que la sede exista
            const hqExists = await prisma.headquarters.findUnique({
                where: { id: body.hqId },
                select: { id: true }
            });
            if (!hqExists) {
                return NextResponse.json(
                    { success: false, error: "Sede no válida" },
                    { status: 400 }
                );
            }
            effectiveHqId = body.hqId;
        } else {
            // SUPERVISOR: fuerza a su propia sede; si mandan otra, bloquea
            if (body.hqId && body.hqId !== sessionHqId) {
                return NextResponse.json(
                    { success: false, error: "No puedes subir documentos a otra sede" },
                    { status: 403 }
                );
            }
            effectiveHqId = sessionHqId;
        }

        const doc = await prisma.corporateDocument.create({
            data: {
                headquartersId: effectiveHqId,
                type: body.type,
                name: body.name,
                expirationDate: new Date(body.expirationDate),
                fileUrl: body.fileUrl || "/dummy-pdf.pdf"
            }
        });

        return NextResponse.json({ success: true, document: doc });
    } catch (error) {
        console.error("Error creating corporate doc:", error);
        return NextResponse.json({ success: false, error: "Failed to create document" }, { status: 500 });
    }
}
