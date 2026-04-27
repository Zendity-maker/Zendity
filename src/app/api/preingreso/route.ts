import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !['DIRECTOR', 'ADMIN', 'NURSE'].includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }

        const body = await request.json();
        const { name, dateOfBirth, diagnostics, avdScore, diet, hqId } = body;

        // Simulate Norton/Downton logic based on diagnostics or AVD
        const isHighRisk = avdScore >= 2 || (diagnostics || '').toLowerCase().includes('caida');

        const patient = await prisma.patient.create({
            data: {
                name,
                headquartersId: hqId,
                diet: diet,
                avdScore: parseInt(avdScore, 10),
                downtonRisk: isHighRisk,
                nortonRisk: isHighRisk,
                roomNumber: 'A-101', // Assigned logically in a real app
            }
        });

        return NextResponse.json({ success: true, patient }, { status: 201 });
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ success: false, error: 'Failed to create patient' }, { status: 500 });
    }
}
