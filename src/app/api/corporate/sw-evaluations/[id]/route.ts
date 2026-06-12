/**
 * PUT /api/corporate/sw-evaluations/[id]
 *
 * Actualiza el `data` de una SWEvaluation. Solo permitido si status=DRAFT.
 * Si está APPROVED o ARCHIVED → 409 (no edita).
 *
 * Body: { data: object }
 *
 * NO modifica prefillSnapshot (es inmutable desde el create).
 * NO modifica status (solo /approve lo hace).
 *
 * ─────────────────────────────────────────────────────────────────────────
 *
 * DELETE /api/corporate/sw-evaluations/[id]
 *
 * Descarta un DRAFT. APPROVED/ARCHIVED → 409 (los inmutables NO se borran,
 * usar addendum para correcciones legales). Borra junto a la eval cualquier
 * addendum asociado en cascada — esto NO debería ocurrir en DRAFT (los
 * addendums solo se permiten en APPROVED), pero el FK relation lo cubre por
 * defensa.
 *
 * Auth: SOCIAL_WORKER, DIRECTOR, ADMIN.
 * Multi-tenant: findFirst({ id, headquartersId: auth.hq }) — anti-cross-tenant.
 * Audit: withPhiAccessLog action=DELETE, resourceType=SocialWorkEvaluation.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { withPhiAccessLog } from '@/lib/phi-audit';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['SOCIAL_WORKER', 'DIRECTOR', 'ADMIN'];

export const PUT = withPhiAccessLog(putUpdateHandler, {
    resourceType: 'SocialWorkEvaluation',
    getResourceId: async ({ params }) => (await params).id,
});

export const DELETE = withPhiAccessLog(deleteDraftHandler, {
    resourceType: 'SocialWorkEvaluation',
    getResourceId: async ({ params }) => (await params).id,
});

async function putUpdateHandler(
    req: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    const auth = await requireRole(ALLOWED_ROLES);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const body = await req.json();
    const data = body?.data;
    if (data === undefined || data === null || typeof data !== 'object' || Array.isArray(data)) {
        return NextResponse.json({ success: false, error: 'data debe ser un objeto' }, { status: 400 });
    }

    // Multi-tenant: SIEMPRE findFirst con headquartersId del invocador.
    // Esta es la regla anti-cross-tenant del sprint HIPAA anterior — NO usar
    // findUnique solo por id en mutations sobre PHI.
    const existing = await prisma.sWEvaluation.findFirst({
        where: { id, headquartersId: auth.headquartersId },
        select: { id: true, status: true, patientId: true },
    });
    if (!existing) {
        return NextResponse.json({ success: false, error: 'Evaluación no encontrada' }, { status: 404 });
    }

    // Máquina de estados: solo DRAFT es editable.
    if (existing.status !== 'DRAFT') {
        return NextResponse.json(
            { success: false, error: `Evaluación en estado ${existing.status} es inmutable. Use addendum para agregar correcciones.` },
            { status: 409 },
        );
    }

    const updated = await prisma.sWEvaluation.update({
        where: { id },
        data: { data: data as any },
        select: {
            id: true, status: true, data: true,
            updatedAt: true, patientId: true,
        },
    });

    return NextResponse.json({ success: true, evaluation: updated });
}

// ─── DELETE — descartar DRAFT ────────────────────────────────────────────

async function deleteDraftHandler(
    _req: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    const auth = await requireRole(ALLOWED_ROLES);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;

    // Multi-tenant: idéntico al PUT — findFirst con headquartersId del invocador.
    // Una eval de otra sede NO puede borrarse (404 igual que si no existiera).
    const existing = await prisma.sWEvaluation.findFirst({
        where: { id, headquartersId: auth.headquartersId },
        select: { id: true, status: true, patientId: true },
    });
    if (!existing) {
        return NextResponse.json({ success: false, error: 'Evaluación no encontrada' }, { status: 404 });
    }

    // Máquina de estados: solo DRAFT se descarta. APPROVED/ARCHIVED son
    // legalmente inmutables — corrección requiere addendum, no delete.
    if (existing.status !== 'DRAFT') {
        return NextResponse.json(
            { success: false, error: `Evaluación en estado ${existing.status} es inmutable y NO puede descartarse. Use addendum para agregar correcciones.` },
            { status: 409 },
        );
    }

    // Transacción: borrar addendums (defensivo — DRAFT no debería tener) +
    // la evaluación. Cascade Prisma sobre la relación si está configurado;
    // si no, lo hacemos explícito.
    await prisma.$transaction(async (tx) => {
        await tx.sWEvaluationAddendum.deleteMany({ where: { evaluationId: id } });
        await tx.sWEvaluation.delete({ where: { id } });
    });

    return NextResponse.json({
        success: true,
        deleted: { id, patientId: existing.patientId },
    });
}
