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
 *
 * ─────────────────────────────────────────────────────────────────────────
 *
 * GET /api/corporate/sw-evaluations?patientId=X
 *
 * Lista todas las SWEvaluation de un residente. PHI surface (Fase 2 P8):
 *   - requireRole [SW, DIR, ADM]
 *   - withPhiAccessLog action=READ, resourceType=SocialWorkEvaluation
 *   - Multi-tenant: el paciente DEBE estar en el HQ del invocador
 *     (findFirst con hqId; si no matchea, 404 igual que si no existe — no
 *     revela cross-tenant)
 *   - findMany scoped a `headquartersId: auth.hq + patientId`
 *   - Orden: createdAt DESC (más reciente primero)
 *
 * Output:
 *   {
 *     success: true,
 *     evaluations: Array<{
 *       id, status, createdAt, updatedAt, approvedAt,
 *       signerName, createdByName, templateName, templateVersion
 *     }>
 *   }
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

export const GET = withPhiAccessLog(getListHandler, {
    resourceType: 'SocialWorkEvaluation',
    getPatientId: async ({ req }) => {
        try {
            const url = new URL(req.url);
            return url.searchParams.get('patientId') ?? undefined;
        } catch {
            return undefined;
        }
    },
});

// ─── GET — list evaluations por residente ────────────────────────────────

async function getListHandler(req: Request) {
    const auth = await requireRole(ALLOWED_ROLES);
    if (auth instanceof NextResponse) return auth;

    const url = new URL(req.url);
    const patientId = url.searchParams.get('patientId');
    if (!patientId) {
        return NextResponse.json(
            { success: false, error: 'patientId requerido como query param' },
            { status: 400 },
        );
    }

    // Multi-tenant guard: paciente DEBE existir en mi HQ. Si no, 404
    // explícito (mismo que cross-tenant — no revelamos si la eval existe).
    const patient = await prisma.patient.findFirst({
        where: { id: patientId, headquartersId: auth.headquartersId },
        select: { id: true },
    });
    if (!patient) {
        return NextResponse.json(
            { success: false, error: 'Residente no encontrado en esta sede' },
            { status: 404 },
        );
    }

    // findMany SCOPED al hqId del invocador (defensa-en-profundidad — aunque
    // el patient check ya lo cubre, mantenemos el filter por hqId aquí
    // también; cualquier futuro endpoint que reuse esta query lo hereda).
    const evaluations = await prisma.sWEvaluation.findMany({
        where: {
            patientId,
            headquartersId: auth.headquartersId,
        },
        orderBy: { createdAt: 'desc' },
        select: {
            id: true,
            status: true,
            createdAt: true,
            updatedAt: true,
            approvedAt: true,
            signerName: true,
            signerCollegiateNumber: true,
            templateVersion: true,
            template: { select: { name: true } },
            createdBy: { select: { id: true, name: true } },
            _count: { select: { addendums: true } },
        },
    });

    return NextResponse.json({
        success: true,
        evaluations: evaluations.map(e => ({
            id: e.id,
            status: e.status,
            createdAt: e.createdAt.toISOString(),
            updatedAt: e.updatedAt.toISOString(),
            approvedAt: e.approvedAt?.toISOString() ?? null,
            signerName: e.signerName,
            signerCollegiateNumber: e.signerCollegiateNumber,
            templateName: e.template.name,
            templateVersion: e.templateVersion,
            createdByName: e.createdBy?.name ?? null,
            addendumCount: e._count.addendums,
        })),
    });
}

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

    // Template debe ser PER-SEDE del invocador O PLATAFORMA (hqId=null).
    // Bloquea uso cross-tenant — un templateId de OTRA sede dará 404.
    const template = await prisma.sWFormTemplate.findFirst({
        where: {
            id: templateId,
            isActive: true,
            OR: [
                { headquartersId: auth.headquartersId },
                { headquartersId: null },
            ],
        },
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
