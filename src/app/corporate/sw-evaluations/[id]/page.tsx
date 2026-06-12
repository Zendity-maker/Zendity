/**
 * GET /corporate/sw-evaluations/[id]
 *
 * Página full-screen de la evaluación de Trabajo Social. Server-side carga
 * eval + template + paciente + sede + addendums, todo multi-tenant scoped a
 * la sede del invocador. Page-level guard: solo SOCIAL_WORKER / DIRECTOR /
 * ADMIN.
 *
 * Renderiza el cliente (P5b) que combina:
 *   - SWEvaluationFormRenderer (mode-aware)
 *   - useAutosaveEvaluation (DRAFT)
 *   - SignatureApprovalModal (DRAFT → APPROVED)
 *   - Addendum panel (APPROVED)
 *   - Descargar PDF (cualquier estado)
 */

import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import EvaluationPageClient from './client';
import type { SWFormTemplateSchema } from '@/lib/sw-evaluation/template-types';
import type { EvaluationPrefillSnapshot } from '@/lib/sw-evaluation/ui-types';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['SOCIAL_WORKER', 'DIRECTOR', 'ADMIN'];

export default async function EvaluationPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    const session = await getServerSession(authOptions);
    if (!session?.user) {
        // Sin sesión → AuthContext del client va a redirigir; aquí mantenemos
        // el guard server-side por defense-in-depth.
        redirect(`/login?callbackUrl=/corporate/sw-evaluations/${id}`);
    }
    const role = (session.user as any).role as string | undefined;
    if (!role || !ALLOWED_ROLES.includes(role)) {
        redirect('/');
    }
    const hqId = (session.user as any).headquartersId as string | undefined;
    if (!hqId) notFound();

    // Multi-tenant findFirst (anti-cross-tenant)
    const evaluation = await prisma.sWEvaluation.findFirst({
        where: { id, headquartersId: hqId },
        include: {
            patient: {
                select: { id: true, name: true, dateOfBirth: true, roomNumber: true, status: true },
            },
            template: { select: { id: true, name: true, version: true, schema: true } },
            headquarters: {
                select: {
                    id: true, name: true, brandName: true, brandPrimary: true,
                    logoUrl: true, address: true, phone: true, licenseNumber: true,
                },
            },
            addendums: {
                orderBy: { createdAt: 'asc' },
                include: { createdBy: { select: { id: true, name: true } } },
            },
        },
    });

    if (!evaluation) notFound();

    // Cast a los tipos UI (prisma Json → schema tipado, snapshot tipado)
    const schema = evaluation.template.schema as unknown as SWFormTemplateSchema;
    const prefillSnapshot = (evaluation.prefillSnapshot ?? {
        prefill: {}, referenceData: {}, unmapped: [], resolvedAt: '',
    }) as unknown as EvaluationPrefillSnapshot;
    const data = (evaluation.data as Record<string, unknown> | null) ?? {};

    return (
        <EvaluationPageClient
            evaluation={{
                id: evaluation.id,
                status: evaluation.status,
                createdAt: evaluation.createdAt.toISOString(),
                approvedAt: evaluation.approvedAt?.toISOString() ?? null,
                signerName: evaluation.signerName,
                signerCollegiateNumber: evaluation.signerCollegiateNumber,
            }}
            schema={schema}
            initialData={data}
            prefillSnapshot={prefillSnapshot}
            patient={{
                id: evaluation.patient.id,
                name: evaluation.patient.name,
                roomNumber: evaluation.patient.roomNumber,
            }}
            hq={{
                name: evaluation.headquarters.name,
                brandName: evaluation.headquarters.brandName,
                brandPrimary: evaluation.headquarters.brandPrimary,
                logoUrl: evaluation.headquarters.logoUrl,
            }}
            currentUser={{
                role,
                hasCollegiateNumber: false, // se completa en client via session check si hace falta
            }}
            addendums={evaluation.addendums.map(a => ({
                id: a.id,
                content: a.content,
                reason: a.reason,
                createdAt: a.createdAt.toISOString(),
                createdByName: a.createdBy?.name ?? null,
            }))}
        />
    );
}
