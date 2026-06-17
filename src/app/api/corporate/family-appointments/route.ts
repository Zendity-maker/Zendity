import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { withPhiAccessLog, logPhiAccess } from '@/lib/phi-audit';
import { PhiAccessAction } from '@prisma/client';

const ALLOWED_ROLES = ['DIRECTOR', 'ADMIN', 'SUPERVISOR', 'NURSE', 'COORDINATOR'];

// GET — todas las citas de la sede, filtradas por status.
// PHI audit (Pilar 1) — lista multi-paciente. Wrap exterior captura el
// evento de lista; el handler emite además 1 fila logPhiAccess por cada
// paciente listado en el response — patrón "fila por paciente" para tener
// evidencia granular de qué residentes vio el actor en esta sesión.
// Sprint Coordinador (jun-2026): wrapped antes de exponer a COORDINATOR.
export const GET = withPhiAccessLog(getFamilyAppointmentsHandler, {
    resourceType: 'FamilyAppointmentList',
});

async function getFamilyAppointmentsHandler(req: Request) {
    try {
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;
        const hqId = auth.headquartersId;

        const { searchParams } = new URL(req.url);
        const status = searchParams.get('status') || 'PENDING'; // PENDING | APPROVED | REJECTED

        const appointments = await prisma.familyAppointment.findMany({
            where: { headquartersId: hqId, status },
            orderBy: { requestedDate: 'asc' },
            include: {
                patient:      { select: { name: true, roomNumber: true } },
                familyMember: { select: { name: true, email: true, relationship: true } },
                approvedBy:   { select: { name: true } },
            },
        });

        // Fila-por-paciente: emite un logPhiAccess por cada residente único
        // listado. Dedupe por patientId para evitar inflar el audit log
        // cuando un mismo residente tiene múltiples citas. Si appointments
        // está vacío, NO se emite ninguna fila adicional (el wrap exterior
        // ya registra el evento de la consulta vacía con patientId=null).
        const seen = new Set<string>();
        for (const ap of appointments) {
            if (!ap.patientId || seen.has(ap.patientId)) continue;
            seen.add(ap.patientId);
            logPhiAccess({
                action: PhiAccessAction.READ,
                resourceType: 'FamilyAppointment',
                resourceId: ap.id,
                patientId: ap.patientId,
                userId: auth.id,
                userRole: auth.role,
                hqId,
                success: true,
                routePath: '/api/corporate/family-appointments',
                context: { status, listSize: appointments.length },
            });
        }

        return NextResponse.json({ success: true, appointments });
    } catch (e) {
        console.error('[corporate/family-appointments GET]', e);
        return NextResponse.json({ success: false, error: 'Error al cargar citas' }, { status: 500 });
    }
}
