import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import {  AppointmentStatus } from '@prisma/client';



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

                const fechaCancelada = appt.scheduledAt
                    ? appt.scheduledAt.toLocaleDateString('es-PR', { weekday: 'long', day: '2-digit', month: 'long' })
                    : null;

                await tx.familyMessage.create({
                    data: {
                        patientId: appt.patientId,
                        senderType: 'SYSTEM',
                        senderId: 'SYSTEM',
                        content: `❌ La sesión de ${appt.service.name}${fechaCancelada ? ` del ${fechaCancelada}` : ''} ha sido cancelada. El monto fue reembolsado a tu saldo Concierge.`
                    }
                });
            }

            // 2. CONFIRMACIÓN al asignar especialista
            if (specialistId && specialistId !== appt.specialistId && updatedAppt.specialist) {
                const specName = updatedAppt.specialist.name;
                const fechaStr = appt.scheduledAt
                    ? appt.scheduledAt.toLocaleDateString('es-PR', { weekday: 'long', day: '2-digit', month: 'long' })
                    : 'próximamente';
                const horaStr = appt.scheduledAt
                    ? appt.scheduledAt.toLocaleTimeString('es-PR', { hour: '2-digit', minute: '2-digit' })
                    : '';

                await tx.familyMessage.create({
                    data: {
                        patientId: appt.patientId,
                        senderType: 'SYSTEM',
                        senderId: 'SYSTEM',
                        content: `✅ Tu solicitud de *${appt.service.name}* fue confirmada. ${specName} estará a cargo de la sesión el ${fechaStr}${horaStr ? ` a las ${horaStr}` : ''}. ¡Estamos listos!`
                    }
                });
            }

            // 3. INICIO DE SERVICIO (va en camino)
            if (status === 'IN_PROGRESS' && appt.status !== 'IN_PROGRESS') {
                const specName = updatedAppt.specialist?.name || 'Nuestro equipo';
                const sType = updatedAppt.service.category.toLowerCase().includes('estétic') || updatedAppt.service.category.toLowerCase().includes('belleza') ? 'especialista' : 'terapista';

                await tx.familyMessage.create({
                    data: {
                        patientId: appt.patientId,
                        senderType: 'SYSTEM',
                        senderId: 'SYSTEM',
                        content: `🚶 ¡En camino! ${specName} (${sType}) se dirige a la habitación para comenzar la sesión de ${appt.service.name}.`
                    }
                });
            }

            // 4. SERVICIO COMPLETADO
            if (status === 'COMPLETED' && appt.status !== 'COMPLETED') {
                await tx.familyMessage.create({
                    data: {
                        patientId: appt.patientId,
                        senderType: 'SYSTEM',
                        senderId: 'SYSTEM',
                        content: `⭐ La sesión de ${appt.service.name} fue completada exitosamente. Gracias por confiar en Vivid Senior Living.`
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
