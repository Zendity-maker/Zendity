import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { SystemAuditAction } from '@prisma/client';
import { todayStartAST } from '@/lib/dates';
import OpenAI from 'openai';

const SUPERVISOR_ROLES = ['SUPERVISOR', 'DIRECTOR', 'ADMIN', 'SUPER_ADMIN'];

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'dummy' });

/**
 * Sprint L — Cierre de turno con reporte INDIVIDUAL por cuidador.
 *
 * Flujo 1 (Wizard — el cuidador mismo cierra):
 *   1. Resolver colorGroups del cuidador (ShiftColorAssignment → fallback por actividad real)
 *   2. Resolver residentes asignados (Patient por colorGroup + activos + mismo HQ)
 *   3. Generar aiSummaryReport con GPT-4o-mini usando datos REALES del turno
 *   4. Crear ShiftHandover (outgoingNurseId, colorGroups[], isDailyPrologue:false)
 *   5. Crear HandoverNote por cada residente con snippet de su turno
 *
 * Flujo 2 (forceEnd por supervisor):
 *   - Crea ShiftHandover "vacío" con nota de cierre forzado
 *   - Log SystemAuditAction.SYSTEM_ABANDONED + payload {forceClosedBySupervisor:true}
 *     (reusamos el enum existente; el discriminador va en payloadChanges)
 */

type ShiftT = 'MORNING' | 'EVENING' | 'NIGHT';

function inferShiftType(date: Date): ShiftT {
    // AST = UTC-4. Derivar hora AST desde UTC para clasificar el turno.
    const hAst = (date.getUTCHours() - 4 + 24) % 24;
    if (hAst >= 6 && hAst < 14) return 'MORNING';
    if (hAst >= 14 && hAst < 22) return 'EVENING';
    return 'NIGHT';
}

/**
 * Resuelve los colorGroups que el cuidador cubrió en su turno.
 * Orden de búsqueda:
 *  1. ShiftColorAssignment del ScheduledShift del día (fuente de verdad del horario).
 *  2. ScheduledShift.colorGroup plano del horario (legacy).
 *  3. Fallback por actividad: colorGroups únicos de los residentes que tocó
 *     (BathLog + MealLog + MedicationAdministration) durante el turno.
 */
async function resolveColorGroupsForCaregiver(
    caregiverId: string,
    hqId: string,
    shiftStart: Date,
): Promise<string[]> {
    // 1. ShiftColorAssignment → buscar ScheduledShift del día para este cuidador
    const todayStart = new Date(shiftStart);
    todayStart.setUTCHours(0, 0, 0, 0);
    const tomorrow = new Date(todayStart);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    const scheduledShifts = await prisma.scheduledShift.findMany({
        where: {
            userId: caregiverId,
            date: { gte: todayStart, lt: tomorrow },
        },
        include: { colorAssignments: true },
    });

    const fromAssignments = scheduledShifts
        .flatMap(s => s.colorAssignments.map(a => a.color))
        .filter(Boolean);
    if (fromAssignments.length > 0) return Array.from(new Set(fromAssignments));

    // 2. ScheduledShift.colorGroup plano (legacy)
    const fromLegacy = scheduledShifts
        .map(s => s.colorGroup)
        .filter((c): c is string => !!c && c !== 'UNASSIGNED');
    if (fromLegacy.length > 0) return Array.from(new Set(fromLegacy));

    // 3. Fallback por actividad real durante el turno
    const touchedPatientIds = new Set<string>();
    const [baths, meals, meds] = await Promise.all([
        prisma.bathLog.findMany({ where: { caregiverId, timeLogged: { gte: shiftStart } }, select: { patientId: true } }),
        prisma.mealLog.findMany({ where: { caregiverId, timeLogged: { gte: shiftStart } }, select: { patientId: true } }),
        prisma.medicationAdministration.findMany({
            where: { administeredById: caregiverId, administeredAt: { gte: shiftStart } },
            select: { patientMedication: { select: { patientId: true } } },
        }),
    ]);
    baths.forEach(b => touchedPatientIds.add(b.patientId));
    meals.forEach(m => touchedPatientIds.add(m.patientId));
    meds.forEach(m => m.patientMedication?.patientId && touchedPatientIds.add(m.patientMedication.patientId));

    if (touchedPatientIds.size === 0) return [];

    const patients = await prisma.patient.findMany({
        where: { id: { in: Array.from(touchedPatientIds) }, headquartersId: hqId },
        select: { colorGroup: true },
    });
    const colors = patients.map(p => p.colorGroup).filter(c => c && c !== 'UNASSIGNED');
    return Array.from(new Set(colors));
}

