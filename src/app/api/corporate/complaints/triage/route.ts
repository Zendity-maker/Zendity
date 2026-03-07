import { NextResponse } from 'next/server';
import { PrismaClient, ComplaintStatus } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(req: Request) {
    try {
        const { complaintId, action, supervisorId } = await req.json();

        if (!complaintId || !action || !supervisorId) {
            return NextResponse.json({ success: false, error: "Faltan datos obligatorios de triaje" }, { status: 400 });
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
