import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

// Cualquier rol staff — FAMILY no.
const STAFF_ROLES = ['CAREGIVER', 'NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN', 'SOCIAL_WORKER', 'KITCHEN', 'MAINTENANCE'];
const POST_ROLES = ['CAREGIVER', 'NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN'];

// GET: Fetch all pending medications para la sede del invocador
export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }
        const invokerRole = (session.user as any).role;
        const hqId = (session.user as any).headquartersId;
        if (!STAFF_ROLES.includes(invokerRole)) {
            return NextResponse.json({ error: 'Rol no autorizado' }, { status: 403 });
        }

        const patientMeds = await prisma.patientMedication.findMany({
            where: {
                patient: { headquartersId: hqId }
            },
            include: {
                patient: true,
                medication: true,
            }
        });

        return NextResponse.json({ success: true, data: patientMeds });
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
