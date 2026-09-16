import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

/**
 * COMPLETAR EL MOTIVO DE UNA AUSENCIA YA MARCADA.
 *
 * Pedido por Andrés el 16-sep-2026: "sería bueno que se pueda llenar en el
 * perfil en caso de que el motivo aún no se haya confirmado al momento de
 * marcar la ausencia".
 *
 * Es el otro extremo de la salida honesta. Al marcar a alguien ausente a las
 * siete de la mañana muchas veces no se sabe por qué: la persona contesta el
 * teléfono a media mañana. Sin un sitio donde completarlo después, obligar a
 * poner un motivo en el momento solo consigue que se ponga uno inventado.
 *
 * Esta ruta NO marca ausencias — para eso está el POST de al lado. Solo
 * completa o corrige el motivo, el aviso y la nota de una que ya existe.
 *
 * Por qué importa el campo `absenceNotified`: el detector de patrones cuenta
 * SOLO las ausencias sin aviso para levantar una observación disciplinaria. Una
 * ausencia mal anotada como "sin aviso" empuja a alguien hacia una sanción.
 */
const ALLOWED_ROLES = ['DIRECTOR', 'ADMIN', 'SUPERVISOR', 'HR_MANAGER'];

const REASONS = ['SICK', 'FAMILY_EMERGENCY', 'MEDICAL_APPOINTMENT', 'PERSONAL', 'NO_SHOW', 'OTHER', 'PENDIENTE_CONFIRMAR'];

export async function POST(req: Request) {
    try {
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;
        const hqId = auth.headquartersId;

        const body = await req.json();
        const { scheduledShiftId } = body;

        if (!scheduledShiftId) {
            return NextResponse.json({ success: false, error: 'scheduledShiftId es requerido' }, { status: 400 });
        }
        if (!REASONS.includes(body.absenceReason)) {
            return NextResponse.json({ success: false, error: 'Motivo no válido' }, { status: 400 });
        }

        // Tenant check y estado: solo se completa lo que ya está marcado ausente.
        const turno = await prisma.scheduledShift.findUnique({
            where: { id: scheduledShiftId },
            select: {
                isAbsent: true, absentClearedAt: true,
                schedule: { select: { headquartersId: true } },
                user: { select: { name: true } },
            },
        });
        if (!turno || turno.schedule.headquartersId !== hqId) {
            return NextResponse.json({ success: false, error: 'Turno fuera de tu sede' }, { status: 403 });
        }
        if (!turno.isAbsent || turno.absentClearedAt) {
            return NextResponse.json({
                success: false,
                error: 'Este turno no está marcado como ausencia.',
            }, { status: 409 });
        }

        // Un "no se presentó" es, por definición, sin aviso. Misma regla que al marcar.
        const absenceNotified = body.absenceReason === 'NO_SHOW' ? false : !!body.absenceNotified;
        const absenceNotes = body.absenceNotes ? String(body.absenceNotes).trim().slice(0, 500) : null;

        await prisma.scheduledShift.update({
            where: { id: scheduledShiftId },
            data: {
                absenceReason: body.absenceReason as any,
                absenceNotified,
                absenceNotes,
            },
        });

        return NextResponse.json({ success: true, message: `Motivo anotado para ${turno.user.name.trim()}.` });
    } catch (error) {
        console.error('[absent/motivo]', error);
        return NextResponse.json({ success: false, error: 'No se pudo guardar el motivo' }, { status: 500 });
    }
}
