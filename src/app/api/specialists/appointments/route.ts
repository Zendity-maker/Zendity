import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        const role = (session?.user as any)?.role;

        if (!session || (role !== "THERAPIST" && role !== "BEAUTY_SPECIALIST" && role !== "ADMIN")) {
            return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
        }

        const headquartersId = (session.user as any).headquartersId;
        const specialistId = session.user.id;

        // Aquí extraeremos las citas asignadas al especialista conectado o no asignadas de su HQs si es nuevo request (simplificado para MVP: ver todas las citas pendientes de su provider type en el HQ)
        const appointments = await prisma.conciergeAppointment.findMany({
            where: {
                patient: { headquartersId },
                service: { providerType: role } // THERAPIST ve terapias, BEAUTY ve belleza
            },
            include: {
                patient: true,
                service: true
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        return NextResponse.json({ success: true, appointments });

    } catch (e) {
        console.error(e);
        return NextResponse.json({ success: false, error: "Error al cargar citas de especialista" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    // Endpoint para subir evidencias o marcar como completado. Lo agregaremos con validaciones de Salud Detección y subida de URL Photo en el paso Módulo 4.
    try {
        const session = await getServerSession(authOptions);
        const role = (session?.user as any)?.role;
        const authorId = session?.user?.id;

        if (!session || (role !== "THERAPIST" && role !== "BEAUTY_SPECIALIST")) {
            return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
        }

        const { appointmentId, status, notes, evidenceUrl } = await req.json();

        // Si marcan como COMPLETED
        const updated = await prisma.conciergeAppointment.update({
            where: { id: appointmentId },
            data: {
                status,
                notes,
                evidenceUrl,
                specialistId: authorId // Me adjudico el servicio si lo finalicé
            },
            include: { patient: true, service: true }
        });

        // Trigger AUTOMATIZACION ZENDI (Notificación al Familiar): Módulo 4
        if (status === 'COMPLETED') {
            await prisma.familyMessage.create({
                data: {
                    patientId: updated.patientId,
                    senderType: 'SYSTEM',
                    senderId: 'ZENDI_AI',
                    content: `¡Hola! Soy Zendi 🤖. Te informo que ${updated.patient.name} acaba de completar su servicio de "${updated.service.name}". El especialista reportó que todo salió excelente. ${evidenceUrl ? `(Se ha adjuntado una fotografía en nuestro sistema seguro).` : ''}`
                }
            });
        }

        return NextResponse.json({ success: true, appointment: updated });

    } catch (error) {
        return NextResponse.json({ success: false, error: "Error al actualizar cita" }, { status: 500 });
    }
}
