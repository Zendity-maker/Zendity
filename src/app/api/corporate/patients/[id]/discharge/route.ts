import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from '@/lib/prisma';



export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // Auth: solo DIRECTOR/ADMIN pueden dar de alta o declarar fallecido.
        // TEMPORARY_LEAVE / RETURN también SUPERVISOR, NURSE y CAREGIVER —
        // el cuidador del turno necesita poder registrar el retorno desde la tarjeta
        // del paciente en /care (botón "Registrar Retorno al Piso").
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
        }

        const invokerRole = (session.user as any).role as string;
        const invokerId = (session.user as any).id as string;
        const sessionHqId = (session.user as any).headquartersId as string;

        const { action, leaveType, date, reason } = await req.json();
        const { id: patientId } = await params;

        if (!patientId || !action) {
            return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
        }

        // Role check: DISCHARGED y DECEASED solo DIRECTOR/ADMIN.
        // TEMPORARY_LEAVE / RETURN también SUPERVISOR, NURSE y CAREGIVER.
        const highRiskActions = ['DISCHARGED', 'DECEASED'];
        const allowedForHighRisk = ['DIRECTOR', 'ADMIN'];
        const allowedForLeave = ['DIRECTOR', 'ADMIN', 'SUPERVISOR', 'NURSE', 'CAREGIVER'];

        if (highRiskActions.includes(action)) {
            if (!allowedForHighRisk.includes(invokerRole)) {
                return NextResponse.json({ success: false, error: "Solo DIRECTOR o ADMIN pueden dar de alta o declarar fallecido a un residente" }, { status: 403 });
            }
        } else {
            if (!allowedForLeave.includes(invokerRole)) {
                return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
            }
        }

        const patient = await prisma.patient.findUnique({
            where: { id: patientId }
        });

        if (!patient) {
            return NextResponse.json({ success: false, error: "Patient not found" }, { status: 404 });
        }

        // Tenant check: el residente debe pertenecer a la sede de la sesión.
        if (patient.headquartersId !== sessionHqId) {
            return NextResponse.json({ success: false, error: "Residente no encontrado en tu sede" }, { status: 404 });
        }

        let updateData: any = {};

        switch (action) {
            case "TEMPORARY_LEAVE":
                updateData = {
                    status: "TEMPORARY_LEAVE",
                    leaveType: leaveType || "OTHER",
                    leaveDate: date ? new Date(date) : new Date(),
                };
                break;

            case "RETURN":
                updateData = {
                    status: "ACTIVE",
                    leaveType: null,
                    leaveDate: null,
                };
                break;

            case "DISCHARGED":
            case "DECEASED":
                updateData = {
                    status: action,
                    dischargeDate: date ? new Date(date) : new Date(),
                    dischargeReason: reason || "No reason provided",
                    roomNumber: null, // Liberamos el cuarto
                };
                break;

            default:
                return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
        }

        const updatedPatient = await prisma.patient.update({
            where: { id: patientId },
            data: updateData,
        });

        /**
         * EL TRASLADO SE CIERRA SOLO CUANDO EL RESIDENTE VUELVE.
         *
         * Un traslado a emergencias crea un TriageTicket para que supervisión y
         * dirección se enteren (ver /api/care/hospitalize). Ese ticket nacía
         * OPEN y nadie lo cerraba nunca: la alerta clínica del traslado nace
         * RESUELTA a propósito —el traslado ya pasó, no hay nada que hacer— así
         * que nadie abría el panel a cerrarla, y el ticket se quedaba abierto
         * para siempre. Andrés lo dijo: "el traslado de Carlos se solucionó
         * pero me sigue apareciendo como abierto sin resolver".
         *
         * Mientras el residente está fuera, el ticket abierto dice la verdad:
         * hay alguien en el hospital y hay seguimiento pendiente. Cuando vuelve,
         * deja de ser verdad — y lo que deja de ser verdad no puede seguir
         * ocupando una bandeja.
         *
         * DECEASED y DISCHARGED también cierran: un traslado de alguien que ya
         * no está no le pide nada a nadie. Es el mismo fallo de las úlceras de
         * Wilfredo y del riesgo de caídas, por tercera vez.
         *
         * Best-effort: el cambio de estado del residente ya se guardó y no se
         * revierte porque falle el cierre de un ticket.
         */
        if (action === 'RETURN' || action === 'DISCHARGED' || action === 'DECEASED') {
            try {
                const motivo = action === 'RETURN'
                    ? 'El residente regresó al hogar.'
                    : action === 'DECEASED'
                        ? 'Cerrado: el residente falleció.'
                        : 'Cerrado: el residente fue dado de baja.';
                await prisma.triageTicket.updateMany({
                    where: {
                        patientId, originType: 'INCIDENT',
                        status: { not: 'RESOLVED' },
                        description: { startsWith: '[TRASLADO A EMERGENCIAS]' },
                    },
                    data: { status: 'RESOLVED', resolvedAt: new Date(), resolvedById: invokerId },
                });
                console.log(`[discharge] tickets de traslado cerrados para ${patientId}: ${motivo}`);
            } catch (e) {
                console.error('[discharge] no se pudo cerrar el ticket del traslado', e);
            }
        }

        return NextResponse.json({ success: true, patient: updatedPatient });

    } catch (error: any) {
        console.error("Discharge Flow Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
