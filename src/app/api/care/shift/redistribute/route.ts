import { NextResponse } from 'next/server';
import type { Session } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { resolveEffectiveHqId } from '@/lib/hq-resolver';
import { computeShiftCoverage, inferShiftTypeFromAST, type ShiftT } from '@/lib/shift-coverage';
import { todayStartAST } from '@/lib/dates';
import { notifyUser, notifyRoles } from '@/lib/notifications';
import { SystemAuditAction } from '@prisma/client';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MANUAL_ROLES = ['SUPERVISOR', 'DIRECTOR', 'ADMIN'];
const VITALS_WINDOW_MS = 4 * 60 * 60 * 1000;

/**
 * POST /api/care/shift/redistribute
 *
 * Body: { hqId?, shiftType?, trigger: 'AUTO' | 'MANUAL' }
 *
 * Autenticación doble:
 *  - Manual: sesión de SUPERVISOR/DIRECTOR/ADMIN
 *  - Automática: header Authorization: Bearer <CRON_SECRET> (llamada del cron)
 *
 * Reparte round-robin los residentes de colores ausentes entre los cuidadores
 * activos que tienen color efectivo asignado. Crea ShiftPatientOverride por
 * residente + VitalsOrder si la ventana 4h del shiftSession del receptor no
 * ha vencido. Notifica receptores y supervisor.
 */
