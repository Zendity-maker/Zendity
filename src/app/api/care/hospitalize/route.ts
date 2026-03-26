import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';



export async function PATCH(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        const body = await req.json();

        // Validamos autenticación base, pero permitimos caregiverId del bod si es un módulo tablet
        if (!session && !body.caregiverId) return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });

        const { patientId, reason, headquartersId, caregiverId } = body;

        if (!patientId || !reason || !headquartersId) {
            return NextResponse.json({ success: false, error: "Faltan datos requeridos (Paciente, Sede o Razón)" }, { status: 400 });
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
                lifePlan: true,
                headquarters: {
                    select: { name: true, logoUrl: true }
                },
                medications: {
                    where: { isActive: true },
                    include: {
                        medication: true
                    }
                }
            }
        });

        // 2. Opcionalmente registrar estp como un Ticket/Reporte Clinico (Hub)
        await prisma.dailyLog.create({
            data: {
                patientId,
                authorId: caregiverId || session?.user?.id || "emergency-bypass",
                bathCompleted: false,
                foodIntake: 0,
                notes: `[TRASLADO HOSPITALARIO DE EMERGENCIA] Motivo: ${reason}`,
                isClinicalAlert: true // Esto lo manda a triage
            }
        });

        return NextResponse.json({ success: true, patient: updatedPatient });

    } catch (error: any) {
        console.error("Create Hospitalization Error:", error);
        return NextResponse.json({ success: false, error: "Error de servidor al procesar el traslado", msg: error.message }, { status: 500 });
    }
}
