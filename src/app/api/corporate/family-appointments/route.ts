import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { withPhiAccessLog, logPhiAccess } from '@/lib/phi-audit';
import { PhiAccessAction } from '@prisma/client';
import { astDateTime, parseTimeOfDay } from '@/lib/dates';
import {
    buildApprovedAppointmentEventData,
    sendApprovedAppointmentNotifications,
} from '@/lib/family/appointment-effects';

const ALLOWED_ROLES = ['DIRECTOR', 'ADMIN', 'SUPERVISOR', 'NURSE', 'COORDINATOR'];

const VALID_TYPES = ['VISIT', 'VIDEO_CALL', 'PHONE_CALL', 'DIRECTOR_MEETING', 'SPECIAL_OCCASION'] as const;
const MAX_DAYS_AHEAD = 30;

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

// POST — crear cita STAFF-SIDE que nace APPROVED.
//
// Sprint Coordinador (jun-2026, paso 2B): Wanda agenda en nombre del familiar.
// El familiar no inicia la solicitud; el staff la crea y la cita se materializa
// directo en estado APPROVED + evento en el calendario (mismo invariante atómico
// del PATCH-approve, vía $transaction).
//
// PHI audit (Pilar 1): el wrap exterior NO usa getPatientId porque la regla
// documentada de withPhiAccessLog prohíbe leer req.body en el getter (rompe el
// stream del handler). Patrón equivalente al GET de este mismo archivo: el
// wrap loguea la operación a nivel ruta (patientId=null), y el handler emite
// 1 fila adicional con patientId del residente DESPUÉS de parsear el body —
// auditoría granular sin tocar el stream del request 2x.
export const POST = withPhiAccessLog(createFamilyAppointmentHandler, {
    resourceType: 'FamilyAppointment',
});

