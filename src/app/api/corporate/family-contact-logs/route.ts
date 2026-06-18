import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { withPhiAccessLog, logPhiAccess } from '@/lib/phi-audit';
import { PhiAccessAction } from '@prisma/client';

// Sprint Coordinador Paso 3C (jun-2026): bitácora de contactos familiares.
// Mismos roles que crear-cita staff-side (DIRECTOR/ADMIN/SUPERVISOR/NURSE/COORDINATOR).
const ALLOWED_ROLES = ['DIRECTOR', 'ADMIN', 'SUPERVISOR', 'NURSE', 'COORDINATOR'];

// Sets cerrados (fail-closed): valores fuera del set → 400. Cambiarlos requiere
// commit nuevo, lo que fuerza review de impacto a las métricas v2.
const VALID_CHANNELS    = new Set(['PHONE', 'VIDEO', 'IN_PERSON', 'WHATSAPP', 'OTHER']);
const VALID_DIRECTIONS  = new Set(['OUTBOUND', 'INBOUND']);
const VALID_PURPOSES    = new Set(['UPDATE', 'PLANNING', 'COMPLAINT', 'FOLLOWUP', 'OTHER']);
const VALID_OUTCOMES    = new Set(['SPOKE', 'VOICEMAIL', 'NO_ANSWER', 'WRONG_NUMBER']);

// ─────────────────────────────────────────────────────────────────────────
// POST — crear log de contacto
// ─────────────────────────────────────────────────────────────────────────
//
// PHI audit: wrap SIN getPatientId (lib documenta "JAMÁS de req.body"),
// patrón "fila por paciente" — wrap loguea a nivel ruta (patientId=null) y
// handler emite fila granular con patientId post-parse. Consistente con
// el POST de family-appointments del paso 2B.
//
// NUNCA loguear el contenido de `note` en console.* — es PHI strict.
export const POST = withPhiAccessLog(createContactLogHandler, {
    resourceType: 'FamilyContactLog',
});

