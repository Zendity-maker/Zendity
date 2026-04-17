import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['DIRECTOR', 'ADMIN', 'SUPERVISOR', 'NURSE'];

/**
 * GET /api/corporate/family?patientId=X
 * Lista FamilyMember[] del residente, filtrado por la sede del usuario.
 */
export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });

        const role = (session.user as any).role;
        if (!ALLOWED_ROLES.includes(role)) {
            return NextResponse.json({ success: false, error: 'Prohibido' }, { status: 403 });
        }

        const hqId = (session.user as any).headquartersId;
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
