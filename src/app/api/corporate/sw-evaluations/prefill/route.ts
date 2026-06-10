/**
 * GET /api/corporate/sw-evaluations/prefill?patientId=X&templateId=Y
 *
 * Paso 4 del Sprint SW Eval Fase 1.
 *
 * Devuelve el blob de pre-llenado para una evaluación NUEVA del template
 * especificado, contra el residente especificado. NO persiste — solo
 * computa y devuelve. La persistencia del prefillSnapshot ocurre en Paso 5
 * al crear el SWEvaluation row.
 *
 * Output shape:
 *   {
 *     success: true,
 *     template: { id, name, version, schemaVersion, sections, ... },
 *     patient:  { id, name, dateOfBirth, status },
 *     prefill:  { [field.key]: value for READ_ONLY + REFERENCE },
 *     referenceData: { [field.key]: hint for NONE+prefillFrom },
 *     unmapped: string[]  // paths del template que el resolver no supo (audit)
 *   }
 *
 * Acceso: SOCIAL_WORKER, DIRECTOR, ADMIN. Multi-tenant: patient debe
 * pertenecer al headquartersId del invocador. PHI audit con
 * withPhiAccessLog action=READ, resourceType=SocialWorkEvaluationPrefill.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { withPhiAccessLog } from '@/lib/phi-audit';
import { resolvePrefill } from '@/lib/sw-evaluation/prefill-resolver';
import { loadPrefillSource } from '@/lib/sw-evaluation/load-prefill-source';
import type { SWFormTemplateSchema } from '@/lib/sw-evaluation/template-types';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['SOCIAL_WORKER', 'DIRECTOR', 'ADMIN'];

export const GET = withPhiAccessLog(getPrefillHandler, {
    resourceType: 'SocialWorkEvaluationPrefill',
    getPatientId: ({ req }) => new URL(req.url).searchParams.get('patientId') ?? undefined,
});

async function getPrefillHandler(req: Request) {
    const auth = await requireRole(ALLOWED_ROLES);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(req.url);
    const patientId = searchParams.get('patientId');
    const templateId = searchParams.get('templateId');

    if (!patientId || !templateId) {
        return NextResponse.json(
            { success: false, error: 'patientId y templateId son requeridos' },
            { status: 400 },
        );
    }

    // Patient stub para el response (multi-tenant check + status)
    const patientStub = await prisma.patient.findFirst({
        where: { id: patientId, headquartersId: auth.headquartersId },
        select: { id: true, name: true, status: true },
    });
    if (!patientStub) {
        return NextResponse.json({ success: false, error: 'Residente no encontrado' }, { status: 404 });
    }

    // Template del mismo HQ
    const template = await prisma.sWFormTemplate.findFirst({
        where: { id: templateId, headquartersId: auth.headquartersId, isActive: true },
        select: { id: true, name: true, version: true, description: true, schema: true },
    });
    if (!template) {
        return NextResponse.json({ success: false, error: 'Plantilla no encontrada o inactiva' }, { status: 404 });
    }

    // Cargar source vía helper compartido (mismo que usa el create endpoint)
    const src = await loadPrefillSource(prisma, patientId, auth.headquartersId);
    if (!src) {
        return NextResponse.json({ success: false, error: 'Residente no encontrado' }, { status: 404 });
    }

    const schema = template.schema as unknown as SWFormTemplateSchema;
    const { prefill, referenceData, unmapped } = resolvePrefill(schema, src);

    return NextResponse.json({
        success: true,
        template: {
            id: template.id,
            name: template.name,
            version: template.version,
            description: template.description,
            schemaVersion: schema.schemaVersion,
            sections: schema.sections,
        },
        patient: patientStub,
        prefill,
        referenceData,
        unmapped,
    });
}
