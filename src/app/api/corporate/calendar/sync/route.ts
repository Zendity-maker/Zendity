import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

// POST /api/corporate/calendar/sync
// Escanea tablas operativas y siembra CalendarEvents automáticamente
export async function POST() {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const hqId = session.user.headquartersId;
        const now = new Date();
        const created: string[] = [];

        // --- FUENTE 1: MedicationAdministration MISSED de hoy ---
        const missedMeds = await prisma.medicationAdministration.findMany({
            where: {
                status: 'MISSED',
                scheduledTime: {
                    gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
                    lt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1),
                },
                patientMedication: {
                    patient: { headquartersId: hqId }
                }
            },
            include: {
                patientMedication: {
                    include: { patient: true, medication: true }
                }
            }
        });

        for (const med of missedMeds) {
            const title = `eMAR MISSED: ${med.patientMedication.medication.name} — ${med.patientMedication.patient.name}`;
            const existing = await prisma.calendarEvent.findFirst({
                where: { headquartersId: hqId, title, originContext: 'EMAR_SYNC' }
            });
            if (!existing) {
                await prisma.calendarEvent.create({
                    data: {
                        headquartersId: hqId,
                        patientId: med.patientMedication.patient.id,
                        type: 'REEVALUATION_DUE',
                        status: 'SCHEDULED',
                        title,
                        description: `Dosis programada para ${med.scheduledFor} marcada como MISSED. Requiere atención clínica.`,
                        originContext: 'EMAR_SYNC',
                        startTime: med.scheduledTime ?? now,
                    }
                });
                created.push(`EMAR_MISSED: ${title}`);
            }
        }

        // --- FUENTE 2: TriageTickets HIGH/CRITICAL abiertos ---
        const highTickets = await prisma.triageTicket.findMany({
            where: {
                headquartersId: hqId,
                status: 'OPEN',
                priority: { in: ['HIGH', 'CRITICAL'] }
            },
            include: { patient: true }
        });

        for (const ticket of highTickets) {
            const title = `Alerta Triage: ${ticket.description.substring(0, 60)}`;
            const existing = await prisma.calendarEvent.findFirst({
                where: { headquartersId: hqId, title, originContext: 'TRIAGE_SYNC' }
            });
            if (!existing) {
                await prisma.calendarEvent.create({
                    data: {
                        headquartersId: hqId,
                        patientId: ticket.patientId,
                        type: 'MEDICAL_APPOINTMENT',
                        status: 'SCHEDULED',
                        title,
                        description: ticket.description,
                        originContext: 'TRIAGE_SYNC',
                        startTime: now,
                    }
                });
                created.push(`TRIAGE: ${title}`);
            }
        }

        // --- FUENTE 3: LifePlan con nextReview vencido o próximo (7 días) ---
        const duePlans = await prisma.lifePlan.findMany({
            where: {
                patient: { headquartersId: hqId },
                nextReview: {
                    lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
                }
            },
            include: { patient: true }
        });

        for (const plan of duePlans) {
            const title = `Revisión PAI: ${plan.patient.name}`;
            const existing = await prisma.calendarEvent.findFirst({
                where: { headquartersId: hqId, title, originContext: 'PAI_SYNC' }
            });
            if (!existing && plan.nextReview) {
                await prisma.calendarEvent.create({
                    data: {
                        headquartersId: hqId,
                        patientId: plan.patient.id,
                        type: 'REEVALUATION_DUE',
                        status: 'SCHEDULED',
                        title,
                        description: `Revisión del Plan de Atención Individualizado programada. Estado actual: ${plan.status}.`,
                        originContext: 'PAI_SYNC',
                        startTime: plan.nextReview,
                    }
                });
                created.push(`PAI: ${title}`);
            }
        }

        return NextResponse.json({
            success: true,
            synced: created.length,
            items: created
        });

    } catch (error) {
        console.error('Sync error:', error);
        return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
    }
}
