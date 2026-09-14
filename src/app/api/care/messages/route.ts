import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from '@/lib/prisma';



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
            /**
             * SOLO LOS CUATRO CAMPOS QUE LA PANTALLA PINTA.
             *
             * Antes era `patient: true`, el expediente ENTERO, y además viajaba
             * repetido dentro de cada mensaje (ver el `unshift` de abajo).
             * Medido el 13-sep-2026: 97 mensajes de 17 residentes que se
             * llevaban por delante `ssnLastFour` en 12, la póliza del seguro en
             * 16, y la cuota mensual y la fecha de nacimiento en los 17.
             *
             * Y lo pedía cualquiera: el único gate es "no seas FAMILY", o sea
             * 20 de los 21 usuarios activos de Cupey — cocina, mantenimiento y
             * el inversionista incluidos. Nada de eso hace falta para pintar un
             * hilo de mensajes con la familia.
             */
            include: {
                patient: { select: { id: true, name: true, roomNumber: true, colorGroup: true } },
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
            // El residente ya va en la cabecera del hilo; dentro de cada mensaje
            // sobra. Iba repetido tantas veces como mensajes tuviera el hilo.
            const { patient: _residente, ...mensaje } = msg;
            acc[msg.patientId].messages.unshift(mensaje);
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