/**
 * Devuelve los residentes activos que el cuidador cubrió por color.
 * Si colorGroups viene vacío, devuelve [] (no asumimos "todo el censo").
 */
async function resolvePatientsByColors(
    colorGroups: string[],
    hqId: string,
): Promise<{ id: string; name: string; colorGroup: string; roomNumber: string | null }[]> {
    if (colorGroups.length === 0) return [];
    return prisma.patient.findMany({
        where: {
            headquartersId: hqId,
            status: 'ACTIVE',
            colorGroup: { in: colorGroups as any[] },
        },
        select: { id: true, name: true, colorGroup: true, roomNumber: true },
        orderBy: { name: 'asc' },
    });
}

/**
 * Colecta actividad clínica del turno filtrada por los patientIds del cuidador.
 */
async function collectShiftActivity(params: {
    caregiverId: string;
    patientIds: string[];
    shiftStart: Date;
}) {
    const { caregiverId, patientIds, shiftStart } = params;

    if (patientIds.length === 0) {
        return {
            medsAdministered: 0,
            medsOmitted: [] as { patientName: string; medName: string; reason: string }[],
            mealCount: 0,
            bathCount: 0,
            vitalCount: 0,
            falls: [] as { patientName: string; severity: string; location: string }[],
            clinicalAlerts: [] as { patientName: string; notes: string }[],
            rotations: 0,
        };
    }

    const [medsAdmin, medsOmit, mealCount, bathCount, vitalCount, falls, alerts, rotations] = await Promise.all([
        prisma.medicationAdministration.count({
            where: {
                administeredById: caregiverId,
                administeredAt: { gte: shiftStart },
                status: 'ADMINISTERED',
            },
        }),
        prisma.medicationAdministration.findMany({
            where: {
                administeredById: caregiverId,
                administeredAt: { gte: shiftStart },
                status: { in: ['OMITTED', 'REFUSED'] },
            },
            include: {
                patientMedication: { include: { patient: { select: { name: true } }, medication: { select: { name: true } } } },
            },
            take: 30,
        }),
        prisma.mealLog.count({ where: { caregiverId, timeLogged: { gte: shiftStart } } }),
        prisma.bathLog.count({ where: { caregiverId, timeLogged: { gte: shiftStart } } }),
        prisma.vitalSigns.count({ where: { measuredById: caregiverId, createdAt: { gte: shiftStart } } }),
        prisma.fallIncident.findMany({
            where: { patientId: { in: patientIds }, reportedAt: { gte: shiftStart } },
            include: { patient: { select: { name: true } } },
            take: 10,
        }),
        prisma.dailyLog.findMany({
            where: {
                patientId: { in: patientIds },
                authorId: caregiverId,
                createdAt: { gte: shiftStart },
                isClinicalAlert: true,
            },
            include: { patient: { select: { name: true } } },
            take: 10,
        }),
        prisma.posturalChangeLog.count({ where: { nurseId: caregiverId, performedAt: { gte: shiftStart } } }),
    ]);

    return {
        medsAdministered: medsAdmin,
        medsOmitted: medsOmit.map(m => ({
            patientName: m.patientMedication?.patient?.name || 'Residente desconocido',
            medName: m.patientMedication?.medication?.name || 'Medicamento',
            reason: m.notes || m.status,
        })),
        mealCount,
        bathCount,
        vitalCount,
        falls: falls.map(f => ({ patientName: f.patient?.name || 'Desconocido', severity: f.severity, location: f.location })),
        clinicalAlerts: alerts.map(a => ({ patientName: a.patient?.name || 'Desconocido', notes: a.notes || '(sin notas)' })),
        rotations,
    };
}

