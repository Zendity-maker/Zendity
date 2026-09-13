import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { IncidentStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

// Sprint incident-employee-acknowledge (jun-2026).
// Acuse de recibo del empleado sobre un IncidentReport (Observación de Personal).
// Acuse = RECIBO, NO acuerdo. La explicación opcional (employeeResponse) vive
// en /respond y queda intacta — este endpoint NO la toca.
//
// Reglas:
//   - Solo el empleado-propio (employeeId === invokerId). Otro rol → 403.
//   - Solo si visibleToEmployee=true y status ∈ {PENDING_EXPLANATION, EXPLANATION_RECEIVED}.
//   - Write-once: si acknowledgedAt ya está seteado → 409.
//   - NO cambia status, NO toca employeeResponse ni la firma del supervisor
//     (signatureBase64/signedAt). Escribe solamente acknowledgedAt + acknowledgedSignature.
const ACK_ALLOWED_STATUSES: IncidentStatus[] = [
    IncidentStatus.PENDING_EXPLANATION,
    IncidentStatus.EXPLANATION_RECEIVED,
    // APPLIED también: en Cupey hay 78 observaciones aplicadas sin una sola
    // firma ni negativa, porque hasta hoy se aplicaba sin pasar por la
    // notificación. Poder firmar después permite regularizarlas en vez de
    // dejar un hueco permanente en el expediente.
    IncidentStatus.APPLIED,
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

        const body = await req.json();
        const signatureBase64: string | undefined = body?.signatureBase64;
        if (!signatureBase64 || typeof signatureBase64 !== 'string' || signatureBase64.trim() === '') {
            return NextResponse.json(
                { success: false, error: 'Firma requerida para acusar recibo' },
                { status: 400 }
            );
        }

        const incident = await prisma.incidentReport.findUnique({
            where: { id },
            select: {
                id: true,
                employeeId: true,
                headquartersId: true,
                status: true,
                visibleToEmployee: true,
                acknowledgedAt: true,
            },
        });

        if (!incident) {
            return NextResponse.json({ success: false, error: 'Observación no encontrada' }, { status: 404 });
        }
        if (incident.headquartersId !== hqId) {
            return NextResponse.json({ success: false, error: 'Tenant mismatch' }, { status: 403 });
        }
        // Solo el empleado objeto del reporte puede acusar.
        if (incident.employeeId !== invokerId) {
            return NextResponse.json(
                { success: false, error: 'Solo el empleado puede acusar recibo' },
                { status: 403 }
            );
        }
        if (!incident.visibleToEmployee) {
            return NextResponse.json(
                { success: false, error: 'La observación aún no está visible para el empleado' },
                { status: 400 }
            );
        }
        if (!ACK_ALLOWED_STATUSES.includes(incident.status)) {
            return NextResponse.json(
                { success: false, error: `El acuse no aplica en estado ${incident.status}` },
                { status: 400 }
            );
        }
        // Write-once: una vez firmado, no se re-firma.
        if (incident.acknowledgedAt) {
            return NextResponse.json(
                { success: false, error: 'Esta observación ya fue acusada' },
                { status: 409 }
            );
        }

        /**
         * La condición del write-once va DENTRO de la escritura, no solo en el
         * `if` de arriba.
         *
         * Con un read-then-update, dos peticiones a la vez —un doble toque en
         * la tableta, o un reintento porque la pantalla se vio lenta— pasan las
         * dos el `if` y escriben las dos: la segunda pisa la firma y la hora de
         * la primera. En el rehúso es peor todavía, porque el schema declara
         * firma y rehúso como excluyentes y no hay constraint que lo imponga.
         *
         * Hasta hoy esto no se podía dar: nadie había podido firmar nunca
         * porque la pantalla del empleado no tenía el botón. A partir de ahora sí.
         */
        const escrito = await prisma.incidentReport.updateMany({
            where: { id, acknowledgedAt: null, acknowledgeRefusedAt: null },
            data: {
                acknowledgedAt: new Date(),
                acknowledgedSignature: signatureBase64,
            },
        });

        const updated = await prisma.incidentReport.findUnique({
            where: { id },
            include: {
                employee: { select: { id: true, name: true, role: true, email: true } },
                supervisor: { select: { id: true, name: true, role: true } },
                hq: { select: { id: true, name: true } },
            },
        });

        // Si perdió la carrera, el acuse igual está hecho: se devuelve éxito con
        // la fila que ganó. Un rojo aquí le haría pulsar otra vez a alguien que
        // ya hizo lo correcto.
        return NextResponse.json({ success: true, yaEstaba: escrito.count === 0, incident: updated });
    } catch (error: any) {
        console.error('Error en acknowledge incident:', error?.message ?? error);
        return NextResponse.json(
            { success: false, error: 'Error al acusar recibo' },
            { status: 500 }
        );
    }
}
