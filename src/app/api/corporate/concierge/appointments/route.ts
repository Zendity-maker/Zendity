import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { PrismaClient, AppointmentStatus } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user || !['ADMIN', 'DIRECTOR', 'SUPERVISOR', 'NURSE'].includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const hqId = (session.user as any).headquartersId;

        const appointments = await prisma.conciergeAppointment.findMany({
            where: {
                patient: { headquartersId: hqId }
            },
            include: {
                patient: { select: { name: true, roomNumber: true } },
                service: { select: { name: true, category: true, providerType: true } },
                specialist: { select: { name: true, role: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        // Traer lista de staff que puede ser asignado (Enfermeros, Directores, Especialistas)
        const availableStaff = await prisma.user.findMany({
            where: {
                headquartersId: hqId,
                role: { in: ['NURSE', 'THERAPIST', 'BEAUTY_SPECIALIST', 'CAREGIVER'] }
            },
            select: { id: true, name: true, role: true }
        });

        return NextResponse.json({ success: true, appointments, availableStaff });
    } catch (error: any) {
        console.error("Error fetching Concierge Appointments:", error);
        return NextResponse.json({ success: false, error: 'Failed' }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user || !['ADMIN', 'DIRECTOR', 'NURSE'].includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { appointmentId, status, specialistId } = body;

        const appt = await prisma.conciergeAppointment.findUnique({
            where: { id: appointmentId },
            include: { patient: true, service: true, specialist: true }
        });

        if (!appt) return NextResponse.json({ success: false, error: 'Cita no encontrada' }, { status: 404 });

        await prisma.$transaction(async (tx) => {

            let updatedAppt = await tx.conciergeAppointment.update({
                where: { id: appointmentId },
                data: {
                    status: status || appt.status,
                    specialistId: specialistId !== undefined ? specialistId : appt.specialistId
                },
                include: { specialist: true, service: true }
            });

            // 1. REEMBOLSO (Si se cancela y no había empezado)
            if (status === 'CANCELLED' && appt.status === 'SCHEDULED') {
                await tx.patient.update({
                    where: { id: appt.patientId },
                    data: { conciergeBalance: { increment: appt.service.price } }
                });

                await tx.familyMessage.create({
                    data: {
                        patientId: appt.patientId,
                        senderType: 'SYSTEM',
                        senderId: 'SYSTEM',
                        content: `La terapia de ${appt.service.name} ha sido retirada de la agenda. El reembolso fue procesado y su saldo ha sido restaurado.`
                    }
                });
            }

            // 2. ALERTAS AUTOMÁTICAS (UX B2C) - Cuando inicia
            if (status === 'IN_PROGRESS' && appt.status !== 'IN_PROGRESS') {
                const specName = updatedAppt.specialist?.name || 'Nuestro equipo';
                const sType = updatedAppt.service.category.toLowerCase() === 'belleza' ? 'especialista' : 'terapista';

                await tx.familyMessage.create({
                    data: {
                        patientId: appt.patientId,
                        senderType: 'SYSTEM',
                        senderId: 'SYSTEM',
                        content: `🩺 ¡Excelentes noticias!\n${specName} (${sType}) va en camino a la habitación para comenzar la sesión de ${appt.service.name}.`
                    }
                });
            }
        });

        return NextResponse.json({ success: true, message: 'Cita actualizada' });
    } catch (error: any) {
        console.error("Error updating Concierge Appointment:", error);
        return NextResponse.json({ success: false, error: 'Failed' }, { status: 500 });
    }
}
