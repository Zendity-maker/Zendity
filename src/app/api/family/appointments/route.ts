import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { notifyRoles } from '@/lib/notifications';

// Tipos de cita válidos
const VALID_TYPES = ['VISIT', 'VIDEO_CALL', 'PHONE_CALL', 'DIRECTOR_MEETING', 'SPECIAL_OCCASION'] as const;

// Reglas de horario
const MIN_HOUR = 10; // 10:00 AM
const MAX_HOUR = 18; // 6:00 PM
const MAX_DAYS_AHEAD = 30;

// Lunes bloqueado (getDay() === 1)
const BLOCKED_DAYS = [1]; // Monday

function parseTimeString(timeStr: string): number | null {
    // Acepta "10:00 AM", "10:30 AM", "2:30 PM"
    const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return null;
    let hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    const period = match[3].toUpperCase();
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    return hours + minutes / 60;
}

// GET — listar citas del familiar autenticado
export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session || (session.user as any).role !== 'FAMILY') {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }

        const familyMember = await prisma.familyMember.findUnique({
            where: { email: session.user?.email as string },
            select: { id: true, patientId: true },
        });
        if (!familyMember) return NextResponse.json({ success: false, error: 'Cuenta no vinculada' }, { status: 404 });

        const appointments = await prisma.familyAppointment.findMany({
            where: { familyMemberId: familyMember.id },
            orderBy: { requestedDate: 'asc' },
            include: {
                patient: { select: { name: true, roomNumber: true } },
                approvedBy: { select: { name: true } },
            },
        });

        return NextResponse.json({ success: true, appointments });
    } catch (e) {
        console.error('[family/appointments GET]', e);
        return NextResponse.json({ success: false, error: 'Error al cargar citas' }, { status: 500 });
    }
}

// POST — crear solicitud de cita
export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || (session.user as any).role !== 'FAMILY') {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }

        const familyMember = await prisma.familyMember.findUnique({
            where: { email: session.user?.email as string },
            select: { id: true, patientId: true, name: true, headquartersId: true },
        });
        if (!familyMember?.patientId) {
            return NextResponse.json({ success: false, error: 'Cuenta no vinculada a un residente' }, { status: 404 });
        }

        const { type, title, description, requestedDate, requestedTime, durationMins } = await req.json();

        // Validaciones
        if (!VALID_TYPES.includes(type)) {
            return NextResponse.json({ success: false, error: 'Tipo de cita inválido' }, { status: 400 });
        }
        if (!title?.trim()) {
            return NextResponse.json({ success: false, error: 'El título es requerido' }, { status: 400 });
        }
        if (!requestedDate || !requestedTime) {
            return NextResponse.json({ success: false, error: 'Fecha y hora son requeridas' }, { status: 400 });
        }

        const dateObj = new Date(requestedDate);
        if (isNaN(dateObj.getTime())) {
            return NextResponse.json({ success: false, error: 'Fecha inválida' }, { status: 400 });
        }

        // No fechas pasadas
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (dateObj < today) {
            return NextResponse.json({ success: false, error: 'La fecha no puede ser en el pasado' }, { status: 400 });
        }

        // Max 30 días en adelante
        const maxDate = new Date(today);
        maxDate.setDate(maxDate.getDate() + MAX_DAYS_AHEAD);
        if (dateObj > maxDate) {
            return NextResponse.json({ success: false, error: 'Solo se pueden solicitar citas dentro de los próximos 30 días' }, { status: 400 });
        }

        // Lunes bloqueado
        if (BLOCKED_DAYS.includes(dateObj.getDay())) {
            return NextResponse.json({ success: false, error: 'Los lunes no están disponibles para visitas. Elige del martes al domingo.' }, { status: 400 });
        }

        // Horario 10AM - 6PM
        const hourFloat = parseTimeString(requestedTime);
        if (hourFloat === null) {
            return NextResponse.json({ success: false, error: 'Formato de hora inválido. Usa "10:00 AM".' }, { status: 400 });
        }
        if (hourFloat < MIN_HOUR || hourFloat >= MAX_HOUR) {
            return NextResponse.json({ success: false, error: 'Solo se aceptan citas entre 10:00 AM y 6:00 PM' }, { status: 400 });
        }

        const patient = await prisma.patient.findUnique({
            where: { id: familyMember.patientId },
            select: { name: true, headquartersId: true },
        });
        if (!patient) return NextResponse.json({ success: false, error: 'Residente no encontrado' }, { status: 404 });

        const appointment = await prisma.familyAppointment.create({
            data: {
                patientId:      familyMember.patientId,
                familyMemberId: familyMember.id,
                headquartersId: familyMember.headquartersId,
                type,
                title:          title.trim(),
                description:    description?.trim() || null,
                requestedDate:  dateObj,
                requestedTime,
                durationMins:   durationMins || 60,
                status:         'PENDING',
            },
        });

        // Notificar al equipo de la sede
        const typeLabels: Record<string, string> = {
            VISIT:             'Visita Presencial',
            VIDEO_CALL:        'Videollamada',
            PHONE_CALL:        'Llamada Telefónica',
            DIRECTOR_MEETING:  'Reunión con Director',
            SPECIAL_OCCASION:  'Ocasión Especial',
        };
        const formattedDate = dateObj.toLocaleDateString('es-PR', { weekday: 'long', day: '2-digit', month: 'short' });
        await notifyRoles(
            familyMember.headquartersId,
            ['DIRECTOR', 'ADMIN', 'SUPERVISOR', 'NURSE'],
            {
                type:    'FAMILY_VISIT',
                title:   '📅 Nueva solicitud de cita',
                message: `${familyMember.name} solicita ${typeLabels[type] || type} el ${formattedDate} a las ${requestedTime} para ${patient.name}`,
                link:    '/corporate/family-appointments',
            }
        );

        return NextResponse.json({ success: true, appointment });
    } catch (e) {
        console.error('[family/appointments POST]', e);
        return NextResponse.json({ success: false, error: 'Error al crear la solicitud' }, { status: 500 });
    }
}
