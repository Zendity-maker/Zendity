import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { ComplaintStatus } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

const ALLOWED_ROLES = ['SUPERVISOR', 'DIRECTOR', 'ADMIN', 'NURSE'];

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }
        if (!ALLOWED_ROLES.includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: 'Rol no autorizado' }, { status: 403 });
        }
        const invokerHqId = (session.user as any).headquartersId;

        const { complaintId, action, supervisorId } = await req.json();

        if (!complaintId || !action || !supervisorId) {
            return NextResponse.json({ success: false, error: "Faltan datos obligatorios de triaje" }, { status: 400 });
        }

        // Tenant check
        const existing = await prisma.complaint.findUnique({
            where: { id: complaintId },
            select: { headquartersId: true },
        });
        if (!existing || existing.headquartersId !== invokerHqId) {
            return NextResponse.json({ success: false, error: 'Queja fuera de tu sede' }, { status: 403 });
        }

        let newStatus: ComplaintStatus = 'PENDING';
        if (action === 'APPROVE_ADMIN') newStatus = 'APPROVED_ADMIN';
        if (action === 'ROUTE_NURSING') newStatus = 'ROUTED_NURSING';
        if (action === 'REJECT') newStatus = 'RESOLVED';

        const updatedComplaint = await prisma.complaint.update({
            where: { id: complaintId },
            data: { status: newStatus }
        });

        // ---------------------------------------------------------
        // RUTEO AUTOMÁTICO DEPENDE DEL TRIAJE 
        // ---------------------------------------------------------
        if (newStatus === 'APPROVED_ADMIN') {
            console.log(`[TRIAGE-AUTO] Queja o Feedback de Familiar (${complaintId}) enviado a Recepción, Admin, y Director.`);
            // TODO: Emitir a Panel Administrativo / Enviar Notificación In-App a roles ADMIN
        } else if (newStatus === 'ROUTED_NURSING') {
            console.log(`[TRIAGE-AUTO] Queja clínica (${complaintId}) auto-ruteada urgente a Enfermería.`);
            // TODO: Alertar a NURSE y DIRECTOR_OF_NURSING
        }

        return NextResponse.json({ success: true, complaint: updatedComplaint });

    } catch (error) {
        console.error("Triage POST Error:", error);
        return NextResponse.json({ success: false, error: "Fallo actualizando el estado de la queja" }, { status: 500 });
    }
}
