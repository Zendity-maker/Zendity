import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';



const ALLOWED_ROLES = ['CAREGIVER', 'NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN'];

export async function PATCH(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
        }

        const userRole = (session.user as any).role as string | undefined;
        if (!userRole || !ALLOWED_ROLES.includes(userRole)) {
            return NextResponse.json({ success: false, error: "No tienes permiso para marcar residente en hospital" }, { status: 403 });
        }

        const sessionHqId = (session.user as any).headquartersId as string | undefined;
        const authorId = session.user.id;

        const body = await req.json();
        const { patientId, reason } = body;

        if (!patientId || !reason) {
            return NextResponse.json({ success: false, error: "Faltan datos requeridos (Paciente o Razón)" }, { status: 400 });
        }

        // Tenant check: el paciente debe pertenecer a la sede del usuario en sesión.
        const patientCheck = await prisma.patient.findUnique({
            where: { id: patientId },
            select: { headquartersId: true }
        });
        if (!patientCheck) {
            return NextResponse.json({ success: false, error: "Residente no encontrado" }, { status: 404 });
        }
        if (!sessionHqId || patientCheck.headquartersId !== sessionHqId) {
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
