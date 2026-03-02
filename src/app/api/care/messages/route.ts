import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// REVISAR BANDEJA CENTRALIZADA (B2B Staff)
export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);

        if (!session || session.user.role === "FAMILY") {
            return NextResponse.json({ success: false, error: "Unauthorized access" }, { status: 401 });
        }

        const headquarterId = session.user.headquartersId;

        // Extraer todos los hilos de los residentes activos en esta clínica
        const dbMessages = await prisma.familyMessage.findMany({
            where: {
                patient: { headquartersId: headquarterId }
            },
            include: {
                patient: true,
            },
            orderBy: { createdAt: 'desc' }
        });

        // Filtrar residentes que actualmente tienen mensajes
        type ThreadMap = {
            [key: string]: {
                patient: { id: string; name: string; room: string | null; zone: string };
                messages: any[];
                unreadCount: number;
            };
        };

        const patientConversationsMap = dbMessages.reduce((acc: ThreadMap, msg) => {
            if (!acc[msg.patientId]) {
                acc[msg.patientId] = {
                    patient: {
                        id: msg.patient.id,
                        name: msg.patient.name,
                        room: msg.patient.roomNumber,
                        zone: msg.patient.colorGroup
                    },
                    messages: [],
                    unreadCount: 0
                };
            }
            acc[msg.patientId].messages.unshift(msg);
            if (msg.senderType === 'FAMILY' && !msg.isRead) {
                acc[msg.patientId].unreadCount++;
            }
            return acc;
        }, {} as ThreadMap);

        const activeThreads = Object.values(patientConversationsMap)
            .sort((a, b) => b.unreadCount - a.unreadCount);

        return NextResponse.json({ success: true, threads: activeThreads });
    } catch (error) {
        console.error("Care Messages GET Error:", error);
        return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
    }
}

// RESPONDER UN MENSAJE (B2B Staff)
export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);

        if (!session || session.user.role === "FAMILY") {
            return NextResponse.json({ success: false, error: "Unauthorized access" }, { status: 401 });
        }

        const { patientId, content } = await req.json();

        if (!content || !patientId) return NextResponse.json({ success: false, error: "Missing payload" }, { status: 400 });

        // Marcar mensajes del hilo familiar como leídos, si los hay
        await prisma.familyMessage.updateMany({
            where: { patientId, senderType: 'FAMILY', isRead: false },
            data: { isRead: true }
        });

        // Escribir la respuesta oficial del equipo clínico
        const newMessage = await prisma.familyMessage.create({
            data: {
                patientId,
                senderType: 'STAFF',
                senderId: session.user.id,
                content
            }
        });

        return NextResponse.json({ success: true, message: newMessage });
    } catch (error) {
        console.error("Care Messages POST Error:", error);
        return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
    }
}
