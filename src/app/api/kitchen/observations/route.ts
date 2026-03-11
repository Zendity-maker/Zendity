import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { headquartersId, supervisorId, satisfactionScore, comments, photoUrl } = body;

        if (!headquartersId || !supervisorId || !satisfactionScore || !comments) {
            return NextResponse.json({ success: false, error: "Faltan campos obligatorios" }, { status: 400 });
        }

        const observation = await prisma.kitchenObservation.create({
            data: {
                headquartersId,
                supervisorId,
                satisfactionScore: parseInt(satisfactionScore, 10),
                comments,
                photoUrl: photoUrl || null,
            },
            include: { supervisor: { select: { name: true } } }
        });

        return NextResponse.json({ success: true, observation });

    } catch (error: any) {
        console.error("Kitchen Observation API Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
