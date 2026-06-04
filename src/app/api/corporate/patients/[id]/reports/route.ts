import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { withPhiAccessLog } from '@/lib/phi-audit';

/**
 * HIPAA — Este endpoint devuelve notas clínicas del residente.
 * Antes estaba sin auth. Ahora restringido a personal clínico + tenant check.
 */
const ALLOWED_ROLES = ['SUPERVISOR', 'DIRECTOR', 'ADMIN', 'NURSE'];

// PHI audit (Pilar 1) — lectura de notas clínicas.
export const GET = withPhiAccessLog(getPatientReportsHandler, {
    resourceType: 'Note',
    getPatientId: async ({ params }) => (await params).id,
});

async function getPatientReportsHandler(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;
        const invokerHqId = auth.headquartersId;

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