export async function POST(req: Request) {
    try {
        const authHeader = req.headers.get('authorization');
        const cronSecret = process.env.CRON_SECRET || 'ZENDITY_CRON_LOCAL';
        const isCron = authHeader === `Bearer ${cronSecret}`;

        let session: Session | null = null;
        if (!isCron) {
            session = await getServerSession(authOptions);
            if (!session?.user) {
                return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
            }
            if (!MANUAL_ROLES.includes((session.user as any).role)) {
                return NextResponse.json({ success: false, error: 'Rol no autorizado' }, { status: 403 });
            }
        }

        const body = await req.json().catch(() => ({}));
        const requestedHqId: string | undefined = body.hqId;
        const shiftTypeParam: ShiftT | undefined = body.shiftType;
        const trigger: 'AUTO' | 'MANUAL' = body.trigger === 'AUTO' ? 'AUTO' : (isCron ? 'AUTO' : 'MANUAL');

        let hqId: string;
        if (isCron) {
            if (!requestedHqId) {
                return NextResponse.json({ success: false, error: 'hqId requerido en llamada cron' }, { status: 400 });
            }
            const hq = await prisma.headquarters.findFirst({
                where: { id: requestedHqId, isActive: true },
                select: { id: true },
            });
            if (!hq) {
                return NextResponse.json({ success: false, error: 'Sede no encontrada' }, { status: 404 });
            }
            hqId = requestedHqId;
        } else {
            try {
                hqId = await resolveEffectiveHqId(session!, requestedHqId || null);
            } catch (e: any) {
                return NextResponse.json({ success: false, error: e.message || 'Sede inválida' }, { status: 400 });
            }
        }

        const shiftType: ShiftT = shiftTypeParam && ['MORNING', 'EVENING', 'NIGHT'].includes(shiftTypeParam)
            ? shiftTypeParam
            : inferShiftTypeFromAST();

        // 1. Coverage
        const coverage = await computeShiftCoverage({ hqId, shiftType });

        // 2. Sin huecos
        if (!coverage.redistributionNeeded) {
            return NextResponse.json({
                success: true,
                redistributed: 0,
                overridesCreated: [],
                vitalsCreated: 0,
                message: 'No hay huecos — cobertura completa o ya redistribuida',
                coverage: { absentColors: coverage.absentColors, alreadyRedistributed: coverage.alreadyRedistributed },
            });
        }

        // 3. Si todos los absentColors ya están totalmente redistribuidos
        //    (uncoveredPatients=0 ya fue chequeado arriba vía redistributionNeeded)

        // 4. Receptores: cuidadores activos con color efectivo
        const recipients = coverage.activeCaregivers.filter(c => c.color);
        if (recipients.length === 0) {
            return NextResponse.json({
                success: false,
                error: 'No hay cuidadores en piso con color asignado — imposible redistribuir',
            }, { status: 400 });
        }

        const now = new Date();
        const shiftDate = todayStartAST();

        // Precargar shiftSessions de los receptores para calcular ventana de vitales
        const sessionsById = new Map(recipients.map(r => [r.shiftSessionId, r]));

        const overridesCreated: Array<{
            id: string; patientId: string; patientName: string;
            originalColor: string; caregiverId: string; caregiverName: string;
        }> = [];
        let vitalsCreated = 0;
        const notifyByCaregiver = new Map<string, string[]>(); // caregiverId → [patientName]

        // 6. Round-robin
        for (let i = 0; i < coverage.uncoveredPatients.length; i++) {
            const patient = coverage.uncoveredPatients[i];
            const recipient = recipients[i % recipients.length];

            // Uniqueness: mismo patient+shiftDate+isActive ya existe? skip
            const existing = await prisma.shiftPatientOverride.findFirst({
                where: {
                    patientId: patient.patientId,
                    shiftDate: { gte: shiftDate, lt: new Date(shiftDate.getTime() + 24 * 3600000) },
                    shiftType,
                    isActive: true,
                },
                select: { id: true },
            });
            if (existing) continue;

            const override = await prisma.shiftPatientOverride.create({
                data: {
                    headquartersId: hqId,
                    patientId: patient.patientId,
                    originalColor: patient.colorGroup,
                    assignedColor: recipient.color || 'UNASSIGNED',
                    caregiverId: recipient.userId,
                    shiftDate,
                    shiftType,
                    reason: trigger === 'AUTO' ? 'ABSENCE_REDISTRIB' : 'MANUAL',
                    autoAssigned: trigger === 'AUTO',
                    isActive: true,
                },
            });

            overridesCreated.push({
                id: override.id,
                patientId: patient.patientId,
                patientName: patient.name,
                originalColor: patient.colorGroup,
                caregiverId: recipient.userId,
                caregiverName: recipient.name,
            });

            // B. VitalsOrder si ventana 4h del receptor no vencida
            const recipientShiftStart = recipient.startTime;
            const vitalsExpiresAt = new Date(recipientShiftStart.getTime() + VITALS_WINDOW_MS);
            if (vitalsExpiresAt > now) {
                // Evitar duplicado: si ya hay PENDING para este paciente en la sesión, skip
                const existingVital = await prisma.vitalsOrder.findFirst({
                    where: {
                        patientId: patient.patientId,
                        shiftSessionId: recipient.shiftSessionId,
                        status: 'PENDING',
                    },
                    select: { id: true },
                });
                if (!existingVital) {
                    await prisma.vitalsOrder.create({
                        data: {
                            headquartersId: hqId,
                            patientId: patient.patientId,
                            orderedById: recipient.userId,
                            caregiverId: recipient.userId,
                            reason: 'Vitales de entrada — redistribución por ausencia',
                            orderedAt: now,
                            expiresAt: vitalsExpiresAt,
                            status: 'PENDING',
                            autoCreated: true,
                            shiftSessionId: recipient.shiftSessionId,
                            penaltyApplied: false,
                        },
                    });
                    vitalsCreated++;
                }
            }

            // Acumular notificación por cuidador receptor
            if (!notifyByCaregiver.has(recipient.userId)) notifyByCaregiver.set(recipient.userId, []);
            notifyByCaregiver.get(recipient.userId)!.push(`${patient.name} (grupo ${patient.colorGroup})`);
        }

        // C. Notificar receptores (una notificación por cuidador, lista de pacientes)
        for (const [caregiverId, patientLines] of notifyByCaregiver.entries()) {
            try {
                await notifyUser(caregiverId, {
                    type: 'EMAR_ALERT',
                    title: `Residentes redistribuidos (${patientLines.length})`,
                    message: `Recibes ${patientLines.length === 1 ? 'a' : 'a los siguientes residentes'} por ausencia del cuidador asignado: ${patientLines.join(', ')}. Revisa sus tarjetas en el tablet.`,
                });
            } catch (e) { console.error('[redistribute notifyUser]', e); }
        }

        // 8. Notificar supervisor (agregado)
        if (overridesCreated.length > 0) {
            try {
                const colorsSummary = Array.from(new Set(overridesCreated.map(o => o.originalColor))).join(', ');
                await notifyRoles(hqId, ['SUPERVISOR'], {
                    type: 'EMAR_ALERT',
                    title: 'Redistribución automática',
                    message: `${overridesCreated.length} residentes de ${colorsSummary} distribuidos entre ${notifyByCaregiver.size} cuidadores por ausencia (${trigger}).`,
                });
            } catch (e) { console.error('[redistribute notifyRoles]', e); }
        }

        // Audit log
        if (overridesCreated.length > 0) {
            try {
                await prisma.systemAuditLog.create({
                    data: {
                        headquartersId: hqId,
                        entityName: 'ShiftPatientOverride',
                        entityId: overridesCreated[0].id, // primer override como ancla
                        action: SystemAuditAction.SHIFT_REDISTRIBUTE,
                        performedById: isCron ? null : (session!.user as any).id,
                        payloadChanges: {
                            trigger,
                            shiftType,
                            shiftDate: shiftDate.toISOString(),
                            absentColors: coverage.absentColors,
                            redistributedCount: overridesCreated.length,
                            vitalsCreated,
                            recipientsCount: notifyByCaregiver.size,
                            overrideIds: overridesCreated.map(o => o.id),
                        } as any,
                    },
                });
            } catch (e) { console.error('[redistribute audit]', e); }
        }

        return NextResponse.json({
            success: true,
            redistributed: overridesCreated.length,
            overridesCreated,
            vitalsCreated,
            trigger,
            shiftType,
        });
    } catch (error: any) {
        console.error('shift/redistribute error:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Error ejecutando redistribución',
        }, { status: 500 });
    }
}
