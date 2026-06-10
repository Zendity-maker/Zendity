/**
 * POST /api/corporate/sw-evaluations/[id]/addendum
 *
 * Agrega un SWEvaluationAddendum a una SWEvaluation ya APPROVED.
 * El data original NO se muta — el addendum vive en su propia tabla y
 * aparece adjunto al final del PDF.
 *
 * Rechaza si la eval está en DRAFT (no tiene sentido anexar a algo que aún
 * se puede editar) o ARCHIVED (no se modifica nada).
 *
 * Body:
 *   {
 *     content: object | string,  // texto libre + JSON opcional
 *     reason: string,            // obligatorio (trazabilidad)
 *     signatureBase64?: string   // opcional — firma propia del addendum
 *   }
 *
 * Auth: SOCIAL_WORKER, DIRECTOR, ADMIN.
 * Multi-tenant: findFirst({ id, headquartersId }) — anti-cross-tenant.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { withPhiAccessLog } from '@/lib/phi-audit';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['SOCIAL_WORKER', 'DIRECTOR', 'ADMIN'];

export const POST = withPhiAccessLog(postAddendumHandler, {
    resourceType: 'SocialWorkEvaluationAddendum',
    getResourceId: async ({ params }) => (await params).id,
});

async function postAddendumHandler(
    req: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    const auth = await requireRole(ALLOWED_ROLES);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const body = await req.json();
    const content = body?.content;
    const reason: string | undefined = body?.reason;
    const signatureBase64: string | undefined = body?.signatureBase64;

    if (content === undefined || content === null) {
        return NextResponse.json({ success: false, error: 'content es requerido' }, { status: 400 });
    }
    if (!reason || typeof reason !== 'string' || reason.trim() === '') {
        return NextResponse.json({ success: false, error: 'reason es requerido (trazabilidad)' }, { status: 400 });
    }

    // Multi-tenant
    const existing = await prisma.sWEvaluation.findFirst({
        where: { id, headquartersId: auth.headquartersId },
        select: { id: true, status: true, patientId: true },
    });
    if (!existing) {
        return NextResponse.json({ success: false, error: 'Evaluación no encontrada' }, { status: 404 });
    }

    // State machine: solo se anexa a APPROVED.
    if (existing.status !== 'APPROVED') {
        return NextResponse.json(
            { success: false, error: `Solo se pueden agregar addendums a evaluaciones APPROVED. Estado actual: ${existing.status}` },
            { status: 409 },
        );
    }

    const normalizedContent = typeof content === 'string' ? { text: content } : content;

    const addendum = await prisma.sWEvaluationAddendum.create({
        data: {
            evaluationId: id,
            content: normalizedContent as any,
            reason,
            createdById: auth.id,
            signatureBase64: signatureBase64 ?? null,
        },
        select: {
            id: true, evaluationId: true, reason: true,
            createdById: true, createdAt: true,
        },
    });

    return NextResponse.json({ success: true, addendum }, { status: 201 });
}
