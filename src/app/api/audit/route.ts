import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { resolveEffectiveHqId } from '@/lib/hq-resolver';

// GET: Fetch all incidents (pending signatures & history)
export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !['DIRECTOR', 'ADMIN', 'NURSE', 'SUPERVISOR'].includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }

        // hqId resuelto desde la sesión: DIRECTOR/ADMIN pueden cambiar de sede
        // (validado contra DB); roles limitados quedan en su propia sede.
        // Antes: hqId del query sin validar → NURSE/SUP leía incidents de otra sede.
        const { searchParams } = new URL(request.url);
        const hqId = await resolveEffectiveHqId(session, searchParams.get('hqId'));

        const incidents = await prisma.incident.findMany({
            where: {
                headquartersId: hqId
            },
            include: {
                patient: true,
            },
            orderBy: {
                reportedAt: 'desc'
            }
        });

        return NextResponse.json({ success: true, data: incidents });
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ success: false, error: 'Failed to fetch incidents' }, { status: 500 });
    }
}

// POST: Create a new incident (requires signature later or immediately)
export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !['DIRECTOR', 'ADMIN', 'NURSE', 'SUPERVISOR'].includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }

        const body = await request.json();
        const { patientId, type, severity, description, biometricSignature } = body;
        // hqId de la sesión (no del body) + verificar que el paciente sea de esa sede.
        const hqId = await resolveEffectiveHqId(session, body.hqId ?? null);
        const patientCheck = await prisma.patient.findFirst({
            where: { id: patientId, headquartersId: hqId },
            select: { id: true },
        });
        if (!patientCheck) {
            return NextResponse.json({ success: false, error: 'Residente fuera de tu sede' }, { status: 403 });
        }

        const incident = await prisma.incident.create({
            data: {
                headquartersId: hqId,
                patientId,
                type,
                severity,
                description,
                biometricSignature,
            }
        });

        return NextResponse.json({ success: true, incident }, { status: 201 });
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ success: false, error: 'Failed to record incident' }, { status: 500 });
    }
}
