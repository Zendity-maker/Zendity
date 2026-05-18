import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { logError } from '@/lib/logger';

const BathBody = z.object({
    patientId:      z.string().min(1, 'patientId requerido'),
    caregiverId:    z.string().min(1, 'caregiverId requerido'),
    shiftSessionId: z.string().min(1, 'shiftSessionId requerido'),
});

export async function POST(req: Request) {
    try {
        const auth = await requireRole(['CAREGIVER', 'NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN']);
        if (auth instanceof NextResponse) return auth;
        const sessionHqId = auth.headquartersId;
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
        logError('care.adls.bath.post', error);
        return NextResponse.json({ success: false, error: "Error interno procesando el baño" }, { status: 500 });
    }
}
