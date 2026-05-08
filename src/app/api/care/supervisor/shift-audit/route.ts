import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * GET /api/care/supervisor/shift-audit?shiftSessionId=X
 *
 * Devuelve el audit completo de un turno, estructurado por residente,
 * con timestamps de cada acción y "brechas" (lo que no se registró).
 *
 * Solo accesible para SUPERVISOR, DIRECTOR, ADMIN de la misma sede.
 */
export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

        const role   = (session.user as any).role;
        const hqId   = (session.user as any).headquartersId;
        if (!['SUPERVISOR', 'DIRECTOR', 'ADMIN'].includes(role)) {
            return NextResponse.json({ error: 'Acceso solo para supervisores' }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        const shiftSessionId = searchParams.get('shiftSessionId');
        if (!shiftSessionId) return NextResponse.json({ error: 'shiftSessionId requerido' }, { status: 400 });

        // ── Cargar la sesión ──────────────────────────────────────────────────
        const shiftSession = await prisma.shiftSession.findUnique({
            where: { id: shiftSessionId },
            include: { caregiver: { select: { id: true, name: true, role: true, headquartersId: true } } }
        });
        if (!shiftSession) return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 });
        if (shiftSession.caregiver.headquartersId !== hqId) {
            return NextResponse.json({ error: 'Turno fuera de tu sede' }, { status: 403 });
        }

        const caregiverId = shiftSession.caregiverId;
        const caregiverName = shiftSession.caregiver.name;
        const shiftStart = shiftSession.startTime;
        const shiftEnd = shiftSession.actualEndTime ?? new Date();

        // Detectar turno nocturno
        const astHour = (shiftStart.getUTCHours() - 4 + 24) % 24;
        const shiftType = astHour >= 6 && astHour < 14 ? 'MORNING'
            : astHour >= 14 && astHour < 22 ? 'EVENING'
            : 'NIGHT';
        const isNight = shiftType === 'NIGHT';

        // ── Resolver grupos de color del cuidador ────────────────────────────
        const todayStart = new Date(shiftStart);
        todayStart.setUTCHours(0, 0, 0, 0);
        const tomorrow = new Date(todayStart);
        tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

        const scheduledShifts = await prisma.scheduledShift.findMany({
            where: { userId: caregiverId, date: { gte: todayStart, lt: tomorrow } },
            include: { colorAssignments: true },
        });
        let colorGroups: string[] = scheduledShifts
            .flatMap(s => s.colorAssignments.map(a => a.color))
            .filter(Boolean);
        if (colorGroups.length === 0) {
            colorGroups = scheduledShifts
                .map(s => s.colorGroup)
                .filter((c): c is string => !!c && c !== 'UNASSIGNED');
        }

        // Fallback: último color asignado por ShiftColorAssignment
        if (colorGroups.length === 0) {
            const lastColor = await prisma.shiftColorAssignment.findFirst({
                where: { userId: caregiverId },
                orderBy: { assignedAt: 'desc' },
                select: { color: true }
            });
            if (lastColor?.color) colorGroups = [lastColor.color];
        }

        // ── Residentes del grupo ─────────────────────────────────────────────
        const patients = colorGroups.length === 0 ? [] : await prisma.patient.findMany({
            where: {
                headquartersId: hqId,
                status: { in: ['ACTIVE', 'TEMPORARY_LEAVE'] as any[] },
                ...(colorGroups.includes('ALL') ? {} : { colorGroup: { in: colorGroups as any[] } }),
            },
            select: {
                id: true, name: true, colorGroup: true, roomNumber: true,
                pressureUlcers: { where: { status: 'ACTIVE' }, select: { id: true }, take: 1 }
            },
            orderBy: { roomNumber: 'asc' }
        });

        const patientIds = patients.map(p => p.id);

        if (patientIds.length === 0) {
            return NextResponse.json({
                success: true,
                audit: buildEmptyAudit({ caregiverName, caregiverId, shiftStart, shiftEnd, shiftType, colorGroups, shiftSession }),
            });
        }

        // ── Recopilar toda la actividad del turno ───────────────────────────
        const [
            baths,
            meals,
            medsAdmin,
            medsOmitted,
            vitals,
            rotations,
            dailyLogs,
            falls,
            nightDiapers,
            dayDiapers,
            handover,
        ] = await Promise.all([
            // Baños
            prisma.bathLog.findMany({
                where: { caregiverId, patientId: { in: patientIds }, timeLogged: { gte: shiftStart, lte: shiftEnd } },
                select: { patientId: true, timeLogged: true, status: true },
                orderBy: { timeLogged: 'asc' }
            }),
            // Comidas
            prisma.mealLog.findMany({
                where: { caregiverId, patientId: { in: patientIds }, timeLogged: { gte: shiftStart, lte: shiftEnd } },
                select: { patientId: true, timeLogged: true, mealType: true, quality: true },
                orderBy: { timeLogged: 'asc' }
            }),
            // Meds administrados
            prisma.medicationAdministration.findMany({
                where: {
                    administeredById: caregiverId,
                    administeredAt: { gte: shiftStart, lte: shiftEnd },
                    status: 'ADMINISTERED',
                    patientMedication: { patientId: { in: patientIds } }
                },
                select: {
                    administeredAt: true,
                    patientMedication: {
                        select: {
                            patientId: true,
                            medication: { select: { name: true, dosage: true } }
                        }
                    }
                },
                orderBy: { administeredAt: 'asc' }
            }),
            // Meds omitidos
            prisma.medicationAdministration.findMany({
                where: {
                    administeredById: caregiverId,
                    administeredAt: { gte: shiftStart, lte: shiftEnd },
                    status: { in: ['OMITTED', 'REFUSED'] },
                    patientMedication: { patientId: { in: patientIds } }
                },
                select: {
                    administeredAt: true,
                    status: true,
                    notes: true,
                    patientMedication: {
                        select: {
                            patientId: true,
                            medication: { select: { name: true, dosage: true } }
                        }
                    }
                },
                orderBy: { administeredAt: 'asc' }
            }),
            // Vitales
            prisma.vitalSigns.findMany({
                where: { measuredById: caregiverId, patientId: { in: patientIds }, createdAt: { gte: shiftStart, lte: shiftEnd } },
                select: { patientId: true, createdAt: true, heartRate: true, systolic: true, diastolic: true, temperature: true, spo2: true },
                orderBy: { createdAt: 'asc' }
            }),
            // Rotaciones posturales
            prisma.posturalChangeLog.findMany({
                where: { nurseId: caregiverId, patientId: { in: patientIds }, performedAt: { gte: shiftStart, lte: shiftEnd } },
                select: { patientId: true, performedAt: true, position: true, isComplianceAlert: true },
                orderBy: { performedAt: 'asc' }
            }),
            // Notas diarias / alertas clínicas
            prisma.dailyLog.findMany({
                where: { authorId: caregiverId, patientId: { in: patientIds }, createdAt: { gte: shiftStart, lte: shiftEnd } },
                select: { patientId: true, createdAt: true, notes: true, isClinicalAlert: true },
                orderBy: { createdAt: 'asc' }
            }),
            // Caídas
            prisma.fallIncident.findMany({
                where: { patientId: { in: patientIds }, reportedAt: { gte: shiftStart, lte: shiftEnd } },
                select: { patientId: true, reportedAt: true, severity: true, location: true, notes: true },
                orderBy: { reportedAt: 'asc' }
            }),
            // Pañal nocturno (clinicalNote con [RONDA NOCTURNA ZENDI])
            prisma.clinicalNote.findMany({
                where: {
                    authorId: caregiverId,
                    patientId: { in: patientIds },
                    createdAt: { gte: shiftStart, lte: shiftEnd },
                    content: { contains: '[RONDA NOCTURNA ZENDI]' }
                },
                select: { patientId: true, createdAt: true, content: true },
                orderBy: { createdAt: 'asc' }
            }),
            // Pañal diurno (clinicalNote con [CAMBIO PAÑAL DIURNO ZENDI])
            prisma.clinicalNote.findMany({
                where: {
                    authorId: caregiverId,
                    patientId: { in: patientIds },
                    createdAt: { gte: shiftStart, lte: shiftEnd },
                    content: { contains: '[CAMBIO PAÑAL DIURNO ZENDI]' }
                },
                select: { patientId: true, createdAt: true, content: true },
                orderBy: { createdAt: 'asc' }
            }),
            // Handover asociado
            prisma.shiftHandover.findFirst({
                where: { outgoingNurseId: caregiverId, createdAt: { gte: shiftStart } },
                select: {
                    id: true, shiftType: true, createdAt: true, signedOutAt: true,
                    handoverCompleted: true, supervisorSignedAt: true,
                    supervisorSigned: { select: { name: true } },
                    incomingNurse: { select: { name: true } },
                    seniorCaregiver: { select: { name: true } },
                    colorGroups: true,
                },
                orderBy: { createdAt: 'desc' }
            }),
        ]);

        // ── Construir timeline por residente ─────────────────────────────────
        type AuditEntry = {
            time: Date;
            type: string;
            label: string;
            detail: string;
            severity: 'ok' | 'warn' | 'critical';
        };

        const MEAL_LABEL: Record<string, string> = {
            BREAKFAST: 'Desayuno', LUNCH: 'Almuerzo', DINNER: 'Cena',
            SNACK: 'Merienda', HYDRATION: 'Hidratación'
        };
        const AMOUNT_LABEL: Record<string, string> = {
            ALL: 'Consumió todo', HALF: 'Consumió la mitad',
            LITTLE: 'Comió poco', NONE: 'No comió'
        };

        const parseDiaperType = (content: string): string => {
            if (content.includes('Pañal Seco')) return 'Seco ✓';
            if (content.includes('humedad')) return 'Húmedo — cambio realizado';
            if (content.includes('evacuación') || content.includes('Evacuación')) return 'Evacuación — higiene mayor';
            return 'Control registrado';
        };

        const patientAudits = patients.map(patient => {
            const pid = patient.id;
            const hasActiveUPP = (patient.pressureUlcers?.length ?? 0) > 0;
            const entries: AuditEntry[] = [];

            // Baños
            baths.filter(b => b.patientId === pid).forEach(b => {
                entries.push({ time: b.timeLogged, type: 'BATH', label: '🛁 Baño', detail: b.status === 'COMPLETED' ? 'Completado' : b.status, severity: 'ok' });
            });

            // Comidas
            meals.filter(m => m.patientId === pid).forEach(m => {
                const q = m.quality as string;
                const amtSev: AuditEntry['severity'] = q === 'NONE' ? 'warn' : q === 'LITTLE' ? 'warn' : 'ok';
                entries.push({
                    time: m.timeLogged,
                    type: 'MEAL',
                    label: `🍽️ ${MEAL_LABEL[m.mealType] || m.mealType}`,
                    detail: AMOUNT_LABEL[q] || q,
                    severity: amtSev
                });
            });

            // Meds administrados
            medsAdmin.filter(m => m.patientMedication?.patientId === pid).forEach(m => {
                const med = m.patientMedication?.medication;
                entries.push({
                    time: m.administeredAt ?? new Date(),
                    type: 'MED_OK',
                    label: `💊 Medicamento administrado`,
                    detail: `${med?.name || 'Desconocido'}${med?.dosage ? ` · ${med.dosage}` : ''}`,
                    severity: 'ok'
                });
            });

            // Meds omitidos
            medsOmitted.filter(m => m.patientMedication?.patientId === pid).forEach(m => {
                const med = m.patientMedication?.medication;
                entries.push({
                    time: m.administeredAt ?? new Date(),
                    type: 'MED_OMIT',
                    label: `⚠️ Medicamento ${m.status === 'REFUSED' ? 'rehusado' : 'omitido'}`,
                    detail: `${med?.name || 'Desconocido'} — ${m.notes || 'Sin justificación registrada'}`,
                    severity: 'critical'
                });
            });

            // Vitales
            vitals.filter(v => v.patientId === pid).forEach(v => {
                const parts: string[] = [];
                if (v.heartRate) parts.push(`FC ${v.heartRate}bpm`);
                if (v.systolic && v.diastolic) parts.push(`PA ${v.systolic}/${v.diastolic}`);
                if (v.temperature) parts.push(`T° ${v.temperature}°F`);
                if (v.spo2) parts.push(`SpO2 ${v.spo2}%`);
                entries.push({
                    time: v.createdAt,
                    type: 'VITAL',
                    label: '📊 Signos Vitales',
                    detail: parts.join(' · ') || 'Registrados',
                    severity: 'ok'
                });
            });

            // Rotaciones
            rotations.filter(r => r.patientId === pid).forEach(r => {
                entries.push({
                    time: r.performedAt,
                    type: 'ROTATION',
                    label: r.isComplianceAlert ? '⚠️ Rotación tardía' : '🔄 Rotación postural',
                    detail: r.position || 'Posición registrada',
                    severity: r.isComplianceAlert ? 'warn' : 'ok'
                });
            });

            // Notas diarias
            dailyLogs.filter(d => d.patientId === pid).forEach(d => {
                const rawNote = d.notes || '';
                if (rawNote.includes('[RONDA NOCTURNA') || rawNote.includes('[CAMBIO PAÑAL')) return; // se muestran abajo
                entries.push({
                    time: d.createdAt,
                    type: d.isClinicalAlert ? 'ALERT' : 'NOTE',
                    label: d.isClinicalAlert ? '🚨 Alerta Clínica' : '📝 Nota de turno',
                    detail: rawNote.slice(0, 120) + (rawNote.length > 120 ? '…' : ''),
                    severity: d.isClinicalAlert ? 'critical' : 'ok'
                });
            });

            // Caídas
            falls.filter(f => f.patientId === pid).forEach(f => {
                entries.push({
                    time: f.reportedAt,
                    type: 'FALL',
                    label: '🆘 Caída reportada',
                    detail: `${f.location} · Severidad ${f.severity}${f.notes ? ` · ${f.notes.slice(0, 80)}` : ''}`,
                    severity: 'critical'
                });
            });

            // Pañal nocturno
            nightDiapers.filter(d => d.patientId === pid).forEach(d => {
                entries.push({
                    time: d.createdAt,
                    type: 'DIAPER_NIGHT',
                    label: '🌙 Control de pañal nocturno',
                    detail: parseDiaperType(d.content),
                    severity: 'ok'
                });
            });

            // Pañal diurno
            dayDiapers.filter(d => d.patientId === pid).forEach(d => {
                entries.push({
                    time: d.createdAt,
                    type: 'DIAPER_DAY',
                    label: '🩺 Control de continencia',
                    detail: parseDiaperType(d.content),
                    severity: 'ok'
                });
            });

            // Ordenar cronológicamente
            entries.sort((a, b) => a.time.getTime() - b.time.getTime());

            // ── Brechas (gaps) ─────────────────────────────────────────────
            const gaps: { label: string; severity: 'warn' | 'critical' }[] = [];

            // Sin atención en todo el turno
            if (entries.length === 0) {
                gaps.push({ label: 'Sin actividad registrada en este turno', severity: 'critical' });
            }

            // Sin baño (solo turno diurno y vespertino)
            if (!isNight && baths.filter(b => b.patientId === pid).length === 0) {
                gaps.push({ label: 'Baño no registrado', severity: 'warn' });
            }

            // Sin comida registrada (turno diurno)
            if (shiftType === 'MORNING') {
                const hasMeal = meals.some(m => m.patientId === pid);
                if (!hasMeal) gaps.push({ label: 'Ninguna comida registrada (turno AM)', severity: 'warn' });
            }

            // Meds omitidos sin justificación
            const omitSinJust = medsOmitted.filter(m =>
                m.patientMedication?.patientId === pid && (!m.notes || m.notes.trim().length < 5)
            );
            if (omitSinJust.length > 0) {
                gaps.push({ label: `${omitSinJust.length} medicamento(s) omitido(s) sin justificación`, severity: 'critical' });
            }

            // Residente con UPP activa y sin rotaciones
            if (hasActiveUPP && rotations.filter(r => r.patientId === pid).length === 0) {
                gaps.push({ label: 'Úlcera activa (UPP) — sin rotaciones posturales registradas', severity: 'critical' });
            }

            // Rotaciones tardías
            const lateRotations = rotations.filter(r => r.patientId === pid && r.isComplianceAlert);
            if (lateRotations.length > 0) {
                gaps.push({ label: `${lateRotations.length} rotación(es) fuera de tiempo`, severity: 'warn' });
            }

            return {
                id: patient.id,
                name: patient.name,
                room: patient.roomNumber || '—',
                colorGroup: patient.colorGroup,
                hasActiveUPP,
                entries,
                gaps,
                counts: {
                    baths: baths.filter(b => b.patientId === pid).length,
                    meals: meals.filter(m => m.patientId === pid).length,
                    medsOk: medsAdmin.filter(m => m.patientMedication?.patientId === pid).length,
                    medsOmit: medsOmitted.filter(m => m.patientMedication?.patientId === pid).length,
                    vitals: vitals.filter(v => v.patientId === pid).length,
                    rotations: rotations.filter(r => r.patientId === pid).length,
                    diapers: [
                        ...nightDiapers.filter(d => d.patientId === pid),
                        ...dayDiapers.filter(d => d.patientId === pid),
                    ].length,
                    alerts: dailyLogs.filter(d => d.patientId === pid && d.isClinicalAlert).length,
                }
            };
        });

        // ── Totales ───────────────────────────────────────────────────────────
        const totalGaps = patientAudits.reduce((s, p) => s + p.gaps.length, 0);
        const totalCritical = patientAudits.reduce(
            (s, p) => s + p.gaps.filter(g => g.severity === 'critical').length, 0
        );
        const patientsNoActivity = patientAudits.filter(p => p.entries.length === 0).length;

        return NextResponse.json({
            success: true,
            audit: {
                shiftSessionId: shiftSession.id,
                caregiverId,
                caregiverName,
                shiftType,
                shiftStart,
                shiftEnd: shiftSession.actualEndTime,
                isOpen: !shiftSession.actualEndTime,
                colorGroups,
                totalResidents: patients.length,
                patients: patientAudits,
                summary: {
                    totalBaths: baths.length,
                    totalMeals: meals.length,
                    totalMedsOk: medsAdmin.length,
                    totalMedsOmit: medsOmitted.length,
                    totalVitals: vitals.length,
                    totalRotations: rotations.length,
                    totalDiapers: nightDiapers.length + dayDiapers.length,
                    totalAlerts: dailyLogs.filter(d => d.isClinicalAlert).length,
                    totalFalls: falls.length,
                    totalGaps,
                    totalCritical,
                    patientsNoActivity,
                },
                handover: handover ? {
                    id: handover.id,
                    completed: handover.handoverCompleted,
                    completedAt: handover.signedOutAt,
                    supervisorSignedAt: handover.supervisorSignedAt,
                    supervisorName: handover.supervisorSigned?.name || null,
                    incomingName: handover.incomingNurse?.name || handover.seniorCaregiver?.name || null,
                    colorGroups: handover.colorGroups,
                } : null,
            }
        });

    } catch (err: any) {
        console.error('[shift-audit]', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

function buildEmptyAudit(params: any) {
    return {
        ...params,
        totalResidents: 0,
        patients: [],
        summary: {
            totalBaths: 0, totalMeals: 0, totalMedsOk: 0, totalMedsOmit: 0,
            totalVitals: 0, totalRotations: 0, totalDiapers: 0, totalAlerts: 0,
            totalFalls: 0, totalGaps: 0, totalCritical: 0, patientsNoActivity: 0,
        },
        handover: null,
    };
}
