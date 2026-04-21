import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

/**
 * HIPAA — Este endpoint devuelve notas clínicas del residente.
 * Antes estaba sin auth. Ahora restringido a personal clínico + tenant check.
 */
const ALLOWED_ROLES = ['SUPERVISOR', 'DIRECTOR', 'ADMIN', 'NURSE'];

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }
        if (!ALLOWED_ROLES.includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: 'Rol no autorizado' }, { status: 403 });
        }
        const invokerHqId = (session.user as any).headquartersId;

        const resolvedParams = await params;
        const patientId = resolvedParams.id;

        // Tenant check HIPAA
        const patientCheck = await prisma.patient.findUnique({
            where: { id: patientId },
            select: { headquartersId: true },
        });
        if (!patientCheck || patientCheck.headquartersId !== invokerHqId) {
            return NextResponse.json({ success: false, error: 'Residente fuera de tu sede' }, { status: 403 });
        }

        const notes = await prisma.clinicalNote.findMany({
            where: { patientId },
            include: { author: { select: { name: true, role: true } } },
            orderBy: { createdAt: 'desc' }
        });
        return NextResponse.json({ success: true, notes });
    } catch (e: unknown) {
        return NextResponse.json({ success: false, error: (e as Error).message }, { status: 500 });
    }
}
