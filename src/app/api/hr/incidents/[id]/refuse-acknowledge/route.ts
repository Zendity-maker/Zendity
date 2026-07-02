import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { notifyRoles } from '@/lib/notifications';
import { IncidentStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

// Sprint incident-refuse-signature (jul-2026).
// El empleado se NIEGA a firmar el acuse de una Observación de Personal.
// Registrar el rehúso (con motivo opcional) y notificar a DIRECTOR/ADMIN
// porque el rehúso se traduce en una reunión formal con administración.
//
// Reglas (espejo del /acknowledge):
//   - Solo el empleado-propio (employeeId === invokerId). Otro rol → 403.
//   - Solo si visibleToEmployee=true y status ∈ {PENDING_EXPLANATION, EXPLANATION_RECEIVED}.
//   - Excluyente con firmar: si ya firmó (acknowledgedAt) → 409.
//   - Write-once: si ya rehusó (acknowledgeRefusedAt) → 409.
//   - NO cambia status, NO toca employeeResponse ni la firma del supervisor.
const REFUSE_ALLOWED_STATUSES: IncidentStatus[] = [
    IncidentStatus.PENDING_EXPLANATION,
    IncidentStatus.EXPLANATION_RECEIVED,
];

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }
        const invokerId = (session.user as any).id;
        const hqId = (session.user as any).headquartersId;

        const body = await req.json().catch(() => ({}));
        const reasonRaw: unknown = body?.reason;
        const reason = typeof reasonRaw === 'string' && reasonRaw.trim() !== '' ? reasonRaw.trim() : null;

        const incident = await prisma.incidentReport.findUnique({
            where: { id },
            select: {
                id: true,
                employeeId: true,
                headquartersId: true,
                status: true,
                visibleToEmployee: true,
                acknowledgedAt: true,
                acknowledgeRefusedAt: true,
                employee: { select: { name: true } },
            },
        });

        if (!incident) {
            return NextResponse.json({ success: false, error: 'Observación no encontrada' }, { status: 404 });
        }
        if (incident.headquartersId !== hqId) {
            return NextResponse.json({ success: false, error: 'Tenant mismatch' }, { status: 403 });
        }
        if (incident.employeeId !== invokerId) {
            return NextResponse.json(
                { success: false, error: 'Solo el empleado puede registrar el rehúso' },
                { status: 403 }
            );
        }
        if (!incident.visibleToEmployee) {
            return NextResponse.json(
                { success: false, error: 'La observación aún no está visible para el empleado' },
                { status: 400 }
            );
        }
        if (!REFUSE_ALLOWED_STATUSES.includes(incident.status)) {
            return NextResponse.json(
                { success: false, error: `El rehúso no aplica en estado ${incident.status}` },
                { status: 400 }
            );
        }
        // Excluyente con firmar.
        if (incident.acknowledgedAt) {
            return NextResponse.json(
                { success: false, error: 'Esta observación ya fue firmada; no puede marcarse como rehusada' },
                { status: 409 }
            );
        }
        // Write-once.
        if (incident.acknowledgeRefusedAt) {
            return NextResponse.json(
                { success: false, error: 'El rehúso ya fue registrado' },
                { status: 409 }
            );
        }

        const updated = await prisma.incidentReport.update({
            where: { id },
            data: {
                acknowledgeRefusedAt: new Date(),
                acknowledgeRefusedReason: reason,
            },
            include: {
                employee: { select: { id: true, name: true, role: true, email: true } },
                supervisor: { select: { id: true, name: true, role: true } },
                hq: { select: { id: true, name: true } },
            },
        });

        // Trigger de reunión formal: notificar a DIRECTOR/ADMIN. Best-effort.
        try {
            await notifyRoles(hqId, ['DIRECTOR', 'ADMIN'], {
                // 'EMAR_ALERT' es el type que ya usan decide/respond para notifs
                // del módulo de observaciones HR — se mantiene por consistencia.
                type: 'EMAR_ALERT',
                title: 'Empleado rehusó firmar — requiere reunión formal',
                message: `${incident.employee?.name || 'El empleado'} se negó a firmar el acuse de una observación. Requiere reunión formal con administración.`,
                link: `/hr/incidents/${id}`,
            });
        } catch { /* no-fatal */ }

        return NextResponse.json({ success: true, incident: updated });
    } catch (error: any) {
        console.error('Error en refuse-acknowledge incident:', error?.message ?? error);
        return NextResponse.json(
            { success: false, error: 'Error al registrar el rehúso' },
            { status: 500 }
        );
    }
}
