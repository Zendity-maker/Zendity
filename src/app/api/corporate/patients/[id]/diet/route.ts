import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function PUT(
    req: Request,
    { params }: { params: { id: string } }
) {
    try {
        const { diet } = await req.json();

        if (!diet) {
            return NextResponse.json({ success: false, error: "Dieta no fue proveída" }, { status: 400 });
        }

        const patient = await prisma.patient.update({
            where: { id: params.id },
            data: { diet }
        });

        return NextResponse.json({ success: true, patient });
    } catch (error: any) {
        console.error("Error actualizando dieta:", error);
        return NextResponse.json({ success: false, error: "Error interno del servidor" }, { status: 500 });
    }
}
