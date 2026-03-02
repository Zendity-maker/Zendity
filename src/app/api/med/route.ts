import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET: Fetch all pending medications
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const hqId = searchParams.get('hqId');

        if (!hqId) {
            return NextResponse.json({ error: 'hqId is required' }, { status: 400 });
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
        const body = await request.json();
        const { patientMedicationId, administeredById, status, notes } = body;

        const record = await prisma.medicationAdministration.create({
            data: {
                patientMedicationId,
                administeredById,
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
