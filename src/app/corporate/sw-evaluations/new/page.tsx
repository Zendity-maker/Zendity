/**
 * GET /corporate/sw-evaluations/new?patientId=X
 *
 * Server-side prepara los pre-requisitos: rol, paciente existe en sede,
 * template activo en sede. Si algo falla, renderiza el cliente con un
 * error claro — NO crash, NO redirect agresivo.
 *
 * Si todo OK, pasa templateId al client que ejecuta el POST create y
 * redirige a /[id].
 */

import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import NewEvaluationClient from './client';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['SOCIAL_WORKER', 'DIRECTOR', 'ADMIN'];

export default async function NewEvaluationPage({
    searchParams,
}: {
    searchParams: Promise<{ patientId?: string }>;
}) {
    const { patientId } = await searchParams;

    const session = await getServerSession(authOptions);
    if (!session?.user) {
        redirect(`/login?callbackUrl=/corporate/sw-evaluations/new${patientId ? `?patientId=${patientId}` : ''}`);
    }
    const role = (session.user as any).role as string | undefined;
    if (!role || !ALLOWED_ROLES.includes(role)) {
        redirect('/');
    }
    const hqId = (session.user as any).headquartersId as string | undefined;
    if (!hqId) {
        return (
            <NewEvaluationClient
                preCheck={{ ok: false, error: 'sin sede asignada en tu cuenta. Contactá soporte.' }}
                patientId={null}
                templateId={null}
                patientName={null}
            />
        );
    }

    if (!patientId) {
        return (
            <NewEvaluationClient
                preCheck={{ ok: false, error: 'Falta el ID del residente en el URL. Volvé al perfil y entrá por el botón "Nueva evaluación".' }}
                patientId={null}
                templateId={null}
                patientName={null}
            />
        );
    }

    // Multi-tenant: paciente debe estar en mi HQ.
    const patient = await prisma.patient.findFirst({
        where: { id: patientId, headquartersId: hqId },
        select: { id: true, name: true, status: true },
    });
    if (!patient) {
        return (
            <NewEvaluationClient
                preCheck={{ ok: false, error: 'El residente no existe en esta sede o fue archivado.' }}
                patientId={patientId}
                templateId={null}
                patientName={null}
            />
        );
    }

    // Template activo de la sede — Fase 1 asume 1 template seedeado por HQ.
    // Si hay >1 en el futuro, lookup por `(headquartersId, key, version=max)`
    // o pasar templateId via query param.
    const template = await prisma.sWFormTemplate.findFirst({
        where: { headquartersId: hqId },
        orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
        select: { id: true, name: true },
    });
    if (!template) {
        return (
            <NewEvaluationClient
                preCheck={{ ok: false, error: 'Esta sede aún no tiene una plantilla de evaluación inicial activada. Contactá a soporte para habilitarla.' }}
                patientId={patientId}
                templateId={null}
                patientName={patient.name}
            />
        );
    }

    return (
        <NewEvaluationClient
            preCheck={{ ok: true }}
            patientId={patientId}
            templateId={template.id}
            patientName={patient.name}
        />
    );
}
