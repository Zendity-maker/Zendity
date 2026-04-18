import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { notifyUser, notifyRoles } from '@/lib/notifications';
import { todayStartAST } from '@/lib/dates';
import { startOfDay, endOfDay } from 'date-fns';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['SUPERVISOR', 'NURSE', 'DIRECTOR', 'ADMIN'];

// POST: Crea una orden de toma de vitales "a petición" para un residente.
// Expira en 2h. Se asigna al cuidador activo cuyo colorGroup coincide con el del residente.
// Si no hay cuidador asignado, notifica a todos los CAREGIVER de la sede.
export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
        }

        const invokerId = (session.user as any).id;
        const invokerRole = (session.user as any).role;
        const invokerHqId = (session.user as any).headquartersId;

        if (!ALLOWED_ROLES.includes(invokerRole)) {
            return NextResponse.json({ success: false, error: "Rol sin permiso para ordenar vitales" }, { status: 403 });
        }

        const { patientId, reason } = await req.json();
        if (!patientId) {
            return NextResponse.json({ success: false, error: "patientId requerido" }, { status: 400 });
        }

        // Confirmar que el residente pertenece a la sede del invocador
        const patient = await prisma.patient.findUnique({
            where: { id: patientId },
            select: { id: true, name: true, colorGroup: true, headquartersId: true, status: true }
        });
        if (!patient || patient.headquartersId !== invokerHqId) {
            return NextResponse.json({ success: false, error: "Residente fuera de tu sede" }, { status: 403 });
        }
        if (patient.status !== 'ACTIVE') {
            return NextResponse.json({ success: false, error: "Residente no está activo" }, { status: 400 });
        }

        // Evitar orden duplicada activa para el mismo residente
        const existing = await prisma.vitalsOrder.findFirst({
            where: { patientId, status: 'PENDING' }
        });
        if (existing) {
            return NextResponse.json({ success: false, error: "Ya hay una orden pendiente para este residente" }, { status: 409 });
        }

        const now = new Date();
        const expiresAt = new Date(now.getTime() + 2 * 60 * 60 * 1000); // +2h

        // Resolver cuidador asignado: ShiftColorAssignment hoy con el color del residente,
        // intersectado con ShiftSession activa en la sede.
        const todayStart = startOfDay(now);
        const todayEnd = endOfDay(now);
        const patientColor = String(patient.colorGroup);

        let caregiverId: string | null = null;

        if (patientColor && patientColor !== 'UNASSIGNED') {
            const colorAssignments = await prisma.shiftColorAssignment.findMany({
                where: {
                    headquartersId: invokerHqId,
                    color: patientColor,
                    assignedAt: { gte: todayStart, lte: todayEnd }
                },
                select: { userId: true },
                orderBy: { assignedAt: 'desc' }
            });

            const candidateIds = colorAssignments.map(a => a.userId);
            if (candidateIds.length > 0) {
                const activeSession = await prisma.shiftSession.findFirst({
                    where: {
                        headquartersId: invokerHqId,
                        caregiverId: { in: candidateIds },
                        actualEndTime: null,
                        startTime: { gte: todayStartAST() }
                    },
                    orderBy: { startTime: 'desc' },
                    select: { caregiverId: true }
                });
                if (activeSession) {
                    caregiverId = activeSession.caregiverId;
                }
            }
        }

        const order = await prisma.vitalsOrder.create({
            data: {
                headquartersId: invokerHqId,
                patientId,
                orderedById: invokerId,
                caregiverId,
                reason: reason || null,
                orderedAt: now,
                expiresAt,
                status: 'PENDING',
            }
        });

        // Notificar
        const notifTitle = "Orden de vitales pendiente";
        const notifMsg = `Toma vitales de ${patient.name} antes de ${expiresAt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}. ${reason ? `Motivo: ${reason}` : ''}`.trim();

        if (caregiverId) {
            await notifyUser(caregiverId, {
                type: 'EMAR_ALERT',
                title: notifTitle,
                message: notifMsg,
            });
        } else {
            await notifyRoles(invokerHqId, ['CAREGIVER'], {
                type: 'EMAR_ALERT',
                title: notifTitle,
                message: notifMsg,
            });
        }

        return NextResponse.json({ success: true, order });
    } catch (error: any) {
        console.error("VitalsOrder POST Error:", error);
        return NextResponse.json({ success: false, error: error.message || String(error) }, { status: 500 });
    }
}
