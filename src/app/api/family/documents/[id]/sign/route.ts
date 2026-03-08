import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request, { params }: { params: { id: string } }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || session.user.role !== "FAMILY") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const document = await prisma.legalDocument.findUnique({
            where: { id: params.id }
        });

        if (!document || document.familyMemberId !== session.user.id) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        if (document.status === "SIGNED") {
            return NextResponse.json({ error: "Document already signed" }, { status: 400 });
        }

        const { signatureData } = await req.json();
        if (!signatureData) {
            return NextResponse.json({ error: "Signature data is required" }, { status: 400 });
        }

        const ipAddress = req.headers.get("x-forwarded-for") || req.headers.get("remote-addr") || "unknown";

        // Modificamos el LegalDocument en prisma para sellarlo
        const signedDocument = await prisma.legalDocument.update({
            where: { id: params.id },
            data: {
                status: "SIGNED",
                signatureData: signatureData,
                signedAt: new Date(),
                ipAddress: ipAddress
            }
        });

        return NextResponse.json({ success: true, document: signedDocument });

    } catch (error) {
        console.error("[DOCUMENT_SIGN_POST]", error);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