async function buildZendiSummary(params: {
    caregiverName: string;
    shiftType: ShiftT;
    patients: { name: string; colorGroup: string; roomNumber: string | null }[];
    activity: Awaited<ReturnType<typeof collectShiftActivity>>;
    justifications: Record<string, string>;
}): Promise<string> {
    const { caregiverName, shiftType, patients, activity, justifications } = params;

    const shiftLabel = shiftType === 'MORNING' ? 'Mañana (6am–2pm)'
        : shiftType === 'EVENING' ? 'Tarde (2pm–10pm)'
        : 'Noche (10pm–6am)';

    const patientList = patients.length > 0
        ? patients.map(p => `- ${p.name}${p.roomNumber ? ` (Hab. ${p.roomNumber})` : ''} — grupo ${p.colorGroup}`).join('\n')
        : '- (sin residentes asignados por color)';

    const omittedLines = activity.medsOmitted.length > 0
        ? activity.medsOmitted.map(m => `  · ${m.patientName} — ${m.medName} (${m.reason})`).join('\n')
        : '  · ninguno';

    const fallLines = activity.falls.length > 0
        ? activity.falls.map(f => `  · ${f.patientName} en ${f.location} (severidad ${f.severity})`).join('\n')
        : '  · ninguno';

    const alertLines = activity.clinicalAlerts.length > 0
        ? activity.clinicalAlerts.map(a => `  · ${a.patientName}: ${a.notes}`).join('\n')
        : '  · ninguno';

    const justLines = Object.keys(justifications).length > 0
        ? Object.entries(justifications).map(([id, r]) => `  · ${id}: ${r}`).join('\n')
        : '  · ninguna';

    const prompt = `Eres Zendi, el asistente de Zéndity. Genera el reporte de cierre de turno para ${caregiverName} en español rioplatense claro y profesional. No inventes datos: usa SOLO la información que te doy. Máximo 3 párrafos. Menciona residentes por nombre. Si hay situaciones que requieren atención del supervisor, resáltalas al final.

Turno: ${shiftLabel}
Cuidador(a): ${caregiverName}

Residentes asignados:
${patientList}

Actividad del turno:
- Medicamentos administrados: ${activity.medsAdministered}
- Medicamentos omitidos/rehusados:
${omittedLines}
- Comidas registradas: ${activity.mealCount}
- Baños completados: ${activity.bathCount}
- Vitales tomados: ${activity.vitalCount}
- Rotaciones UPP (cambios posturales): ${activity.rotations}
- Caídas durante el turno:
${fallLines}
- Alertas clínicas del cuidador (isClinicalAlert en DailyLog):
${alertLines}
- Justificaciones del wizard (tareas pendientes/trasladadas):
${justLines}

Genera el reporte ahora.`;

    try {
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 700,
            temperature: 0.3,
        });
        const text = completion.choices?.[0]?.message?.content?.trim();
        if (text && text.length > 40) return text;
    } catch (e) {
        console.error('[shift/end] OpenAI error:', e);
    }

    // Fallback determinista si OpenAI falla
    return `Reporte de cierre — ${caregiverName} · ${shiftLabel}

Residentes a cargo (${patients.length}): ${patients.map(p => p.name).join(', ') || 'sin asignación por color'}.

Actividad registrada: ${activity.medsAdministered} meds administrados, ${activity.medsOmitted.length} omitidos/rehusados, ${activity.mealCount} comidas, ${activity.bathCount} baños, ${activity.vitalCount} vitales, ${activity.rotations} rotaciones UPP.

Incidencias: ${activity.falls.length} caídas, ${activity.clinicalAlerts.length} alertas clínicas. ${Object.keys(justifications).length > 0 ? `${Object.keys(justifications).length} tareas con justificación pendiente.` : ''}

(Resumen generado sin IA por fallo de servicio; revisar detalle en notas.)`;
}

