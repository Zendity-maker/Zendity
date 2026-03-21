import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const resolvedParams = await params;
        const staffId = resolvedParams.id;
        
        const { photoUrl } = await req.json();

        if (!photoUrl) {
            return NextResponse.json({ success: false, error: "Falta photoUrl" }, { status: 400 });
        }

        const updatedStaff = await prisma.user.update({
            where: { id: staffId },
            data: { photoUrl }
        });

        return NextResponse.json({
            success: true,
            photoUrl: updatedStaff.photoUrl
        });
    } catch (e: any) {
        console.error("Staff Photo Upload Error:", e);
        return NextResponse.json({ success: false, error: "Error interno subiendo la fotografía del empleado." }, { status: 500 });
    }
}
