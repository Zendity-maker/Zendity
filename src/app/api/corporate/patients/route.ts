import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }

        const hqId = (session.user as any).headquartersId;

        // Obtain ALL patients without filtering by isActive = true (We need Temporary Leave and Discharged too)
        const patients = await prisma.patient.findMany({
            where: {
                headquartersId: hqId,
            },
            orderBy: [
                { status: 'asc' }, // ACTIVE first
                { name: 'asc' }
            ]
        });

        // Format to simplify usage in the frontend table
        const formattedPatients = patients.map(p => ({
            id: p.id,
            name: p.name,
            status: p.status || 'ACTIVE',
            roomNumber: p.roomNumber || 'N/A',
            colorGroup: 'UNASSIGNED',
            clinicalRisk: p.downtonRisk ? 'HIGH' : 'MODERATE',
            leaveType: p.leaveType || null,
            photoUrl: p.photoUrl || null,
            joinDate: p.createdAt
        }));

        return NextResponse.json({ success: true, patients: formattedPatients });

    } catch (error: any) {
        console.error('Error fetching Master Patient Directory:', error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
