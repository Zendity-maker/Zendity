import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

// Hub compartido — Sprint Coordinador (jun-2026): COORDINATOR añadido.
const ALLOWED_ROLES = ['DIRECTOR', 'ADMIN', 'SUPERVISOR', 'NURSE', 'COORDINATOR'];

/**
 * GET /api/corporate/family?patientId=X
 * Lista FamilyMember[] del residente, filtrado por la sede del usuario.
 */
export async function GET(req: Request) {
    try {
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;
        const hqId = auth.headquartersId;
        const { searchParams } = new URL(req.url);
        const patientId = searchParams.get('patientId');
        if (!patientId) return NextResponse.json({ success: false, error: 'patientId requerido' }, { status: 400 });

        // Verificar que el paciente pertenece a la sede del usuario
        const patient = await prisma.patient.findFirst({
            where: { id: patientId, headquartersId: hqId },
            select: { id: true }
        });
        if (!patient) return NextResponse.json({ success: false, error: 'Residente no encontrado' }, { status: 404 });

        const familyMembers = await prisma.familyMember.findMany({
            where: { patientId, headquartersId: hqId },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                relationship: true,
                accessLevel: true,
                isRegistered: true,
                inviteExpiry: true,
            },
            orderBy: [{ isRegistered: 'desc' }, { name: 'asc' }],
        });

        return NextResponse.json({ success: true, familyMembers });
    } catch (err: any) {
        console.error('[Family GET]', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
