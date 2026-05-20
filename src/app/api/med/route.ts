import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { resolveEffectiveHqId } from '@/lib/hq-resolver';

// Cualquier rol staff — FAMILY no.
const STAFF_ROLES = ['CAREGIVER', 'NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN', 'SOCIAL_WORKER', 'KITCHEN', 'MAINTENANCE'];
const POST_ROLES = ['CAREGIVER', 'NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN'];

// GET: Fetch all pending medications para la sede del invocador
export async function GET(request: Request) {
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
        const { patientMedicationId, status, notes } = body;

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

        const record = await prisma.medicationAdministration.create({
            data: {
                patientMedicationId,
                administeredById: invokerId,
                status: status || 'ADMINISTERED', // ADMINISTERED, MISSED, REFUSED
                notes,
            }
        });

        return NextResponse.json({ success: true, record }, { status: 201 });
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ success: false, error: 'Failed to record administration' }, { status: 500 });
    }
}
