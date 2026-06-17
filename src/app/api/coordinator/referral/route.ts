/**
 * POST /api/coordinator/referral
 *
 * Sprint Coordinador (jun-2026) — camino corto del referido. Una sola UI
 * en el hub "Comunicación Familiar" permite que coordinador/director/admin/
 * nurse despache una tarea hacia NURSE, SOCIAL_WORKER o ADMIN. Cero modelo
 * nuevo — debajo el switch reusa las piezas ya vivas:
 *
 *   - targetRole=NURSE         → TriageTicket (originType MANUAL,
 *                                 isEscalated=true) + notifyRoles a NURSE.
 *                                 Aparece en /care/supervisor wall.
 *   - targetRole=SOCIAL_WORKER → SocialWorkTask con createdById=invoker.
 *                                 Aparece en /corporate/social (lo ve el TS).
 *                                 El coordinador lo verá filtrado a SUS
 *                                 referidos via GET /api/social/tasks.
 *   - targetRole=ADMIN         → TriageTicket + notifyRoles a DIR+ADMIN.
 *
 * No expone PHI en respuesta — solo confirma creación + IDs. Multi-tenant
 * strict: hqId siempre de la sesión, patient se valida contra el hqId.
 * HIPAA: se loguea acceso al patient (referido es WRITE de carga de trabajo
 * ligada a un residente — equivalente a abrir una nota).
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { notifyRoles } from '@/lib/notifications';
import { logPhiAccess } from '@/lib/phi-audit';
import { logError } from '@/lib/logger';
import { PhiAccessAction } from '@prisma/client';

const ALLOWED_ROLES = ['COORDINATOR', 'DIRECTOR', 'ADMIN', 'NURSE'];
const TARGET_ROLES = ['NURSE', 'SOCIAL_WORKER', 'ADMIN'] as const;
type TargetRole = typeof TARGET_ROLES[number];

const TARGET_LABEL: Record<TargetRole, string> = {
    NURSE: 'Enfermería',
    SOCIAL_WORKER: 'Trabajo Social',
    ADMIN: 'Administración',
};

export async function POST(req: Request) {
    try {
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;
        const hqId = auth.headquartersId;

        const body = await req.json().catch(() => ({}));
        const { targetRole, patientId, description, priority } = body as {
            targetRole?: string;
            patientId?: string;
            description?: string;
            priority?: 'LOW' | 'NORMAL' | 'MEDIUM' | 'HIGH' | 'URGENT';
        };

        if (!targetRole || !TARGET_ROLES.includes(targetRole as TargetRole)) {
            return NextResponse.json(
                { success: false, error: 'targetRole inválido (NURSE | SOCIAL_WORKER | ADMIN)' },
                { status: 400 },
            );
        }
        if (!patientId) {
            return NextResponse.json({ success: false, error: 'patientId requerido' }, { status: 400 });
        }
        if (!description || description.trim().length < 5) {
            return NextResponse.json(
                { success: false, error: 'Descripción requerida (mínimo 5 caracteres)' },
                { status: 400 },
            );
        }

        // Tenant scope — paciente debe pertenecer a la sede del invoker.
        const patient = await prisma.patient.findFirst({
            where: { id: patientId, headquartersId: hqId },
            select: { id: true, name: true },
        });
        if (!patient) {
            return NextResponse.json({ success: false, error: 'Residente no encontrado' }, { status: 404 });
        }

        const target = targetRole as TargetRole;
        const trimmedDesc = description.trim();

        // PHI audit — WRITE ligado a un residente (carga de trabajo nueva).
        logPhiAccess({
            action: PhiAccessAction.WRITE,
            resourceType: 'CoordinatorReferral',
            patientId: patient.id,
            userId: auth.id,
            userRole: auth.role,
            hqId,
            success: true,
            routePath: '/api/coordinator/referral',
            context: { targetRole: target, priority: priority || 'NORMAL' },
        });

        let resultId: string;
        let kind: 'TriageTicket' | 'SocialWorkTask';

        if (target === 'SOCIAL_WORKER') {
            // Reusa el path canónico de TS: SocialWorkTask. El TS lo ve en
            // /corporate/social; el coordinador lo verá en GET filtrado.
            const task = await prisma.socialWorkTask.create({
                data: {
                    patientId: patient.id,
                    headquartersId: hqId,
                    createdById: auth.id,
                    title: `Referido del hub de coordinación familiar`,
                    description: trimmedDesc,
                    category: 'FAMILY',
                    priority: (priority === 'URGENT' || priority === 'HIGH') ? 'HIGH' : 'NORMAL',
                },
                select: { id: true },
            });
            resultId = task.id;
            kind = 'SocialWorkTask';

            // Notify SW team
            await notifyRoles(hqId, ['SOCIAL_WORKER', 'DIRECTOR', 'ADMIN'], {
                type: 'EMAR_ALERT',
                title: `📋 Referido a Trabajo Social — ${patient.name}`,
                message: trimmedDesc.slice(0, 140),
                link: '/corporate/social',
            });
        } else {
            // NURSE o ADMIN — TriageTicket con originType MANUAL. Aparece en
            // /care/supervisor (NURSE) o sirve como inbox de admin (DIR/ADMIN).
            // isEscalated=true para NURSE — replica el patrón de refer-nursing.
            const ticketPriority =
                priority === 'URGENT' ? 'CRITICAL'
                : priority === 'HIGH' ? 'HIGH'
                : priority === 'LOW' ? 'LOW'
                : 'MEDIUM';

            const ticket = await prisma.triageTicket.create({
                data: {
                    headquartersId: hqId,
                    patientId: patient.id,
                    originType: 'MANUAL',
                    priority: ticketPriority as any,
                    status: 'OPEN',
                    isEscalated: target === 'NURSE',
                    description: `[Referido del hub de coordinación — ${TARGET_LABEL[target]}] ${trimmedDesc}`,
                },
                select: { id: true },
            });
            resultId = ticket.id;
            kind = 'TriageTicket';

            // Notify destination role + supervisión
            const notifyTargets: string[] =
                target === 'NURSE'
                    ? ['NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN']
                    : ['DIRECTOR', 'ADMIN'];
            await notifyRoles(hqId, notifyTargets, {
                type: 'EMAR_ALERT',
                title: `📋 Referido a ${TARGET_LABEL[target]} — ${patient.name}`,
                message: trimmedDesc.slice(0, 140),
                link: target === 'NURSE' ? '/care/supervisor' : '/corporate/triage',
            });
        }

        return NextResponse.json({
            success: true,
            referralId: resultId,
            kind,
            targetRole: target,
        });
    } catch (err: any) {
        logError('coordinator.referral.post', err);
        return NextResponse.json({ success: false, error: 'Error creando referido' }, { status: 500 });
    }
}
