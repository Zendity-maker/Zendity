/**
 * POST /api/corporate/sw-evaluations
 *
 * Crea una nueva SWEvaluation en estado DRAFT para el residente
 * especificado, contra el template especificado. Captura prefillSnapshot
 * en el momento de la creación (immutable).
 *
 * Body:
 *   { patientId: string, templateId: string }
 *
 * Output:
 *   { success, evaluation: { id, status, data, prefillSnapshot, templateVersion, ... } }
 *
 * Auth: SOCIAL_WORKER, DIRECTOR, ADMIN.
 * Multi-tenant: paciente Y template deben pertenecer al hq del invocador.
 * Audit: withPhiAccessLog action=WRITE, resourceType=SocialWorkEvaluation.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { withPhiAccessLog } from '@/lib/phi-audit';
import { resolvePrefill } from '@/lib/sw-evaluation/prefill-resolver';
import { buildInitialData } from '@/lib/sw-evaluation/build-initial-data';
import { loadPrefillSource } from '@/lib/sw-evaluation/load-prefill-source';
import type { SWFormTemplateSchema } from '@/lib/sw-evaluation/template-types';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['SOCIAL_WORKER', 'DIRECTOR', 'ADMIN'];

export const POST = withPhiAccessLog(postCreateHandler, {
    resourceType: 'SocialWorkEvaluation',
    getPatientId: async ({ req }) => {
        try {
            const body = await req.clone().json();
            return body?.patientId ?? undefined;
        } catch {
            return undefined;
        }
    },
});

async function postCreateHandler(req: Request) {
    const auth = await requireRole(ALLOWED_ROLES);
    if (auth instanceof NextResponse) return auth;

    const body = await req.json();
    const patientId: string | undefined = body?.patientId;
    const templateId: string | undefined = body?.templateId;
    if (!patientId || !templateId) {
        return NextResponse.json({ success: false, error: 'patientId y templateId son requeridos' }, { status: 400 });
    }

    // Multi-tenant: el paciente DEBE estar en el HQ del invocador.
    // Verifica antes de cargar el source (que ya filtra) para devolver 404
    // explícito si no existe.
    const patientCheck = await prisma.patient.findFirst({
        where: { id: patientId, headquartersId: auth.headquartersId },
        select: { id: true, status: true },
    });
    if (!patientCheck) {
        return NextResponse.json({ success: false, error: 'Residente no encontrado' }, { status: 404 });
    }

    // Multi-tenant: template del mismo HQ
    const template = await prisma.sWFormTemplate.findFirst({
        where: { id: templateId, headquartersId: auth.headquartersId, isActive: true },
        select: { id: true, version: true, schema: true },
    });
    if (!template) {
        return NextResponse.json({ success: false, error: 'Plantilla no encontrada o inactiva' }, { status: 404 });
    }

    // Resolver prefill desde la data del residente
    const src = await loadPrefillSource(prisma, patientId, auth.headquartersId);
    if (!src) {
        // No debería pasar — el patientCheck arriba ya confirmó, pero defensivo
        return NextResponse.json({ success: false, error: 'Residente no encontrado' }, { status: 404 });
    }

    const schema = template.schema as unknown as SWFormTemplateSchema;
    const prefillResult = resolvePrefill(schema, src);
    const { data, prefillSnapshot } = buildInitialData(schema, prefillResult);

    const evaluation = await prisma.sWEvaluation.create({
        data: {
            headquartersId: auth.headquartersId,
            patientId,
            templateId: template.id,
            templateVersion: template.version, // snapshot — no sigue al template si se versiona después
            status: 'DRAFT',
            data: data as any,
            prefillSnapshot: prefillSnapshot as any,
            createdById: auth.id,
        },
        select: {
            id: true, status: true, templateVersion: true,
            data: true, prefillSnapshot: true,
            patientId: true, templateId: true,
            createdById: true, createdAt: true, updatedAt: true,
        },
    });

    return NextResponse.json({ success: true, evaluation }, { status: 201 });
}
