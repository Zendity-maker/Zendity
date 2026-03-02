import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
    try {
        const documents = await prisma.corporateDocument.findMany({
            include: { headquarters: true },
            orderBy: { expirationDate: 'asc' }
        });

        // Detectar si hay expiraciones en menos de 30 días para actualizar su Status al vuelo
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
                doc.status = newStatus as any; // update in memory for response
            }
        }

        return NextResponse.json({ success: true, documents });

    } catch (error) {
        console.error("Error fetching corporate docs:", error);
        return NextResponse.json({ success: false, error: "Failed to fetch documents" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();

        // Asignamos al primer HQ existente para el MVP
        const hq = await prisma.headquarters.findFirst();
        if (!hq) {
            return NextResponse.json({ success: false, error: "No headquarters found" }, { status: 400 });
        }

        const doc = await prisma.corporateDocument.create({
            data: {
                headquartersId: hq.id,
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
