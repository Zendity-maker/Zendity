import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { logError } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['CAREGIVER', 'NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN'];

const HospitalizeBody = z.object({
    patientId: z.string().min(1, 'patientId requerido'),
    reason:    z.string().min(3, 'razón demasiado corta').max(1000),
    // ¿El traslado fue por una caída? Hasta sep-2026 no se preguntaba, y la
    // caída quedaba solo en la prosa del motivo: "Motivo: Tuvo una caída, está
    // en el hospital". El dato estaba escrito y no llegaba al módulo, así que
    // el conteo de caídas del hogar salía corto — hacia abajo, que es la
    // dirección mala. Ver src/lib/verificaciones.ts, CAIDAS_FUERA_DEL_MODULO.
    porCaida: z.boolean().optional(),
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
        const { patientId, reason, porCaida } = parsed.data;

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
        // El traslado por caída registra la caída. Quien traslada ya escribió la
        // causa; solo hay que estructurarla en vez de dejarla en prosa.
        // Los datos clínicos van "No especificado": quien traslada suele no
        // haber presenciado la caída, y un incidente honesto con huecos vale más
        // que ninguno — o que uno inventado.
        if (porCaida) {
            try {
                await prisma.fallIncident.create({
                    data: {
                        patientId,
                        reportedById: authorId,
                        location: 'Registrada desde traslado hospitalario',
                        severity: 'SEVERE',
                        interventions: 'Traslado a hospital. Consciente: No especificado · Sangrado: No especificado · Dolor: No especificado',
                        notes: `Caída que motivó el traslado. Motivo declarado: ${reason}`,
                    },
                });
                // Cualquier caída activa el riesgo de Downton.
                await prisma.patient.update({ where: { id: patientId }, data: { downtonRisk: true } });
            } catch (e) {
                // No bloquea el traslado: primero sale el residente al hospital.
                console.error('[hospitalize] no se pudo registrar la caída:', e);
            }
        }

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
                // null, no 0: este evento no dice nada sobre la comida, y un 0
                // se lee como "no comió nada".
                foodIntake: null,
                notes: `[TRASLADO HOSPITALARIO DE EMERGENCIA] Motivo: ${reason}`,
                isClinicalAlert: true, // Esto lo manda a triage
                /**
                 * Nace RESUELTA. El traslado no es una tarea pendiente: ya
                 * ocurrio y ya se atendio — el residente esta camino al
                 * hospital. Va a triage para que el supervisor lo vea en su
                 * turno, y para eso basta la ventana de 24 horas del panel.
                 *
                 * Como isResolved quedaba en false y nadie cierra un traslado,
                 * cada uno se quedaba abierto para siempre: al 28-ago-2026 eran
                 * 35 de las 51 "alertas clinicas sin resolver", la mas vieja de
                 * hace 88 dias y 14 de residentes ya fallecidos o dados de baja.
                 *
                 * Un contador que no puede bajar deja de mirarse, y con el se
                 * dejan de mirar las alertas que si piden algo. Es la misma
                 * leccion de las ulceras cronicas.
                 */
                isResolved: true,
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
        logError('care.hospitalize.patch', error);
        return NextResponse.json({ success: false, error: "Error de servidor al procesar el traslado", msg: error.message }, { status: 500 });
    }
}
