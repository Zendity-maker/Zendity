/**
 * GET /api/corporate/sw-evaluations/[id]/pdf
 *
 * Descarga el PDF de una SWEvaluation. DRAFT incluye watermark "BORRADOR",
 * APPROVED incluye el bloque de firma. Addendums (si existen) al final.
 *
 * Auth: SOCIAL_WORKER, DIRECTOR, ADMIN.
 * Multi-tenant: findFirst({ id, headquartersId: auth.hq }).
 * Audit: withPhiAccessLog action=EXPORT, resourceType=SocialWorkEvaluationPDF.
 *
 * Output: application/pdf con Content-Disposition: attachment.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { withPhiAccessLog } from '@/lib/phi-audit';
import { generateSWEvaluationPDF } from '@/lib/sw-evaluation/pdf';
import type { SWFormTemplateSchema } from '@/lib/sw-evaluation/template-types';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['SOCIAL_WORKER', 'DIRECTOR', 'ADMIN'];

export const GET = withPhiAccessLog(getPdfHandler, {
    resourceType: 'SocialWorkEvaluationPDF',
    getResourceId: async ({ params }) => (await params).id,
});

async function getPdfHandler(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireRole(ALLOWED_ROLES);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;

    const evaluation = await prisma.sWEvaluation.findFirst({
        where: { id, headquartersId: auth.headquartersId },
        include: {
            patient: { select: { name: true, dateOfBirth: true, roomNumber: true, status: true } },
            template: { select: { name: true, version: true, schema: true } },
            headquarters: {
                select: {
                    name: true, brandName: true, brandPrimary: true, logoUrl: true,
                    address: true, billingAddress: true, phone: true, licenseNumber: true,
                },
            },
            addendums: {
                orderBy: { createdAt: 'asc' },
                include: { createdBy: { select: { name: true } } },
            },
        },
    });

    if (!evaluation) {
        return NextResponse.json({ success: false, error: 'Evaluación no encontrada' }, { status: 404 });
    }

    const schema = evaluation.template.schema as unknown as SWFormTemplateSchema;

    const buffer = generateSWEvaluationPDF({
        hq: {
            name: evaluation.headquarters.name,
            brandName: evaluation.headquarters.brandName,
            brandPrimary: evaluation.headquarters.brandPrimary,
            logoUrl: evaluation.headquarters.logoUrl,
            address: evaluation.headquarters.address,
            billingAddress: evaluation.headquarters.billingAddress,
            phone: evaluation.headquarters.phone,
            licenseNumber: evaluation.headquarters.licenseNumber,
        },
        patient: {
            name: evaluation.patient.name,
            dateOfBirth: evaluation.patient.dateOfBirth,
            roomNumber: evaluation.patient.roomNumber,
            status: evaluation.patient.status,
        },
        template: {
            name: evaluation.template.name,
            version: evaluation.template.version,
            schema,
        },
        evaluation: {
            id: evaluation.id,
            status: evaluation.status,
            data: (evaluation.data as any) ?? {},
            prefillSnapshot: (evaluation.prefillSnapshot as any) ?? { prefill: {}, referenceData: {}, resolvedAt: '' },
            createdAt: evaluation.createdAt,
            approvedAt: evaluation.approvedAt,
            signerName: evaluation.signerName,
            signerCollegiateNumber: evaluation.signerCollegiateNumber,
            signatureBase64: evaluation.signatureBase64,
        },
        addendums: evaluation.addendums.map(a => ({
            id: a.id,
            content: a.content,
            reason: a.reason,
            createdAt: a.createdAt,
            createdByName: a.createdBy?.name ?? null,
            signatureBase64: a.signatureBase64,
        })),
        generatedAt: new Date(),
    });

    const safeName = (evaluation.headquarters.brandName || evaluation.headquarters.name).replace(/[^a-zA-Z0-9]/g, '_');
    const datePart = new Date().toISOString().slice(0, 10);
    const statusPart = evaluation.status.toLowerCase();
    const filename = `EvalSocial_${safeName}_${datePart}_${statusPart}_${evaluation.id.slice(0, 8)}.pdf`;

    return new NextResponse(buffer as any, {
        status: 200,
        headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Cache-Control': 'no-store',
        },
    });
}
