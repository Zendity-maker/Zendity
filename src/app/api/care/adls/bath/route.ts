import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

const BathBody = z.object({
    patientId:      z.string().min(1, 'patientId requerido'),
    caregiverId:    z.string().min(1, 'caregiverId requerido'),
    shiftSessionId: z.string().min(1, 'shiftSessionId requerido'),
});

export async function POST(req: Request) {
    try {
        // Auth + rol clínico/operativo
        const session = await getServerSession(authOptions);
        if (!session || !['CAREGIVER', 'NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN'].includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
        }

        const sessionHqId = (session.user as any).headquartersId;
        const rawBody = await req.json().catch(() => null);
        const parsed = BathBody.safeParse(rawBody);
        if (!parsed.success) {
            const first = parsed.error.issues[0];
            const path = first?.path?.join('.') || 'body';
            return NextResponse.json({
                success: false,
                error: `Datos inválidos en ${path}: ${first?.message || 'formato incorrecto'}`,
            }, { status: 400 });
        }
        const { patientId, caregiverId, shiftSessionId } = parsed.data;

        // Tenant check — el residente DEBE pertenecer a la sede de la sesión
        const patient = await prisma.patient.findUnique({
            where: { id: patientId },
            select: { headquartersId: true }
        });
        if (!patient || patient.headquartersId !== sessionHqId) {
            return NextResponse.json({ success: false, error: "Residente no encontrado en tu sede." }, { status: 404 });
        }

        // Anti doble-click: cooldown de 2 minutos por (cuidadora + residente)
        // Permite bañar múltiples residentes seguidos; solo bloquea registrar
        // dos veces al MISMO residente en una ventana corta.
        const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);

        const recentBath = await prisma.bathLog.findFirst({
            where: {
                caregiverId,
                patientId,
                timeLogged: {
                    gte: twoMinutesAgo
                }
            }
        });

        if (recentBath) {
            return NextResponse.json({
                success: false,
                error: "COOLDOWN_ACTIVE",
                message: "Este baño ya fue registrado recientemente para este residente. Espera un momento."
            }, { status: 429 });
        }

        const newBath = await prisma.bathLog.create({
            data: {
                patientId,
                caregiverId,
                shiftSessionId,
                status: "COMPLETED"
            }
        });

        return NextResponse.json({ success: true, bath: newBath });

    } catch (error) {
        console.error("Bath Route Error:", error);
        return NextResponse.json({ success: false, error: "Error interno procesando el baño" }, { status: 500 });
    }
}
