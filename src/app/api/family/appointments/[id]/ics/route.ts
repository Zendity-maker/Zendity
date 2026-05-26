/**
 * GET /api/family/appointments/[id]/ics
 *
 * Devuelve un archivo .ics de la cita aprobada para añadir al calendario nativo
 * del familiar. El navegador descarga el archivo y el sistema operativo lo abre
 * con Apple Calendar / Google Calendar / Outlook automáticamente.
 *
 * DTSTART/DTEND van como instantes UTC absolutos — el calendario nativo del
 * familiar (que conoce SU zona local) hace la conversión sola. Sin doble
 * etiquetado, sin ambigüedad: la cita llega en su hora local.
 *
 * Auth: requiere sesión FAMILY del dueño de la cita.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { astDateTime, parseTimeOfDay } from '@/lib/dates';
import { buildAppointmentICS } from '@/lib/ics';
import { buildAppointmentCopy } from '@/lib/family/appointment-copy';

export async function GET(
    _req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const session = await getServerSession(authOptions);
        if (!session || (session.user as any).role !== 'FAMILY') {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }

        const familyMember = await prisma.familyMember.findUnique({
            where: { email: session.user?.email as string },
            select: { id: true },
        });
        if (!familyMember) {
            return NextResponse.json({ success: false, error: 'Cuenta no vinculada' }, { status: 404 });
        }

        const appt = await prisma.familyAppointment.findUnique({
            where: { id },
            include: {
                patient:      { select: { name: true } },
                familyMember: { select: { id: true, name: true } },
                headquarters: { select: { name: true, billingAddress: true, familyWhatsAppNumber: true } },
            },
        });

        if (!appt) {
            return NextResponse.json({ success: false, error: 'Cita no encontrada' }, { status: 404 });
        }
        if (appt.familyMember.id !== familyMember.id) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 403 });
        }

        // Componer el instante UTC real (igual que hace el handler de aprobación).
        let startUtc: Date;
        let endUtc: Date;
        try {
            const { hour, minute } = parseTimeOfDay(appt.requestedTime);
            startUtc = astDateTime(appt.requestedDate, hour, minute);
            endUtc = new Date(startUtc.getTime() + appt.durationMins * 60_000);
        } catch {
            return NextResponse.json({ success: false, error: 'Hora inválida en la cita' }, { status: 400 });
        }

        // Copia ramificada por tipo: WhatsApp para llamadas/videollamadas, dirección
        // física para visitas presenciales. Misma fuente que email y notificación.
        const copy = buildAppointmentCopy({
            apptType: appt.type,
            hqName: appt.headquarters.name,
            hqAddress: appt.headquarters.billingAddress,
            whatsAppNumber: appt.headquarters.familyWhatsAppNumber,
            description: appt.description,
        });

        const ics = buildAppointmentICS({
            id: appt.id,
            title: `${appt.title} con ${appt.patient.name.trim()}`,
            description: copy.icsDescription,
            startUtc,
            endUtc,
            location: copy.location,
            organizerName: appt.headquarters.name,
            organizerEmail: process.env.SENDGRID_FROM_EMAIL || undefined,
        });

        return new NextResponse(ics, {
            status: 200,
            headers: {
                'Content-Type': 'text/calendar; charset=utf-8',
                'Content-Disposition': `attachment; filename="cita-${appt.id}.ics"`,
                'Cache-Control': 'no-store',
            },
        });
    } catch (e) {
        console.error('[family/appointments/ics GET]', e);
        return NextResponse.json({ success: false, error: 'Error al generar .ics' }, { status: 500 });
    }
}
