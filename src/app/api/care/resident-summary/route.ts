import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['DIRECTOR', 'ADMIN', 'SUPERVISOR', 'NURSE', 'CAREGIVER'];

/**
 * GET /api/care/resident-summary?patientId=X
 *
 * Retorna TODOS los datos necesarios para el "Resumen de Residente"
 * — el documento oficial que se imprime al hospitalizar.
 */
export async function GET(req: Request) {
    try {
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;

        const invokerHqId = auth.headquartersId;
        const { searchParams } = new URL(req.url);
        const patientId = searchParams.get('patientId');
        if (!patientId) return NextResponse.json({ success: false, error: 'patientId requerido' }, { status: 400 });

        const patient = await prisma.patient.findFirst({
            where: { id: patientId, headquartersId: invokerHqId },
            include: {
                headquarters: {
                    select: { id: true, name: true, logoUrl: true, phone: true, billingAddress: true }
                },
                intakeData: true,
                medications: {
                    where: { isActive: true },
                    include: { medication: true },
                    orderBy: { startDate: 'desc' }
                },
                vitalSigns: {
                    orderBy: { createdAt: 'desc' },
                    take: 2,
                    include: { measuredBy: { select: { name: true, role: true } } }
                },
                familyMembers: {
                    orderBy: [{ accessLevel: 'asc' }, { name: 'asc' }],
                    select: {
                        id: true, name: true, email: true, phone: true,
                        relationship: true,
                        accessLevel: true, isRegistered: true,
                    }
                }
            }
        });

        if (!patient) {
            return NextResponse.json({ success: false, error: 'Residente no encontrado en tu sede' }, { status: 404 });
        }

        return NextResponse.json({ success: true, patient });
    } catch (err: any) {
        console.error('[resident-summary]', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
