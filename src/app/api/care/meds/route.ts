import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { resolveEffectiveHqId } from '@/lib/hq-resolver';
import { notifyRoles } from '@/lib/notifications';
import { applyScoreEvent } from '@/lib/score-event';
import { conciliarUna } from '@/lib/emar-conciliar';

const ALLOWED_ROLES = ['CAREGIVER', 'NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN'];

/**
 * Endpoint legacy individual. La mayoría del flujo clínico usa
 * /api/care/meds/bulk. Esta ruta queda para registros unitarios
 * (ej. administración manual fuera del pack del turno).
 *
 * Auth hardening (limpieza post-auditoría):
 *  - Requiere sesión.
 *  - El rol debe estar en ALLOWED_ROLES.
 *  - El paciente del PatientMedication debe estar en la sede efectiva
 *    del invocador (resolveEffectiveHqId).
 *  - administeredById SIEMPRE = session.user.id (no se confía en body).
 */
export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }
        const invokerId = (session.user as any).id;
        const invokerRole = (session.user as any).role;
        if (!ALLOWED_ROLES.includes(invokerRole)) {
            return NextResponse.json({ success: false, error: 'Rol no autorizado para registrar medicamentos' }, { status: 403 });
        }

        let effectiveHqId: string;
        try {
            effectiveHqId = await resolveEffectiveHqId(session, null);
        } catch (e: any) {
            return NextResponse.json({ success: false, error: e.message || 'Sede inválida' }, { status: 400 });
        }

        // `scheduleTime` es opcional y nuevo: si quien llama sabe qué franja
        // está firmando, la conciliación es exacta. Si no, ver abajo.
        const { patientMedicationId, status, notes, scheduleTime } = await req.json();

        if (!patientMedicationId) {
            return NextResponse.json({ success: false, error: 'patientMedicationId requerido' }, { status: 400 });
        }

        // Tenant check: la medicación debe pertenecer a un residente de la sede
        // efectiva del invocador. Antes el endpoint aceptaba cualquier id ciego.
        const patientMed = await prisma.patientMedication.findUnique({
            where: { id: patientMedicationId },
            include: {
                patient: { select: { name: true, headquartersId: true } },
                medication: { select: { name: true } },
            },
        });
        if (!patientMed?.patient) {
            return NextResponse.json({ success: false, error: 'Medicación no encontrada' }, { status: 404 });
        }
        if (patientMed.patient.headquartersId !== effectiveHqId) {
            return NextResponse.json({ success: false, error: 'Residente fuera de tu sede' }, { status: 403 });
        }

        const adminStatus = status || 'ADMINISTERED';

        /**
         * SE FIRMA LA FILA QUE EL CRON YA CREÓ, SI SE PUEDE SABER CUÁL.
         *
         * Desde el 15-sep-2026 `materializarDosisDelDia` crea una fila PENDING
         * por dosis programada. Escribir una fila nueva al lado deja dos por
         * dosis, y al cerrar el turno la del cron queda marcada como omitida
         * aunque la dosis se haya dado. Eso produjo diez omisiones fantasma en
         * la tableta el primer día que el cron funcionó.
         *
         * Esta ruta es de registro unitario y puede no saber qué franja firma.
         * `conciliarUna` no adivina: concilia si llega la franja, o si hay una
         * sola dosis abierta del turno en curso. En cualquier otro caso crea
         * suelta, como hacía siempre. Ver src/lib/emar-conciliar.ts.
         */
        const ahora = new Date();
        const fila = await conciliarUna(patientMedicationId, scheduleTime, ahora);

        const datos = {
            administeredById: invokerId,
            status: adminStatus,
            notes,
            administeredAt: adminStatus === 'ADMINISTERED' ? ahora : null,
            ...(scheduleTime ? { scheduleTime } : {}),
        };

        const admin = fila
            ? await prisma.medicationAdministration.update({ where: { id: fila.id }, data: datos })
            : await prisma.medicationAdministration.create({ data: { patientMedicationId, ...datos } });

        // FASE 45: Gamification & Trust Score Penalty
        if (adminStatus === 'OMITTED') {
            const medName = patientMed.medication?.name || 'medicamento';
            await applyScoreEvent(invokerId, effectiveHqId, -5,
                `Medicamento omitido: ${medName}`, 'MEDS');
        }

        // Notificación EMAR_ALERT cuando el medicamento no se administra
        if (adminStatus === 'OMITTED' || adminStatus === 'MISSED') {
            try {
                const schedule = patientMed.scheduleTimes || 'sin horario';
                const medName = patientMed.medication?.name || 'medicamento';
                const statusLabel = adminStatus === 'OMITTED' ? 'omitido' : 'no administrado';
                await notifyRoles(patientMed.patient.headquartersId, ['SUPERVISOR', 'NURSE'], {
                    type: 'EMAR_ALERT',
                    title: 'Medicamento no administrado',
                    message: `${patientMed.patient.name} — ${medName} (${schedule}) ${statusLabel}`,
                    link: '/care/supervisor',
                });
            } catch (e) { console.error('[notify EMAR_ALERT]', e); }
        }

        return NextResponse.json({ success: true, administration: admin });

    } catch (error) {
        console.error('Meds POST Error:', error);
        return NextResponse.json({ success: false, error: 'Error registrando medicamento' }, { status: 500 });
    }
}