async function createFamilyAppointmentHandler(req: Request) {
    try {
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;
        const hqId = auth.headquartersId;

        const body = await req.json();
        const {
            patientId,
            familyMemberId,
            type,
            title,
            description,
            requestedDate,
            requestedTime,
            durationMins,
        } = body as {
            patientId?: string; familyMemberId?: string; type?: string;
            title?: string; description?: string;
            requestedDate?: string; requestedTime?: string; durationMins?: number;
        };

        // ── Validaciones de campos ─────────────────────────────────────────
        if (!patientId || typeof patientId !== 'string') {
            return NextResponse.json({ success: false, error: 'patientId requerido' }, { status: 400 });
        }
        if (!familyMemberId || typeof familyMemberId !== 'string') {
            return NextResponse.json({ success: false, error: 'familyMemberId requerido' }, { status: 400 });
        }
        if (!type || !(VALID_TYPES as readonly string[]).includes(type)) {
            return NextResponse.json({ success: false, error: 'Tipo de cita inválido' }, { status: 400 });
        }
        if (!title || !title.trim()) {
            return NextResponse.json({ success: false, error: 'El título es requerido' }, { status: 400 });
        }
        if (!requestedDate || !requestedTime) {
            return NextResponse.json({ success: false, error: 'Fecha y hora son requeridas' }, { status: 400 });
        }

        const dateObj = new Date(requestedDate);
        if (isNaN(dateObj.getTime())) {
            return NextResponse.json({ success: false, error: 'Fecha inválida' }, { status: 400 });
        }

        // ── Bloqueos duros de fecha ────────────────────────────────────────
        // NOTA: deliberadamente NO se valida lunes-bloqueado ni ventana 10-18.
        // Para staff esas reglas son advertencia UI (modal con confirm), no
        // bloqueo servidor. Las únicas restricciones server-side son:
        // (a) no agendar en el pasado, (b) max 30 días en adelante.
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (dateObj < today) {
            return NextResponse.json({ success: false, error: 'La fecha no puede ser en el pasado' }, { status: 400 });
        }
        const maxDate = new Date(today);
        maxDate.setDate(maxDate.getDate() + MAX_DAYS_AHEAD);
        if (dateObj > maxDate) {
            return NextResponse.json(
                { success: false, error: `Solo se pueden agendar citas dentro de los próximos ${MAX_DAYS_AHEAD} días` },
                { status: 400 }
            );
        }

        // ── Cargar patient + familyMember + hq en paralelo ─────────────────
        const [patient, familyMember, hq] = await Promise.all([
            prisma.patient.findUnique({
                where: { id: patientId },
                select: { id: true, name: true, headquartersId: true, status: true },
            }),
            prisma.familyMember.findUnique({
                where: { id: familyMemberId },
                select: { id: true, name: true, email: true, patientId: true, headquartersId: true },
            }),
            prisma.headquarters.findUnique({
                where: { id: hqId },
                select: { name: true, billingAddress: true, familyWhatsAppNumber: true },
            }),
        ]);

        // ── Multi-tenant + estado del residente ────────────────────────────
        if (!patient) {
            return NextResponse.json({ success: false, error: 'Residente no encontrado' }, { status: 404 });
        }
        if (patient.headquartersId !== hqId) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 403 });
        }
        if (!['ACTIVE', 'TEMPORARY_LEAVE'].includes(patient.status as string)) {
            return NextResponse.json(
                { success: false, error: 'No se puede agendar para un residente inactivo' },
                { status: 400 }
            );
        }

        // ── INTEGRIDAD (server-side, no confiar en el cliente) ─────────────
        // Esto cierra el ataque: cliente malicioso manda familyMemberId de
        // un residente distinto. Aunque pase los gates de UI, aquí muere.
        if (!familyMember) {
            return NextResponse.json({ success: false, error: 'Familiar no encontrado' }, { status: 404 });
        }
        if (familyMember.patientId !== patientId) {
            return NextResponse.json(
                { success: false, error: 'El familiar no está vinculado a ese residente' },
                { status: 400 }
            );
        }
        if (familyMember.headquartersId !== hqId) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 403 });
        }

        // ── Compute startTime/endTime (mismo cálculo que el PATCH-approve) ─
        let startTime: Date;
        let endTime: Date;
        try {
            const { hour, minute } = parseTimeOfDay(requestedTime);
            startTime = astDateTime(dateObj, hour, minute);
            endTime = new Date(startTime.getTime() + (durationMins || 60) * 60_000);
        } catch (err) {
            console.error('[corporate/family-appointments POST] Hora inválida:', err);
            return NextResponse.json(
                { success: false, error: `Hora inválida: "${requestedTime}"` },
                { status: 400 }
            );
        }

        const hqName     = hq?.name || 'Vivid Senior Living';
        const hqAddress  = hq?.billingAddress ?? null;
        const hqWhatsApp = hq?.familyWhatsAppNumber ?? null;

        // ── ATÓMICO: cita APPROVED + HeadquartersEvent ─────────────────────
        // Si el create del evento falla, la cita NO se persiste — espejo del
        // invariante del PATCH-approve. Builder PURO de @/lib/family/appointment-effects.
        const [created] = await prisma.$transaction([
            prisma.familyAppointment.create({
                data: {
                    patientId,
                    familyMemberId,
                    headquartersId: patient.headquartersId,
                    type,
                    title:         title.trim(),
                    description:   description?.trim() || null,
                    requestedDate: dateObj,
                    requestedTime,
                    durationMins:  durationMins || 60,
                    status:        'APPROVED',
                    approvedById:  auth.id,
                    approvedAt:    new Date(),
                },
            }),
            prisma.headquartersEvent.create({
                data: buildApprovedAppointmentEventData({
                    apptType:         type,
                    hqId:             patient.headquartersId,
                    patientId,
                    patientName:      patient.name,
                    familyMemberName: familyMember.name,
                    description:      description?.trim() || null,
                    startTime,
                    endTime,
                }),
            }),
        ]);

        // ── PHI: fila granular con patientId NOT NULL ──────────────────────
        // Patrón "fila por paciente": el wrap exterior ya registró la op con
        // patientId=null (porque no puede leer body); aquí emitimos la fila
        // específica con el residente afectado. Consistente con el GET.
        logPhiAccess({
            action:       PhiAccessAction.WRITE,
            resourceType: 'FamilyAppointment',
            resourceId:   created.id,
            patientId:    created.patientId,
            userId:       auth.id,
            userRole:     auth.role,
            hqId,
            success:      true,
            routePath:    '/api/corporate/family-appointments',
            context:      { method: 'POST', initialStatus: 'APPROVED' },
        });

        // ── Side-effects post-DB (best-effort, never throws) ───────────────
        // Mismo helper que usa el PATCH-approve; stage='CREATE_APPROVED' para
        // que los logs de email se distingan en Vercel.
        // NO se notifica al staff (notifyRoles deliberadamente omitido — Wanda
        // ES staff; la notif al staff sería ruido). El helper sí notifica al
        // familiar (in-app + email cuando vuelva el quota de SendGrid).
        await sendApprovedAppointmentNotifications({
            stage:             'CREATE_APPROVED',
            appointmentId:     created.id,
            apptType:          type,
            requestedDate:     dateObj,
            requestedTime,
            durationMins:      durationMins || 60,
            description:       description?.trim() || null,
            patientName:       patient.name,
            familyMemberId:    familyMember.id,
            familyMemberName:  familyMember.name,
            familyMemberEmail: familyMember.email,
            hqName,
            hqAddress,
            hqWhatsApp,
            startTime,
            endTime,
        });

        return NextResponse.json({ success: true, appointment: created }, { status: 201 });
    } catch (e) {
        console.error('[corporate/family-appointments POST]', e);
        return NextResponse.json({ success: false, error: 'Error al crear la cita' }, { status: 500 });
    }
}
