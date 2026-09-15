import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { resolveEffectiveHqId } from '@/lib/hq-resolver';
import { conciliarUna } from '@/lib/emar-conciliar';
import { logAudit } from '@/lib/audit';
import { withPhiAccessLog } from '@/lib/phi-audit';

// Cualquier rol staff — FAMILY no.
const STAFF_ROLES = ['CAREGIVER', 'NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN', 'SOCIAL_WORKER', 'KITCHEN', 'MAINTENANCE'];
const POST_ROLES = ['CAREGIVER', 'NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN'];

// GET: Fetch all pending medications para la sede del invocador
// PHI audit (Pilar 1) — lista de meds de la sede.
export const GET = withPhiAccessLog(getMedListHandler, { resourceType: 'eMAR' });

async function getMedListHandler(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }
        const invokerRole = (session.user as any).role;
        if (!STAFF_ROLES.includes(invokerRole)) {
            return NextResponse.json({ error: 'Rol no autorizado' }, { status: 403 });
        }
        // Respeta el switcher de sede para DIRECTOR/ADMIN multi-HQ
        const requestedHqId = new URL(request.url).searchParams.get('hqId');
        const hqId = await resolveEffectiveHqId(session, requestedHqId);

        // FIX (bug Wilfredo): antes devolvíamos sólo patientMedication.findMany,
        // lo que ocultaba a TODOS los residentes sin meds asignadas (recién
        // ingresados o sin prescripciones). La enfermera no podía añadir el
        // primer medicamento porque el paciente no aparecía en la lista.
        //
        // Nuevo contrato: devolvemos pacientes ACTIVE de la sede con su array
        // de meds (puede ser []). Mantenemos `data` plano para retrocompat
        // con consumidores que aún hacen el groupBy en el cliente.
        const patients = await prisma.patient.findMany({
            where: { headquartersId: hqId, status: 'ACTIVE' },
            include: {
                medications: { include: { medication: true } },
            },
            orderBy: [{ colorGroup: 'asc' }, { name: 'asc' }],
        });

        // Construimos `data` aplanado (compat) y `patients` agrupado (nuevo).
        const data = patients.flatMap(p =>
            p.medications.map(m => ({ ...m, patient: p, medication: m.medication })),
        );

        return NextResponse.json({ success: true, data, patients });
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ success: false, error: 'Failed to fetch medications' }, { status: 500 });
    }
}

// POST: Administer medication (Save Signature)
export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }
        const invokerId = (session.user as any).id;
        const invokerRole = (session.user as any).role;
        const hqId = (session.user as any).headquartersId;
        if (!POST_ROLES.includes(invokerRole)) {
            return NextResponse.json({ error: 'Rol no autorizado para administrar medicamentos' }, { status: 403 });
        }

        const body = await request.json();
        // `scheduleTime` es opcional: si quien llama sabe la franja que firma,
        // la conciliación de abajo es exacta.
        const { patientMedicationId, status, notes, scheduleTime } = body;

        if (!patientMedicationId) {
            return NextResponse.json({ success: false, error: 'patientMedicationId requerido' }, { status: 400 });
        }

        // Tenant check
        const med = await prisma.patientMedication.findFirst({
            where: {
                id: patientMedicationId,
                patient: { headquartersId: hqId }
            },
            select: { id: true }
        });
        if (!med) {
            return NextResponse.json({ success: false, error: 'Medicamento no encontrado' }, { status: 404 });
        }

        /**
         * SE FIRMA LA FILA DEL CRON, NO UNA COPIA AL LADO.
         *
         * Misma razón que en /api/care/meds/bulk: desde el 15-sep-2026 hay una
         * fila PENDING por dosis programada, y escribir otra encima deja dos
         * por dosis — la firmada y la del cron, que al cerrar el turno queda
         * como omitida aunque la dosis se diera.
         *
         * `conciliarUna` no adivina: exacta si llega la franja, y si no, solo
         * cuando hay UNA sola dosis abierta del turno en curso. Si no puede
         * saberlo, crea suelta como antes — una fila de más se ve; una firma en
         * la dosis equivocada, no.
         */
        const ahora = new Date();
        const adminStatus = status || 'ADMINISTERED'; // ADMINISTERED, MISSED, REFUSED
        const fila = await conciliarUna(patientMedicationId, scheduleTime, ahora);

        const datos = {
            administeredById: invokerId,
            status: adminStatus,
            notes,
            administeredAt: adminStatus === 'ADMINISTERED' ? ahora : null,
            ...(scheduleTime ? { scheduleTime } : {}),
        };

        const record = fila
            ? await prisma.medicationAdministration.update({ where: { id: fila.id }, data: datos })
            : await prisma.medicationAdministration.create({ data: { patientMedicationId, ...datos } });

        // Audit trail — no-fatal
        const auditActionMap: Record<string, 'MEDICATION_ADMINISTERED' | 'MEDICATION_MISSED' | 'MEDICATION_REFUSED'> = {
            ADMINISTERED: 'MEDICATION_ADMINISTERED',
            MISSED: 'MEDICATION_MISSED',
            REFUSED: 'MEDICATION_REFUSED',
        };
        await logAudit({
            headquartersId: hqId,
            performedById: invokerId,
            action: auditActionMap[status || 'ADMINISTERED'] ?? 'MEDICATION_ADMINISTERED',
            entityName: 'PatientMedication',
            entityId: patientMedicationId,
            payloadChanges: { status: status || 'ADMINISTERED', notes: notes ?? null },
            request,
        });

        return NextResponse.json({ success: true, record }, { status: 201 });
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ success: false, error: 'Failed to record administration' }, { status: 500 });
    }
}
