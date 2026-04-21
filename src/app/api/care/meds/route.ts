import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { resolveEffectiveHqId } from '@/lib/hq-resolver';
import { notifyRoles } from '@/lib/notifications';

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

        const { patientMedicationId, status, notes } = await req.json();

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

        const admin = await prisma.medicationAdministration.create({
            data: {
                patientMedicationId,
                administeredById: invokerId,
                status: adminStatus,
                notes,
            },
        });

        // FASE 45: Gamification & Trust Score Penalty
        if (adminStatus === 'OMITTED') {
            await prisma.user.update({
                where: { id: invokerId },
                data: { complianceScore: { decrement: 5 } },
            });
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
                });
            } catch (e) { console.error('[notify EMAR_ALERT]', e); }
        }

        return NextResponse.json({ success: true, administration: admin });

    } catch (error) {
        console.error('Meds POST Error:', error);
        return NextResponse.json({ success: false, error: 'Error registrando medicamento' }, { status: 500 });
    }
}
