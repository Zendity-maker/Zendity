import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { ComplaintStatus } from '@prisma/client';
import { requireRole } from '@/lib/api-auth';
import { notifyUser } from '@/lib/notifications';

// Solo direccion. El supervisor es el canal de ENTRADA de un senalamiento de
// familia — lo recibe y lo registra — pero no quien decide que se hace con el.
// Permitir SUPERVISOR y NURSE contradecia esa separacion: quien recoge la
// queja no deberia poder cerrarla.
//
// Este endpoint existia con las acciones APPROVE_ADMIN y ROUTE_NURSING y
// NINGUNA pantalla lo llamaba. Se construyo la mitad de direccion y se quedo
// sin cara, asi que el unico sitio donde un senalamiento se veia era el panel
// del supervisor — y ahi la unica accion era despacharlo a piso.
const ALLOWED_ROLES = ['DIRECTOR', 'ADMIN', 'SUPER_ADMIN'];

export async function POST(req: Request) {
    try {
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;
        const invokerHqId = auth.headquartersId;

        const { complaintId, action, supervisorId, nota } = await req.json();

        if (!complaintId || !action) {
            return NextResponse.json({ success: false, error: "Faltan datos obligatorios de triaje" }, { status: 400 });
        }

        // Tenant check
        const existing = await prisma.complaint.findUnique({
            where: { id: complaintId },
            select: { headquartersId: true },
        });
        if (!existing || existing.headquartersId !== invokerHqId) {
            return NextResponse.json({ success: false, error: 'Señalamiento fuera de tu sede' }, { status: 403 });
        }

        let newStatus: ComplaintStatus = 'PENDING';
        if (action === 'APPROVE_ADMIN') newStatus = 'APPROVED_ADMIN';
        if (action === 'ROUTE_NURSING') newStatus = 'ROUTED_NURSING';
        if (action === 'REJECT') newStatus = 'RESOLVED';

        const updatedComplaint = await prisma.complaint.update({
            where: { id: complaintId },
            data: {
                status: newStatus,
                // Cerrar sin decir por que deja el historial inservible: seis
                // meses despues nadie sabe que se hizo con aquel senalamiento.
                ...(nota?.trim() ? { resolutionNote: nota.trim() } : {}),
            },
        });

        // ---------------------------------------------------------
        // RUTEO AUTOMÁTICO DEPENDE DEL TRIAJE 
        // ---------------------------------------------------------
        // El ruteo era un console.log con un TODO al lado: el estado cambiaba y
        // no se enteraba nadie. Enrutar a enfermeria sin avisar a enfermeria es
        // el patron de "promete y no entrega" que venimos retirando.
        if (newStatus === 'ROUTED_NURSING') {
            const enfermeria = await prisma.user.findMany({
                where: {
                    headquartersId: invokerHqId,
                    isActive: true,
                    isDeleted: false,
                    OR: [
                        { role: 'NURSE' },
                        { secondaryRoles: { has: 'NURSE' } },
                    ],
                },
                select: { id: true },
            });
            for (const u of enfermeria) {
                await notifyUser(u.id, {
                    type: 'TRIAGE',
                    title: 'Señalamiento de familia enrutado a enfermería',
                    // Sin PHI en el cuerpo: quien lo recibe tiene acceso al
                    // expediente y entra a leerlo.
                    message: 'Dirección te asignó un señalamiento de familia para atender.',
                    link: '/corporate/senalamientos',
                });
            }
        }

        return NextResponse.json({ success: true, complaint: updatedComplaint });

    } catch (error) {
        console.error("Triage POST Error:", error);
        return NextResponse.json({ success: false, error: "Fallo actualizando el estado de la queja" }, { status: 500 });
    }
}
