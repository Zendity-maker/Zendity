import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { logError } from '@/lib/logger';
import { notifyRoles } from '@/lib/notifications';

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

        // 2. La nota del traslado en el expediente.
        const nota = await prisma.dailyLog.create({
            data: {
                patientId,
                authorId,
                bathCompleted: false,
                // null, no 0: este evento no dice nada sobre la comida, y un 0
                // se lee como "no comió nada".
                foodIntake: null,
                notes: `[TRASLADO HOSPITALARIO DE EMERGENCIA] Motivo: ${reason}`,
                /**
                 * OJO: `isClinicalAlert` NO manda esto a triage.
                 *
                 * El comentario anterior decia que si, y era falso: el ticket lo
                 * crea /api/care/vitals cuando la nota entra por ahi, y esta ruta
                 * escribe el DailyLog directo con prisma, saltandose esa logica.
                 * Un comentario que promete lo que el codigo no hace es peor que
                 * no tener comentario: nadie vuelve a comprobarlo.
                 *
                 * Medido el 08-sep-2026: de 53 notas marcadas como alerta en 30
                 * dias, 19 no llegaron al inbox del supervisor — 15 de ellas
                 * traslados hospitalarios, incluido uno cuyo motivo era
                 * "Fallecio". El ticket se crea ahora abajo, a mano.
                 *
                 * La bandera se queda porque marca la nota como clinica en el
                 * expediente, que es otra cosa.
                 */
                isClinicalAlert: true,
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

        /**
         * 3. EL TICKET, PARA QUE EL SUPERVISOR SE ENTERE.
         *
         * Un traslado a emergencias es el evento mas grave que puede reportar
         * una cuidadora, y hasta hoy no aparecia en el inbox: solo cambiaba el
         * contador de "En Hospital", que es un ESTADO, no algo que alguien
         * tenga que atender.
         *
         * NACE ABIERTO, aunque la nota nazca resuelta. No son lo mismo: la nota
         * resuelta dice "esto ya paso y se atendio"; el ticket abierto dice
         * "el supervisor todavia no lo ha visto". Cerrarlo es un clic y son
         * quince al mes, no quince al dia — no es el contador que no baja del
         * que avisa el comentario de arriba.
         *
         * CRITICO si el motivo habla de un fallecimiento. Existe boton propio
         * para reportarlo, pero mientras alguien lo escriba aqui, aqui hay que
         * tratarlo como lo que es.
         */
        const esFallecimiento = /fallec|muri[oó]|defunci/i.test(reason);
        try {
            await prisma.triageTicket.create({
                data: {
                    headquartersId: sessionHqId,
                    patientId,
                    originType: 'INCIDENT',
                    originReferenceId: nota.id,
                    priority: esFallecimiento ? 'CRITICAL' : 'HIGH',
                    /**
                     * NACE EN SEGUIMIENTO, NO ABIERTO.
                     *
                     * Este ticket lo puse yo el 09-sep-2026 para que un traslado
                     * a emergencias dejara de ser invisible en el inbox. Lo hice
                     * OPEN, y eso fue un error: OPEN significa "esto no lo ha
                     * tocado nadie y hay algo que hacer".
                     *
                     * Un traslado ya ocurrió. El residente va camino al hospital
                     * y la cuidadora ya hizo lo suyo — por eso la alerta clínica
                     * de este mismo evento nace RESUELTA, dos bloques más arriba.
                     * Crear al lado un ticket que pide acción es contradecir esa
                     * decisión con la mano izquierda.
                     *
                     * Lo que SÍ está pendiente mientras el residente está fuera
                     * es el seguimiento: saber cómo sigue y recibirlo de vuelta.
                     * Eso es IN_PROGRESS. Y se cierra solo cuando vuelve, en
                     * /api/corporate/patients/[id]/discharge.
                     *
                     * Un fallecimiento sí queda OPEN: ahí hay cosas que hacer y
                     * nadie va a "volver".
                     */
                    status: esFallecimiento ? 'OPEN' : 'IN_PROGRESS',
                    description: `[TRASLADO A EMERGENCIAS] ${reason}`
                        + (esFallecimiento ? '' : ' · Se cierra solo cuando el residente regrese.')
                        + (porCaida ? ' · Fue por una caida.' : '')
                        + ` — Trasladado por ${author?.name?.trim() ?? 'personal'}.`,
                },
            });
        } catch (e) {
            // El traslado ya ocurrio y el residente ya esta camino al hospital:
            // si el ticket falla, no se tumba la respuesta. Queda en el log.
            logError('care.hospitalize.ticket', e as Error);
        }

        notifyRoles(sessionHqId, ['SUPERVISOR', 'DIRECTOR', 'NURSE'], {
            type: 'TRIAGE',
            title: esFallecimiento ? 'Traslado a emergencias — fallecimiento' : 'Traslado a emergencias',
            message: `${reason.slice(0, 140)} — por ${author?.name?.trim() ?? 'personal'}.`,
            link: '/care/supervisor',
        }, authorId).catch(e => logError('care.hospitalize.notify', e as Error));

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
