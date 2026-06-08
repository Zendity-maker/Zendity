import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { withPhiAccessLog } from '@/lib/phi-audit';
import { logError } from '@/lib/logger';

const SW_ALLOWED = ['SOCIAL_WORKER', 'DIRECTOR', 'ADMIN'];

async function getHandler(req: Request) {
    try {
        const auth = await requireRole(SW_ALLOWED);
        if (auth instanceof NextResponse) return auth;

        const { searchParams } = new URL(req.url);
        const patientId = searchParams.get('patientId');
        if (!patientId) {
            return NextResponse.json({ success: false, error: 'patientId requerido' }, { status: 400 });
        }

        const benefits = await prisma.socialWorkBenefit.findMany({
            where: { patientId, headquartersId: auth.headquartersId },
            orderBy: { type: 'asc' },
        });

        return NextResponse.json({ success: true, benefits });
    } catch (error) {
        logError('social.benefits.get', error);
        return NextResponse.json({ success: false, error: 'Error cargando beneficios' }, { status: 500 });
    }
}

async function postHandler(req: Request) {
    try {
        const auth = await requireRole(SW_ALLOWED);
        if (auth instanceof NextResponse) return auth;

        const { patientId, type, status, details, expirationDate } = await req.json();
        if (!patientId || !type) {
            return NextResponse.json({ success: false, error: 'patientId y type requeridos' }, { status: 400 });
        }

        // Tenant-scope: el patient DEBE pertenecer a la HQ del invoker.
        const patient = await prisma.patient.findFirst({
            where: { id: patientId, headquartersId: auth.headquartersId },
            select: { id: true },
        });
        if (!patient) {
            return NextResponse.json({ success: false, error: 'Residente no encontrado' }, { status: 404 });
        }

        const benefit = await prisma.socialWorkBenefit.create({
            data: {
                patientId,
                headquartersId: auth.headquartersId,
                type,
                status: status || 'ACTIVE',
                details: details || null,
                expirationDate: expirationDate ? new Date(expirationDate) : null,
            },
        });

        return NextResponse.json({ success: true, benefit });
    } catch (error) {
        logError('social.benefits.post', error);
        return NextResponse.json({ success: false, error: 'Error creando beneficio' }, { status: 500 });
    }
}

async function patchHandler(req: Request) {
    try {
        const auth = await requireRole(SW_ALLOWED);
        if (auth instanceof NextResponse) return auth;

        const { benefitId, status, details, expirationDate } = await req.json();
        if (!benefitId) {
            return NextResponse.json({ success: false, error: 'benefitId requerido' }, { status: 400 });
        }

        // Tenant-scope: validar que el benefit pertenezca a la HQ del invoker
        // ANTES de actualizar. Cierra el vector cross-tenant PATCH.
        const benefit = await prisma.socialWorkBenefit.findFirst({
            where: { id: benefitId, headquartersId: auth.headquartersId },
            select: { id: true },
        });
        if (!benefit) {
            return NextResponse.json({ success: false, error: 'Beneficio no encontrado' }, { status: 404 });
        }

        const updateData: any = {};
        if (status) updateData.status = status;
        if (details !== undefined) updateData.details = details;
        if (expirationDate !== undefined) updateData.expirationDate = expirationDate ? new Date(expirationDate) : null;

        const updated = await prisma.socialWorkBenefit.update({
            where: { id: benefitId },
            data: updateData,
        });

        return NextResponse.json({ success: true, benefit: updated });
    } catch (error) {
        logError('social.benefits.patch', error);
        return NextResponse.json({ success: false, error: 'Error actualizando beneficio' }, { status: 500 });
    }
}

// PHI audit (HIPAA Pilar 1).
export const GET = withPhiAccessLog(getHandler, {
    resourceType: 'SocialWorkBenefit',
    getPatientId: ({ req }) => new URL(req.url).searchParams.get('patientId') ?? undefined,
});
export const POST = withPhiAccessLog(postHandler, { resourceType: 'SocialWorkBenefit' });
export const PATCH = withPhiAccessLog(patchHandler, { resourceType: 'SocialWorkBenefit' });
