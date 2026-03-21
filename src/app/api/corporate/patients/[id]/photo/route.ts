import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const prisma = new PrismaClient();

export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const { id: patientId } = await params;
        const { photoUrl } = await req.json();

        if (!photoUrl) {
            return NextResponse.json({ success: false, error: 'No image provided' }, { status: 400 });
        }

        // Limit Base64 size if needed, though for avatars it's usually small.

        const updatedPatient = await prisma.patient.update({
            where: { id: patientId },
            data: { photoUrl }
        });

        return NextResponse.json({ success: true, photoUrl: updatedPatient.photoUrl });
    } catch (error: any) {
        console.error('Error updating patient photo:', error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
