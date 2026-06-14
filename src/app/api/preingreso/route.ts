import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { deriveFloorFromRoom } from '@/lib/floor';

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !['DIRECTOR', 'ADMIN', 'NURSE'].includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }

        const body = await request.json();
        const { name, dateOfBirth, diagnostics, avdScore, diet } = body;
        // HIPAA/multi-tenant — la sede sale de la sesión, NUNCA del body
        // (antes: hqId del body permitía crear un residente en sede ajena).
        const hqId = (session.user as any).headquartersId;

        // Simulate Norton/Downton logic based on diagnostics or AVD
        const isHighRisk = avdScore >= 2 || (diagnostics || '').toLowerCase().includes('caida');

        // Multi-floor (jun-2026): floor derivado del roomNumber siempre.
        // El 'A-101' hardcoded NO matchea el patrón numérico → floor=null
        // (data anomaly visible en /corporate/live zombie chip bucket
        // 'unassigned' hasta que el director asigne cuarto real vía
        // PATCH /api/corporate/patients/[id]).
        const roomNumberForCreate = 'A-101';
        const patient = await prisma.patient.create({
            data: {
                name,
                headquartersId: hqId,
                diet: diet,
                avdScore: parseInt(avdScore, 10),
                downtonRisk: isHighRisk,
                nortonRisk: isHighRisk,
                roomNumber: roomNumberForCreate,
                floor: deriveFloorFromRoom(roomNumberForCreate),
            }
        });

        return NextResponse.json({ success: true, patient }, { status: 201 });
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ success: false, error: 'Failed to create patient' }, { status: 500 });
    }
}
