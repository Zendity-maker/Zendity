/**
 * POST /api/corporate/sw-evaluations/[id]/approve
 *
 * Aprueba (firma) una SWEvaluation en DRAFT. Transición DRAFT → APPROVED.
 *
 * Sin firma NO aprueba: signatureBase64 es obligatorio.
 * Toma snapshot inmutable de signerName + signerCollegiateNumber del usuario
 * (User.collegiateNumber) en el momento del approve. Si User.collegiateNumber
 * está vacío, el snapshot es null — la TS debería configurarlo en su perfil
 * antes de firmar evaluaciones legales.
 *
 * Después de APPROVED:
 *   - data es INMUTABLE (PUT /[id] devuelve 409)
 *   - Solo se permite addendum
 *   - Re-approve de un APPROVED es rechazado
 *
 * Body: { signatureBase64: string }
 *
 * Auth: SOCIAL_WORKER, DIRECTOR, ADMIN.
 * Multi-tenant: findFirst({ id, headquartersId }) en TODA carga.
 *
 * Fase 2: sin gate de completitud — la TS decide cuándo está lista.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { withPhiAccessLog } from '@/lib/phi-audit';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['SOCIAL_WORKER', 'DIRECTOR', 'ADMIN'];

export const POST = withPhiAccessLog(postApproveHandler, {
    resourceType: 'SocialWorkEvaluation',
    getResourceId: async ({ params }) => (await params).id,
});

async function postApproveHandler(
    req: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    const auth = await requireRole(ALLOWED_ROLES);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const body = await req.json();
    const signatureBase64: string | undefined = body?.signatureBase64;
    if (!signatureBase64 || typeof signatureBase64 !== 'string' || signatureBase64.trim() === '') {
        return NextResponse.json({ success: false, error: 'signatureBase64 es requerido para aprobar' }, { status: 400 });
    }

    // Multi-tenant
    const existing = await prisma.sWEvaluation.findFirst({
        where: { id, headquartersId: auth.headquartersId },
        select: { id: true, status: true, patientId: true },
    });
    if (!existing) {
        return NextResponse.json({ success: false, error: 'Evaluación no encontrada' }, { status: 404 });
    }

    // State machine: solo DRAFT → APPROVED.
    if (existing.status !== 'DRAFT') {
        return NextResponse.json(
            { success: false, error: `Evaluación en estado ${existing.status} no puede aprobarse de nuevo` },
            { status: 409 },
        );
    }

    // Snapshot del firmante: nombre + #colegiado del invocador en este momento.
    const signer = await prisma.user.findUnique({
        where: { id: auth.id },
        select: { name: true, collegiateNumber: true },
    });
    // signer no debería ser null (auth ya validó), pero defensivo
    const signerName = signer?.name ?? null;
    const signerCollegiateNumber = signer?.collegiateNumber ?? null;

    const approved = await prisma.sWEvaluation.update({
        where: { id },
        data: {
            status: 'APPROVED',
            approvedById: auth.id,
            approvedAt: new Date(),
            signatureBase64,
            signerName,
            signerCollegiateNumber,
        },
        select: {
            id: true, status: true,
            approvedById: true, approvedAt: true,
            signerName: true, signerCollegiateNumber: true,
            patientId: true,
        },
    });

    return NextResponse.json({ success: true, evaluation: approved });
}
