import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || (session.user as any).role !== "FAMILY") return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });

        const patientId = session.user.id;

        const messages = await prisma.familyMessage.findMany({
            where: { patientId },
            orderBy: { createdAt: 'asc' }
        });

        return NextResponse.json({ success: true, messages });
    } catch (e) {
        return NextResponse.json({ success: false, error: "Error al cargar mensajes" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || (session.user as any).role !== "FAMILY") return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });

        const patientId = session.user.id;
        const { content } = await req.json();

        if (!content || !content.trim()) {
            return NextResponse.json({ success: false, error: "Mensaje vacío" }, { status: 400 });
        }

        const familyMember = await prisma.familyMember.findUnique({
            where: { email: session.user.email! }
        });

        if (!familyMember) throw new Error("Familiar no encontrado.");

        const newMessage = await prisma.familyMessage.create({
            data: {
                patientId,
                senderType: 'FAMILY',
                senderId: familyMember.id,
                content: content.trim()
            }
        });

        return NextResponse.json({ success: true, message: newMessage });
    } catch (e) {
        return NextResponse.json({ success: false, error: "Error al enviar mensaje" }, { status: 500 });
    }
}
