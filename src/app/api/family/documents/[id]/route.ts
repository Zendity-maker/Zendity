import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function GET(req: Request, { params }: { params: { id: string } }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || session.user.role !== "FAMILY") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const document = await prisma.legalDocument.findUnique({
            where: {
                id: params.id,
            }
        });

        if (!document || document.familyMemberId !== session.user.id) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        return NextResponse.json(document);
    } catch (error) {
        console.error("[DOCUMENT_GET]", error);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