export async function POST(req: Request) {
    try {
        const authSession = await getServerSession(authOptions);
        if (!authSession?.user) {
            return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
        }
        const invokerId = (authSession.user as any).id;
        const invokerRole = (authSession.user as any).role;
        const invokerHqId = (authSession.user as any).headquartersId;
        const invokerName = (authSession.user as any).name || 'Supervisor';

        const { shiftSessionId, handoverData, signature, forceEnd } = await req.json();

        if (!shiftSessionId) {
            return NextResponse.json({ success: false, error: "shiftSessionId requerido" }, { status: 400 });
        }

        const session = await prisma.shiftSession.findUnique({
            where: { id: shiftSessionId },
            include: { caregiver: true },
        });

        if (!session) {
            return NextResponse.json({ success: false, error: "Turno no encontrado" }, { status: 404 });
        }

        const isOwner = session.caregiverId === invokerId;
        const isSupervisor = SUPERVISOR_ROLES.includes(invokerRole) && session.headquartersId === invokerHqId;
        if (!isOwner && !isSupervisor) {
            return NextResponse.json({ success: false, error: "No tienes permiso para cerrar este turno" }, { status: 403 });
        }

        if (session.actualEndTime && !forceEnd) {
            return NextResponse.json({ success: false, error: "Este turno ya fue finalizado" }, { status: 400 });
        }

        const now = new Date();
        const shiftTypeDraft: ShiftT = inferShiftType(now);
        const shiftStart = session.startTime < todayStartAST() ? todayStartAST() : session.startTime;

        // ──────────────────────────────────────────────────────────────────
        // FLUJO 1 — Cierre con Wizard (cuidador o supervisor actuando por él)
        // ──────────────────────────────────────────────────────────────────
        if (handoverData && signature && !forceEnd) {
            // 1. Resolver colorGroups del cuidador
            const colorGroups = await resolveColorGroupsForCaregiver(session.caregiverId, session.headquartersId, shiftStart);
            // 2. Residentes por color
            const patients = await resolvePatientsByColors(colorGroups, session.headquartersId);
            // 3. Actividad del turno
            const activity = await collectShiftActivity({
                caregiverId: session.caregiverId,
                patientIds: patients.map(p => p.id),
                shiftStart,
            });
            // 4. Resumen Zendi (GPT-4o-mini con datos reales)
            const justifications = (handoverData.justifications ?? {}) as Record<string, string>;
            const zendiSummary = await buildZendiSummary({
                caregiverName: session.caregiver?.name || 'Cuidador(a)',
                shiftType: shiftTypeDraft,
                patients,
                activity,
                justifications,
            });

            const [handover, closedSession] = await prisma.$transaction(async (tx) => {
                const shiftHandover = await tx.shiftHandover.create({
                    data: {
                        headquartersId: session.headquartersId,
                        shiftType: shiftTypeDraft,
                        outgoingNurseId: session.caregiverId,
                        status: 'PENDING',
                        aiSummaryReport: zendiSummary,
                        signature,
                        signedOutAt: now,
                        justifications,
                        handoverCompleted: true,
                        colorGroups,
                        isDailyPrologue: false,
                        // Sprint L — la cuidadora firma SU reporte individual: eso
                        // actúa como auto-confirmación (pasa a CONFIRMED, listo
                        // para firma del supervisor).
                        seniorCaregiverId: session.caregiverId,
                        seniorConfirmedAt: now,
                        seniorNote: 'Cuidador(a) autoconfirmó su reporte individual al cierre de turno.',
                    },
                });

                // Notas clínicas por residente — priorizar selectedPatients del wizard;
                // si no hay, crear una nota ligera por residente asignado con snippet del turno.
                const selected = (handoverData.selectedPatients ?? {}) as Record<string, string>;
                const selectedIds = Object.keys(selected);
                if (selectedIds.length > 0) {
                    await tx.handoverNote.createMany({
                        data: selectedIds.map(patientId => ({
                            shiftHandoverId: shiftHandover.id,
                            patientId,
                            clinicalNotes: selected[patientId],
                            isCritical: false,
                        })),
                    });
                } else if (patients.length > 0) {
                    const criticalIds = new Set<string>([
                        ...activity.falls.map(f => patients.find(p => p.name === f.patientName)?.id).filter((x): x is string => !!x),
                        ...activity.clinicalAlerts.map(a => patients.find(p => p.name === a.patientName)?.id).filter((x): x is string => !!x),
                    ]);
                    await tx.handoverNote.createMany({
                        data: patients.map(p => ({
                            shiftHandoverId: shiftHandover.id,
                            patientId: p.id,
                            clinicalNotes: `Turno ${shiftTypeDraft} cerrado por ${session.caregiver?.name || 'cuidador(a)'}. Ver aiSummaryReport para detalle.`,
                            isCritical: criticalIds.has(p.id),
                        })),
                    });
                }

                const updatedSession = await tx.shiftSession.update({
                    where: { id: shiftSessionId },
                    data: {
                        actualEndTime: now,
                        handoverCompleted: true,
                        aiSummaryReport: zendiSummary,
                        shiftHandoverId: shiftHandover.id,
                    },
                });

                await tx.systemAuditLog.create({
                    data: {
                        headquartersId: session.headquartersId,
                        entityName: 'ShiftHandover',
                        entityId: shiftHandover.id,
                        action: SystemAuditAction.SIGNED_OUT,
                        performedById: invokerId,
                        payloadChanges: {
                            shiftSessionId: session.id,
                            tasksExempted: justifications,
                            zendiApproved: true,
                            closedBySupervisor: !isOwner,
                            ownerCaregiverId: session.caregiverId,
                            colorGroups,
                            patientCount: patients.length,
                        },
                    },
                });

                return [shiftHandover, updatedSession];
            });

            return NextResponse.json({ success: true, shiftSession: closedSession, handover });
        }

        // ──────────────────────────────────────────────────────────────────
        // FLUJO 2 — Cierre forzado por supervisor (sin wizard)
        // ──────────────────────────────────────────────────────────────────
        if (!isSupervisor) {
            return NextResponse.json({
                success: false,
                error: "Debes completar el wizard de cierre. Si el cuidador no puede, un supervisor debe forzar el cierre.",
            }, { status: 400 });
        }

        const forcedSummary = `Cierre forzado por supervisor ${invokerName}. Sin reporte clínico del cuidador.`;

        const [forcedHandover, forcedSession] = await prisma.$transaction(async (tx) => {
            const handover = await tx.shiftHandover.create({
                data: {
                    headquartersId: session.headquartersId,
                    shiftType: shiftTypeDraft,
                    outgoingNurseId: session.caregiverId,
                    status: 'PENDING',
                    aiSummaryReport: forcedSummary,
                    handoverCompleted: false,
                    colorGroups: [],
                    isDailyPrologue: false,
                    supervisorSignedById: invokerId,
                    supervisorSignedAt: now,
                    supervisorNote: `Cierre forzado — cuidador no disponible. Invocado por ${invokerName}.`,
                },
            });

            const updatedSession = await tx.shiftSession.update({
                where: { id: shiftSessionId },
                data: {
                    actualEndTime: now,
                    aiSummaryReport: forcedSummary,
                    shiftHandoverId: handover.id,
                },
            });

            await tx.systemAuditLog.create({
                data: {
                    headquartersId: session.headquartersId,
                    entityName: 'ShiftHandover',
                    entityId: handover.id,
                    action: SystemAuditAction.SYSTEM_ABANDONED,
                    performedById: invokerId,
                    payloadChanges: {
                        kind: 'FORCE_CLOSED_BY_SUPERVISOR',
                        shiftSessionId: session.id,
                        ownerCaregiverId: session.caregiverId,
                        supervisorId: invokerId,
                        supervisorName: invokerName,
                    },
                },
            });

            return [handover, updatedSession];
        });

        return NextResponse.json({ success: true, shiftSession: forcedSession, handover: forcedHandover, forced: true });

    } catch (error) {
        console.error("Shift End Error:", error);
        return NextResponse.json({ success: false, error: "Error de Servidor al Consolidar la Guardia" }, { status: 500 });
    }
}
