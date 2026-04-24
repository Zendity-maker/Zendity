import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from '@/lib/prisma';



const ALLOWED_ROLES = ['DIRECTOR', 'ADMIN', 'SUPERVISOR', 'NURSE'];

// GET — Lista de conversaciones agrupadas por paciente, filtradas por HQ
export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        const role = (session?.user as any)?.role;

        if (!session || !ALLOWED_ROLES.includes(role)) {
            return NextResponse.json({ success: false, error: "No autorizado." }, { status: 401 });
        }

        const hqId = (session.user as any).headquartersId;

        // Obtener todos los pacientes de esta sede con sus mensajes familiares
        const patients = await prisma.patient.findMany({
            where: { headquartersId: hqId, status: 'ACTIVE' },
            select: {
                id: true,
                name: true,
                roomNumber: true,
                familyMessages: {
                    orderBy: { createdAt: 'desc' },
                    take: 50
                }
            }
        });

        // Filtrar solo pacientes con mensajes y construir conversaciones
        const conversations = patients
            .filter(p => p.familyMessages.length > 0)
            .map(p => {
                const unreadCount = p.familyMessages.filter(m => !m.isRead && m.senderType === 'FAMILY').length;
                const lastMessage = p.familyMessages[0]; // ya ordenado desc
                return {
                    patientId: p.id,
                    patientName: p.name,
                    roomNumber: p.roomNumber,
                    unreadCount,
                    lastMessage,
                    // Ordenar mensajes asc para la vista de chat
                    messages: [...p.familyMessages].reverse()
                };
            })
            .sort((a, b) => {
                // Conversaciones con no leídos primero, luego por fecha del último mensaje
                if (b.unreadCount !== a.unreadCount) return b.unreadCount - a.unreadCount;
                return new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime();
            });

        return NextResponse.json({ success: true, conversations });
    } catch (error: any) {
        console.error("[corporate/family-messages GET] Error:", error);
        return NextResponse.json({ success: false, error: "Error al cargar mensajes." }, { status: 500 });
    }
}

// POST — Staff responde a un familiar (por patientId)
export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        const role = (session?.user as any)?.role;

        if (!session || !ALLOWED_ROLES.includes(role)) {
            return NextResponse.json({ success: false, error: "No autorizado." }, { status: 401 });
        }

        const staffUserId = (session.user as any).id;
        const { patientId, content } = await req.json();

        if (!patientId || !content?.trim()) {
            return NextResponse.json({ success: false, error: "Datos incompletos." }, { status: 400 });
        }

        // Verificar que el paciente pertenece a esta sede
        const patient = await prisma.patient.findUnique({
            where: { id: patientId },
            select: { id: true, name: true, headquartersId: true }
        });

        const hqId = (session.user as any).headquartersId;
        if (!patient || patient.headquartersId !== hqId) {
            return NextResponse.json({ success: false, error: "Paciente no encontrado." }, { status: 404 });
        }

        // Marcar todos los mensajes del familiar como leídos al responder
        await prisma.familyMessage.updateMany({
            where: { patientId, senderType: 'FAMILY', isRead: false },
            data: { isRead: true }
        });

        // Crear respuesta del staff
        const reply = await prisma.familyMessage.create({
            data: {
                patientId,
                senderType: 'STAFF',
                senderId: staffUserId,
                content: content.trim(),
                isRead: true // Las respuestas del staff se marcan como leídas de entrada
            }
        });

        // Notificar al familiar (in-app) si tiene usuario registrado — best-effort
        try {
            const familyMembers = await prisma.familyMember.findMany({
                where: { patientId, isRegistered: true },
                select: { email: true }
            });

            for (const fm of familyMembers) {
                const famUser = await prisma.user.findFirst({
                    where: { email: fm.email },
                    select: { id: true }
                });
                if (famUser) {
                    await prisma.notification.create({
                        data: {
                            userId: famUser.id,
                            type: 'FAMILY_VISIT',
                            title: `💬 Respuesta del equipo — ${patient.name}`,
                            message: content.trim().slice(0, 100),
                            isRead: false
                        }
                    });
                }
            }
        } catch (notifErr) {
            console.error("[corporate/family-messages POST] Notification error:", notifErr);
        }

        return NextResponse.json({ success: true, message: reply });
    } catch (error: any) {
        console.error("[corporate/family-messages POST] Error:", error);
        return NextResponse.json({ success: false, error: "Error al enviar respuesta." }, { status: 500 });
    }
}