async function createContactLogHandler(req: Request) {
    try {
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;
        const hqId = auth.headquartersId;

        const body = await req.json();
        const {
            patientId,
            familyMemberId,
            channel,
            direction,
            purpose,
            outcome,
            note,
            durationMin,
            coordinatedAppointment,
            contactedAt,
        } = body as {
            patientId?: string; familyMemberId?: string;
            channel?: string; direction?: string;
            purpose?: string; outcome?: string;
            note?: string; durationMin?: number;
            coordinatedAppointment?: boolean;
            contactedAt?: string;
        };

        // ── Validaciones de campos ─────────────────────────────────────────
        if (!patientId || typeof patientId !== 'string') {
            return NextResponse.json({ success: false, error: 'patientId requerido' }, { status: 400 });
        }
        if (!familyMemberId || typeof familyMemberId !== 'string') {
            return NextResponse.json({ success: false, error: 'familyMemberId requerido' }, { status: 400 });
        }
        if (!channel || !VALID_CHANNELS.has(channel)) {
            return NextResponse.json({ success: false, error: 'channel inválido' }, { status: 400 });
        }
        if (!direction || !VALID_DIRECTIONS.has(direction)) {
            return NextResponse.json({ success: false, error: 'direction inválido' }, { status: 400 });
        }
        if (purpose && !VALID_PURPOSES.has(purpose)) {
            return NextResponse.json({ success: false, error: 'purpose inválido' }, { status: 400 });
        }
        if (outcome && !VALID_OUTCOMES.has(outcome)) {
            return NextResponse.json({ success: false, error: 'outcome inválido' }, { status: 400 });
        }

        // contactedAt opcional — si viene, parseable; si no, default DB now().
        let contactedAtDate: Date | undefined;
        if (contactedAt) {
            const d = new Date(contactedAt);
            if (isNaN(d.getTime())) {
                return NextResponse.json({ success: false, error: 'contactedAt inválido' }, { status: 400 });
            }
            contactedAtDate = d;
        }

        // ── Cargar patient + familyMember en paralelo ──────────────────────
        const [patient, familyMember] = await Promise.all([
            prisma.patient.findUnique({
                where: { id: patientId },
                select: { id: true, name: true, headquartersId: true, status: true },
            }),
            prisma.familyMember.findUnique({
                where: { id: familyMemberId },
                select: { id: true, name: true, patientId: true, headquartersId: true },
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
                { success: false, error: 'No se puede registrar contacto para un residente inactivo' },
                { status: 400 }
            );
        }

        // ── INTEGRIDAD familyMember ↔ patient ──────────────────────────────
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

        // ── Create simple — sin $transaction (v1 solo crea el log; v2
        //    eventualmente orquestará linkedAppointmentId atomicamente).
        const created = await prisma.familyContactLog.create({
            data: {
                headquartersId:         patient.headquartersId,
                patientId,
                familyMemberId,
                loggedById:             auth.id,
                channel,
                direction,
                purpose:                purpose ?? null,
                outcome:                outcome ?? null,
                note:                   note?.trim() ? note.trim() : null,
                durationMin:            typeof durationMin === 'number' && durationMin > 0 ? durationMin : null,
                coordinatedAppointment: Boolean(coordinatedAppointment),
                ...(contactedAtDate ? { contactedAt: contactedAtDate } : {}),
            },
            select: { id: true, patientId: true, contactedAt: true },
        });

        // ── PHI: fila granular con patientId NOT NULL ──────────────────────
        // NUNCA loguear `note` aquí; el context solo lleva metadata segura.
        logPhiAccess({
            action:       PhiAccessAction.WRITE,
            resourceType: 'FamilyContactLog',
            resourceId:   created.id,
            patientId:    created.patientId,
            userId:       auth.id,
            userRole:     auth.role,
            hqId,
            success:      true,
            routePath:    '/api/corporate/family-contact-logs',
            context:      { method: 'POST', channel, direction, hasNote: !!note?.trim() },
        });

        return NextResponse.json({ success: true, log: created }, { status: 201 });
    } catch (e) {
        // No loggear el body — puede contener PHI (la nota).
        console.error('[corporate/family-contact-logs POST]', (e as Error)?.message ?? 'unknown');
        return NextResponse.json({ success: false, error: 'Error al crear el log' }, { status: 500 });
    }
}

// ─────────────────────────────────────────────────────────────────────────
// GET — lista filtrable. Las notas son PHI; cada lectura va auditada.
// ─────────────────────────────────────────────────────────────────────────
export const GET = withPhiAccessLog(getContactLogsHandler, {
    resourceType: 'FamilyContactLogList',
});

async function getContactLogsHandler(req: Request) {
    try {
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;
        const hqId = auth.headquartersId;

        const { searchParams } = new URL(req.url);
        const patientId = searchParams.get('patientId');
        const from      = searchParams.get('from');
        const to        = searchParams.get('to');

        // Construir where con multi-tenant SIEMPRE.
        const where: any = { headquartersId: hqId };
        if (patientId) {
            // Defensa adicional: verificar que el patient existe y pertenece al hq
            // — si patientId fuera ajeno, where con sólo hqId no traería nada,
            // pero el chequeo explícito da un 404 útil en lugar de lista vacía.
            const patient = await prisma.patient.findUnique({
                where: { id: patientId },
                select: { headquartersId: true },
            });
            if (!patient || patient.headquartersId !== hqId) {
                return NextResponse.json({ success: false, error: 'Residente no encontrado' }, { status: 404 });
            }
            where.patientId = patientId;
        }
        if (from || to) {
            where.contactedAt = {};
            if (from) {
                const d = new Date(from);
                if (!isNaN(d.getTime())) where.contactedAt.gte = d;
            }
            if (to) {
                const d = new Date(to);
                if (!isNaN(d.getTime())) where.contactedAt.lte = d;
            }
        }

        const logs = await prisma.familyContactLog.findMany({
            where,
            orderBy: { contactedAt: 'desc' },
            take: 200, // sane default para v1; v2 paginará
            include: {
                patient:      { select: { id: true, name: true, roomNumber: true } },
                familyMember: { select: { id: true, name: true, phone: true, relationship: true } },
                loggedBy:     { select: { id: true, name: true } },
            },
        });

        // Fila-por-paciente: emite una fila logPhiAccess por cada patientId
        // único entre los logs retornados. Las notas SON PHI; cada lectura
        // queda auditada con qué residentes vio el actor.
        const seen = new Set<string>();
        for (const l of logs) {
            if (!l.patientId || seen.has(l.patientId)) continue;
            seen.add(l.patientId);
            logPhiAccess({
                action:       PhiAccessAction.READ,
                resourceType: 'FamilyContactLog',
                resourceId:   l.id,
                patientId:    l.patientId,
                userId:       auth.id,
                userRole:     auth.role,
                hqId,
                success:      true,
                routePath:    '/api/corporate/family-contact-logs',
                context:      { listSize: logs.length, filterPatientId: patientId || null },
            });
        }

        return NextResponse.json({ success: true, logs });
    } catch (e) {
        console.error('[corporate/family-contact-logs GET]', (e as Error)?.message ?? 'unknown');
        return NextResponse.json({ success: false, error: 'Error al cargar la bitácora' }, { status: 500 });
    }
}
