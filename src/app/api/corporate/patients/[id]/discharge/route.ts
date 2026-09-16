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
                    /**
                     * Y SE LIMPIA EL REPORTE DE FALLECIMIENTO.
                     *
                     * Si el piso reporta un fallecimiento y dirección lo corrige con
                     * RETURN, el residente volvía a ACTIVE pero quedaba marcado para
                     * siempre — y marcado quiere decir INVISIBLE:
                     * /api/care/reportar-fallecimiento:62-64 devuelve 409 con la sola
                     * presencia de `fallecimientoReportadoAt`. El día que esa persona
                     * falleciera de verdad, el botón fallaría delante de la enfermera
                     * y nadie sabría por qué.
                     *
                     * Medido el 16-sep-2026: 0 de 48 residentes tienen el campo puesto,
                     * así que no hay ningún caso vivo. Es una mina sin pisar todavía.
                     */
                    fallecimientoReportadoAt: null,
                    fallecimientoReportadoPorId: null,
                    fallecimientoNota: null,
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

        /**
         * AL CERRAR EL EXPEDIENTE SE CIERRAN SUS RECETAS.
         *
         * Hasta el 16-sep-2026 el alta y el fallecimiento cambiaban el estado del
         * residente y dejaban sus prescripciones vivas. Medido ese día: **62
         * recetas en ACTIVE colgando de 11 residentes cerrados** — 15 de Carlos
         * I. Aponte, fallecido el 10 de junio; 10 de Víctor M. Rosa, cerrado el
         * 30 de mayo. La más vieja llevaba tres meses y medio.
         *
         * Lo que eso costaba, medido: el contador de recetas de la sede decía 312
         * cuando las vivas son 238, y al abrir el expediente de alguien cerrado
         * sus recetas se pintaban como tratamiento en curso. Y el 15-sep, el
         * primer día que el cron de dosis funcionó, materializó 90 dosis para 12
         * personas que no estaban y acusó al piso de 54 omisiones que no
         * existían. Aquello se tapó filtrando en el cron (commit db294f50); esto
         * cierra la puerta por donde entraba.
         *
         * LOS DOS CAMPOS, no uno. `api/care/route.ts:117` exige `isActive` Y
         * `status`; `api/emar/patient/[id]:38` mira además `status: DRAFT`. Con
         * solo uno de los dos la receta seguiría viva en alguna pantalla. Es lo
         * mismo que escribe el camino manual en `med/crud/route.ts` al
         * descontinuar a mano.
         *
         * TEMPORARY_LEAVE NO descontinúa, y es deliberado: el residente vuelve.
         * Isidra Beaton lleva desde el 9-sep en el hospital con 13 recetas;
         * obligarla a que se le reescriban trece prescripciones a mano al volver
         * sería peor. Y mientras está fuera ya no le llegan a la tableta ni le
         * generan dosis.
         *
         * En transacción con el cambio de estado: si el expediente se cierra y la
         * descontinuación falla en silencio, queda exactamente el estado que
         * llevábamos desde mayo.
         */
        const cierraElExpediente = action === 'DISCHARGED' || action === 'DECEASED';

        const { updatedPatient, recetasCerradas } = await prisma.$transaction(async (tx) => {
            const paciente = await tx.patient.update({
                where: { id: patientId },
                data: updateData,
            });

            if (!cierraElExpediente) return { updatedPatient: paciente, recetasCerradas: 0 };

            const vivas = await tx.patientMedication.findMany({
                where: {
                    patientId,
                    OR: [
                        { isActive: true },
                        { status: { in: ['ACTIVE', 'PRN', 'SUSPENDED', 'DRAFT'] } },
                    ],
                },
                select: { id: true },
            });
            if (vivas.length === 0) return { updatedPatient: paciente, recetasCerradas: 0 };

            await tx.patientMedication.updateMany({
                where: { id: { in: vivas.map(v => v.id) } },
                data: { isActive: false, status: 'DISCONTINUED' },
            });

            // El rastro es el propio registro de auditoría del medicamento.
            // `authorId` es llave foránea NO nula a User: va el usuario de la
            // sesión, que el control de rol de arriba garantiza DIRECTOR o ADMIN.
            const motivoCierre = action === 'DECEASED'
                ? 'Descontinuada al cerrar el expediente por fallecimiento.'
                : 'Descontinuada al cerrar el expediente por alta.';
            await tx.medicationAuditLog.createMany({
                data: vivas.map(v => ({
                    patientMedicationId: v.id,
                    action: 'DISCONTINUED' as const,
                    authorId: invokerId,
                    reason: `${motivoCierre}${reason ? ` Motivo del alta: ${String(reason).slice(0, 200)}` : ''}`,
                })),
            });

            return { updatedPatient: paciente, recetasCerradas: vivas.length };
        }, { timeout: 20000 });

        if (recetasCerradas > 0) {
            console.log(`[discharge] ${recetasCerradas} recetas descontinuadas al cerrar ${patientId} (${action})`);
        }

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

        return NextResponse.json({ success: true, patient: updatedPatient, recetasCerradas });

    } catch (error: any) {
        console.error("Discharge Flow Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
