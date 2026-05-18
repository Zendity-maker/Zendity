import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['CAREGIVER', 'NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN'];

const HospitalizeBody = z.object({
    patientId: z.string().min(1, 'patientId requerido'),
    reason:    z.string().min(3, 'razón demasiado corta').max(1000),
});

export async function PATCH(req: Request) {
    try {
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;
        const { id: authorId, headquartersId: sessionHqId } = auth;

        const rawBody = await req.json().catch(() => null);
        const parsed = HospitalizeBody.safeParse(rawBody);
        if (!parsed.success) {
            const first = parsed.error.issues[0];
            const path = first?.path?.join('.') || 'body';
            return NextResponse.json({
                success: false,
                error: `Datos inválidos en ${path}: ${first?.message || 'formato incorrecto'}`,
            }, { status: 400 });
        }
        const { patientId, reason } = parsed.data;

        // Tenant check: el paciente debe pertenecer a la sede del usuario en sesión.
        const patientCheck = await prisma.patient.findUnique({
            where: { id: patientId },
            select: { headquartersId: true }
        });
        if (!patientCheck) {
            return NextResponse.json({ success: false, error: "Residente no encontrado" }, { status: 404 });
        }
        if (patientCheck.headquartersId !== sessionHqId) {
            return NextResponse.json({ success: false, error: "Sede no coincide" }, { status: 403 });
        }

        // 1. Modificar el estado del paciente a TEMPORARY_LEAVE y tipo HOSPITAL
        const updatedPatient = await prisma.patient.update({
            where: { id: patientId },
            data: {
                status: 'TEMPORARY_LEAVE',
                leaveType: 'HOSPITAL',
                leaveDate: new Date()
            },
            include: {
                lifePlans: { orderBy: { createdAt: 'desc' }, take: 1 },
                headquarters: {
                    select: { name: true, logoUrl: true, phone: true, billingAddress: true }
                },
                medications: {
                    where: { isActive: true },
                    include: {
                        medication: true
                    }
                },
                intakeData: true,
                vitalSigns: {
                    orderBy: { createdAt: 'desc' },
                    take: 2
                }
            }
        });

        // Info del autor para el resumen impreso
        const author = await prisma.user.findUnique({
            where: { id: authorId },
            select: { name: true, role: true }
        });

        // 2. Opcionalmente registrar estp como un Ticket/Reporte Clinico (Hub)
        await prisma.dailyLog.create({
            data: {
                patientId,
                authorId,
                bathCompleted: false,
                foodIntake: 0,
                notes: `[TRASLADO HOSPITALARIO DE EMERGENCIA] Motivo: ${reason}`,
                isClinicalAlert: true // Esto lo manda a triage
            }
        });

        return NextResponse.json({
            success: true,
            patient: updatedPatient,
            author: author,
            transferReason: reason,
            transferDate: new Date().toISOString(),
        });

    } catch (error: any) {
        console.error("Create Hospitalization Error:", error);
        return NextResponse.json({ success: false, error: "Error de servidor al procesar el traslado", msg: error.message }, { status: 500 });
    }
}
