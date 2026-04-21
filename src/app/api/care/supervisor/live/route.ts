import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { todayStartAST } from '@/lib/dates';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { resolveEffectiveHqId } from '@/lib/hq-resolver';

export interface TriageTicket {
    id: string;
    sourceId: string;
    sourceType: string;
    category: string;
    title: string;
    description: string;
    patientId?: string | null;
    patientName: string;
    urgency: string;
    createdAt: Date;
    items?: TriageTicket[];
}

// FASE 2: Control Estricto de Caché en Rutas Dinámicas
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const requestedHqId = searchParams.get('hqId');

        let hqId: string;
        try {
            hqId = await resolveEffectiveHqId(session, requestedHqId);
        } catch (e: any) {
            return NextResponse.json({ success: false, error: e.message || 'Sede inválida' }, { status: 400 });
        }

        // FIX timezone: ventana rodante de 24h en vez de "medianoche UTC del servidor",
        // que deja el dashboard vacío cada noche cuando UTC cruza 00:00.
        const todayStart = todayStartAST();
        const twelveHrsAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
        const fourteenHrsAgo = new Date(Date.now() - 14 * 60 * 60 * 1000);
        const twentyFourHrsAgo = new Date(Date.now() - 24 * 3600000);
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600000);

        // ── Turno clínico activo según hora local AST (America/Puerto_Rico) ──
        // MORNING 6-13 · EVENING 14-21 · NIGHT 22-5
        const astFmt = new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/Puerto_Rico' });
        const astHour = parseInt(astFmt.format(new Date()), 10) % 24;
        const currentShift: 'MORNING' | 'EVENING' | 'NIGHT' =
            astHour >= 6 && astHour < 14 ? 'MORNING'
            : astHour >= 14 && astHour < 22 ? 'EVENING'
            : 'NIGHT';
        const shiftWindow: Record<typeof currentShift, [number, number]> = {
            MORNING: [6, 14],
            EVENING: [14, 22],
            NIGHT: [22, 30], // 22..29 ≡ 22..5 (+24 para madrugada)
        };
        const [shiftFrom, shiftTo] = shiftWindow[currentShift];

        // ============================================================================
        // FASE 2 + SPRINT K: OPTIMIZACIÓN DE LATENCIA — PROMISE.ALL CONCURRENTE
        // 14 queries legacy + 6 queries Sprint K = 20 consultas en un solo ciclo
        // ============================================================================
        const [
            activeSessions,
            bathsToday,
            mealsToday,
            incidentsToday,
            pendingComplaintsList,
            recentIncidents,
            pxWithUPP,
            briefing,
            endedSchedules,
            todayHandovers,
            activeFastActions,
            clinicalAlerts,
            fallIncidents,
            lastBriefingEver,
            // ── Sprint K: 6 queries nuevas ──
            vitalsOrdersToday,
            medsAdministeredToday,
            activeMedsForDenominator,
            handoversTodayFull,
            activeIncidentReports,
            todayZoneInspections,
        ] = await Promise.all([
            // 1. Cuidadores Activos — ventana rodante de 14h para incluir turnos
            //    NIGHT que arrancaron antes del día clínico actual y sesiones que
            //    iniciaron 16 min antes de las 6am AST. Antes usaba gte: todayStart
            //    (6am AST) y dejaba fuera al NIGHT vivo.
            prisma.shiftSession.findMany({ where: { headquartersId: hqId, actualEndTime: null, startTime: { gte: fourteenHrsAgo } }, include: { caregiver: { select: { id: true, name: true, role: true, pinCode: true, complianceScore: true } } } }),
            // 2. Progreso de Baños
            prisma.bathLog.count({ where: { timeLogged: { gte: todayStart }, patient: { headquartersId: hqId } } }),
            // 3. Progreso de Comidas
            prisma.mealLog.groupBy({ by: ['mealType'], where: { timeLogged: { gte: todayStart }, patient: { headquartersId: hqId } }, _count: { mealType: true } }),
            // 4. Incidentes (Hoy)
            prisma.incident.count({ where: { headquartersId: hqId, reportedAt: { gte: todayStart } } }),
            // 5. Quejas Triage Pendientes
            prisma.complaint.findMany({ where: { headquartersId: hqId, status: 'PENDING' }, include: { patient: true }, orderBy: { createdAt: 'asc' } }),
            // 6. Incidentes Recientes (24 hrs para feed)
            prisma.incident.findMany({ where: { headquartersId: hqId, reportedAt: { gte: twentyFourHrsAgo } }, include: { patient: true } }),
            // 7. Pacientes con UPP Activas
            prisma.patient.findMany({ where: { headquartersId: hqId, pressureUlcers: { some: { status: 'ACTIVE' } } }, include: { posturalChanges: { orderBy: { performedAt: 'desc' }, take: 1 } } }),
            // 8. Zendi Morning Briefing — Sprint L: solo el prólogo del cron (isDailyPrologue=true)
            prisma.shiftHandover.findFirst({ where: { headquartersId: hqId, shiftType: 'MORNING', isDailyPrologue: true, createdAt: { gte: todayStart }, aiSummaryReport: { not: null } }, orderBy: { createdAt: 'desc' } }),
            // 9. Schedules para validar Handovers (Ultimas 12 hrs)
            prisma.shiftSchedule.findMany({ where: { headquartersId: hqId, endTime: { lt: new Date(), gte: twelveHrsAgo } }, include: { employee: true } }),
            // 10. Handovers enviados hoy
            prisma.shiftHandover.findMany({ where: { headquartersId: hqId, createdAt: { gte: twelveHrsAgo } }, select: { outgoingNurseId: true, shiftType: true } }),
            // 11. Fast Actions Activas
            prisma.fastActionAssignment.findMany({ where: { headquartersId: hqId, status: 'PENDING', expiresAt: { gt: new Date() } }, include: { caregiver: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' } }),
            // 12. Alertas Clínicas del Action Hub (DailyLog con isClinicalAlert = true, últimas 24h)
            prisma.dailyLog.findMany({ where: { patient: { headquartersId: hqId }, isClinicalAlert: true, createdAt: { gte: twentyFourHrsAgo } }, include: { patient: { select: { id: true, name: true, colorGroup: true } }, author: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' }, take: 20 }),
            // 13. Caídas recientes (FallIncident — NO Incident genérico)
            prisma.fallIncident.findMany({
                where: { patient: { headquartersId: hqId }, incidentDate: { gte: twentyFourHrsAgo } },
                include: { patient: { select: { id: true, name: true, colorGroup: true } } },
                orderBy: { incidentDate: 'desc' },
                take: 10,
            }),
            // 14. Último handover con briefing AI (sin filtro de fecha) — para el estado vacío
            prisma.shiftHandover.findFirst({
                where: { headquartersId: hqId, aiSummaryReport: { not: null } },
                orderBy: { createdAt: 'desc' },
                select: { createdAt: true },
            }),
            // ── Sprint K #15: Vitales de entrada automáticos del día (autoCreated ventana 4h)
            prisma.vitalsOrder.findMany({
                where: { headquartersId: hqId, autoCreated: true, orderedAt: { gte: todayStart } },
                include: {
                    patient: { select: { id: true, name: true, colorGroup: true } },
                    caregiver: { select: { id: true, name: true } },
                },
                orderBy: { orderedAt: 'desc' },
            }),
            // ── Sprint K #16: MedicationAdministrations registradas hoy (para numerador de % turno)
            prisma.medicationAdministration.findMany({
                where: {
                    patientMedication: { patient: { headquartersId: hqId } },
                    createdAt: { gte: todayStart },
                },
                select: {
                    id: true,
                    status: true,
                    scheduleTime: true,
                    scheduledTime: true,
                    administeredAt: true,
                    createdAt: true,
                    administeredById: true,
                    patientMedicationId: true,
                },
            }),
            // ── Sprint K #17: PatientMedication ACTIVE para denominador de % turno
            prisma.patientMedication.findMany({
                where: {
                    patient: { headquartersId: hqId, status: 'ACTIVE' },
                    isActive: true,
                    status: 'ACTIVE',
                },
                select: { id: true, patientId: true, scheduleTimes: true, frequency: true },
            }),
            // ── Sprint K #18 + Sprint L: Handovers individuales de cuidadores hoy
            // (isDailyPrologue=false para excluir el prólogo del cron; incluye colorGroups y notas)
            prisma.shiftHandover.findMany({
                where: { headquartersId: hqId, createdAt: { gte: todayStart }, isDailyPrologue: false, signature: { not: null } },
                include: {
                    outgoingNurse: { select: { id: true, name: true } },
                    incomingNurse: { select: { id: true, name: true } },
                    seniorCaregiver: { select: { id: true, name: true } },
                    supervisorSigned: { select: { id: true, name: true } },
                    _count: { select: { notes: true } },
                },
                orderBy: { createdAt: 'desc' },
                take: 20,
            }),
            // ── Sprint K #19: IncidentReport Sprint C en estados activos + observaciones 7d
            prisma.incidentReport.findMany({
                where: {
                    headquartersId: hqId,
                    createdAt: { gte: sevenDaysAgo },
                    status: { in: ['NOTIFIED', 'PENDING_EXPLANATION', 'EXPLANATION_RECEIVED'] },
                },
                include: {
                    employee: { select: { id: true, name: true, role: true } },
                    supervisor: { select: { id: true, name: true } },
                },
                orderBy: { createdAt: 'desc' },
                take: 30,
            }),
            // ── Sprint K #20: Rondas de inspección de hoy (resumen X/3)
            prisma.zoneInspection.findMany({
                where: { headquartersId: hqId, createdAt: { gte: todayStart } },
                select: { id: true, roundType: true, floor: true, zoneName: true, createdAt: true },
            }),
        ]);

        // ============================================================================
        // PROCESAMIENTO SINCRÓNICO (CPU) POST-DB
        // ============================================================================
        const triageFeed: TriageTicket[] = [];

        // Integrar Quejas (Family/Mantenimiento)
        pendingComplaintsList.forEach(c => {
            const isMaint = c.description.toLowerCase().includes('mantenimiento') || c.description.toLowerCase().includes('roto') || c.description.toLowerCase().includes('foco') || c.description.toLowerCase().includes('agua');
            triageFeed.push({
                id: `cmp_${c.id}`,
                sourceId: c.id,
                sourceType: 'COMPLAINT',
                category: isMaint ? 'MANTENIMIENTO' : 'FAMILY',
                title: isMaint ? 'Reporte Operativo/Mantenimiento' : 'Preocupación Familiar',
                description: c.description,
                patientId: c.patientId || null,
                patientName: c.patient?.name || 'Ámbito General',
                urgency: isMaint ? 'RUTINA' : 'ATENCION',
                createdAt: c.createdAt,
            });
        });

        // Integrar Caídas reales (FallIncident — NO el modelo Incident genérico)
        fallIncidents.forEach((fi: any) => {
            const urg = fi.severity === 'SEVERE' || fi.severity === 'FATAL' ? 'INMINENTE'
                : fi.severity === 'MILD' ? 'ATENCION' : 'RUTINA';
            triageFeed.push({
                id: `fall_${fi.id}`,
                sourceId: fi.id,
                sourceType: 'INCIDENT',
                category: 'CLINICO_CRITICO',
                title: `Caída Reportada (${fi.severity})`,
                description: `${fi.location} — ${fi.interventions}${fi.notes ? ' · ' + fi.notes : ''}`,
                patientId: fi.patientId || null,
                patientName: fi.patient?.name || 'N/A',
                urgency: urg,
                createdAt: fi.incidentDate,
            });
        });

        // Integrar Incidentes Clínicos
        recentIncidents.forEach(inc => {
            let urg = 'RUTINA';
            if (inc.severity === 'CRITICAL' || inc.type === 'FALL') urg = 'INMINENTE';
            else if (inc.severity === 'HIGH' || inc.type === 'ULCER') urg = 'ATENCION';

            triageFeed.push({
                id: `inc_${inc.id}`,
                sourceId: inc.id,
                sourceType: 'INCIDENT',
                category: inc.type === 'FALL' ? 'CLINICO_CRITICO' : (inc.type === 'ULCER' ? 'UPP_PIEL' : 'INCIDENTE'),
                title: `Incidente Reportado: ${inc.type}`,
                description: inc.description,
                patientId: inc.patientId || null,
                patientName: inc.patient?.name || 'N/A',
                urgency: urg,
                createdAt: inc.reportedAt,
            });
        });

        // Integrar Alertas Clínicas del Action Hub (DailyLog isClinicalAlert)
        clinicalAlerts.forEach((log: any) => {
            const isUPP = (log.notes || '').includes('[ALERTA UPP');
            triageFeed.push({
                id: `clinical_${log.id}`,
                sourceId: log.id,
                sourceType: 'CLINICAL_ALERT',
                category: isUPP ? 'UPP_PIEL' : 'CLINICO_CRITICO',
                title: isUPP ? 'Alerta UPP/Piel (Cuidador)' : 'Alerta Clínica (Cuidador)',
                description: log.notes || 'Alerta clínica sin descripción',
                patientId: log.patient?.id || null,
                patientName: log.patient?.name || 'N/A',
                urgency: isUPP ? 'ATENCION' : 'ATENCION',
                createdAt: log.createdAt,
            });
        });

        // Integrar Alertas SLA de UPP Activas
        pxWithUPP.forEach(px => {
            const lastLog = px.posturalChanges[0];
            if (lastLog) {
                const hrsSince = (Date.now() - new Date(lastLog.performedAt).getTime()) / 3600000;
                if (hrsSince >= 2.5) { // SLA Vulnerado
                    triageFeed.push({
                        id: `upp_sla_${px.id}`,
                        sourceId: px.id,
                        sourceType: 'UPP_SLA',
                        category: 'UPP_PIEL',
                        title: 'SLA Clínico Vencido (Rotación UPP)',
                        description: `El paciente presenta UPP activa y lleva ${hrsSince.toFixed(1)} hrs sin registro táctil de rotación (Límite 2hrs). Requiere giro manual urgente.`,
                        patientId: px.id,
                        patientName: px.name,
                        urgency: hrsSince > 4 ? 'INMINENTE' : 'ATENCION',
                        createdAt: new Date(),
                    });
                }
            }
        });

        // SPRINT 4: Zendi ATC Poli-Incidente (Clustering Geográfico/Multidimensional)
        const clusteredTriage: TriageTicket[] = [];
        const pxClusters: Record<string, TriageTicket[]> = {};
        
        triageFeed.forEach(t => {
            if (t.patientId) {
                if (!pxClusters[t.patientId]) pxClusters[t.patientId] = [];
                pxClusters[t.patientId].push(t);
            } else {
                clusteredTriage.push(t);
            }
        });

        Object.entries(pxClusters).forEach(([pId, tickets]) => {
            if (tickets.length > 1) { // Multi-incidente!
                const hasInminente = tickets.some(t => t.urgency === 'INMINENTE');
                const hasAtencion = tickets.some(t => t.urgency === 'ATENCION');
                const urg = hasInminente ? 'INMINENTE' : (hasAtencion ? 'ATENCION' : 'RUTINA');
                
                clusteredTriage.push({
                    id: `zendi_px_cluster_${pId}`,
                    sourceId: pId,
                    sourceType: 'ZENDI_PX_CLUSTER',
                    category: 'CLINICO_CRITICO',
                    title: `Alerta Multi-Vector Zendi (${tickets.length} Eventos)`,
                    description: `El residente ha acumulado vulnerabilidad en múltiples ejes concurrentes: ${tickets.map(t => t.category.replace('_', ' ')).join(', ')}. Sugiere intervención directiva.`,
                    patientId: pId,
                    patientName: tickets[0].patientName,
                    urgency: urg,
                    items: tickets,
                    createdAt: tickets[0].createdAt
                });
            } else {
                clusteredTriage.push(tickets[0]);
            }
        });

        // Sort y Agrupación Zendi
        const urgencyWeight = { 'INMINENTE': 3, 'ATENCION': 2, 'RUTINA': 1 };
        clusteredTriage.sort((a, b) => {
            const wA = urgencyWeight[a.urgency as keyof typeof urgencyWeight] || 0;
            const wB = urgencyWeight[b.urgency as keyof typeof urgencyWeight] || 0;
            if (wA !== wB) return wB - wA;
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });

        const finalTriage: TriageTicket[] = [];
        const maintItems: TriageTicket[] = [];
        clusteredTriage.forEach(t => {
            if (t.category === 'MANTENIMIENTO' && t.urgency === 'RUTINA') maintItems.push(t);
            else finalTriage.push(t);
        });

        if (maintItems.length > 0) {
            finalTriage.push({
                id: 'zendi_group_maint',
                sourceId: 'zendi_maint',
                sourceType: 'ZENDI_GROUP',
                category: 'MANTENIMIENTO',
                title: `Zendi agrupó ${maintItems.length} tickets operativos de fondo.`,
                description: `Infraestructura reportada por el piso (Focos, limpieza, fugas). No requieren acción clínica inmediata. Se pueden derivar a personal de Facilities.`,
                patientName: 'Edificio',
                urgency: 'RUTINA',
                items: maintItems,
                createdAt: maintItems[0].createdAt
            });
        }

        // Procesar Handovers Faltantes
        const handoverAuthors = todayHandovers.map(h => h.outgoingNurseId);
        const missingHandovers = endedSchedules
            .filter(sch => !handoverAuthors.includes(sch.employeeId))
            .map(sch => ({
                employeeName: sch.employee.name,
                endTime: sch.endTime.toISOString(),
                shiftType: sch.startTime.getHours() < 12 ? 'MORNING' : (sch.startTime.getHours() < 20 ? 'EVENING' : 'NIGHT')
            }));

        // ====================================================================
        // SPRINT K — PROCESAMIENTO POST-DB
        // ====================================================================

        // Parser robusto de scheduleTimes (JSON array o CSV "08:00, 14:00, 20:00")
        const parseScheduleTimes = (raw: string | null | undefined): number[] => {
            if (!raw) return [];
            try {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    return parsed.map((t: string) => {
                        const match = /(\d{1,2}):(\d{2})\s*(AM|PM)?/i.exec(t);
                        if (!match) return NaN;
                        let h = parseInt(match[1], 10);
                        const suf = (match[3] || '').toUpperCase();
                        if (suf === 'PM' && h !== 12) h += 12;
                        if (suf === 'AM' && h === 12) h = 0;
                        return h;
                    }).filter(n => !Number.isNaN(n));
                }
            } catch { /* cae a CSV */ }
            return raw.split(',').map(t => {
                const match = /(\d{1,2}):(\d{2})\s*(AM|PM)?/i.exec(t.trim());
                if (!match) return NaN;
                let h = parseInt(match[1], 10);
                const suf = (match[3] || '').toUpperCase();
                if (suf === 'PM' && h !== 12) h += 12;
                if (suf === 'AM' && h === 12) h = 0;
                return h;
            }).filter(n => !Number.isNaN(n));
        };

        const hourInShift = (h: number): boolean => {
            // NIGHT [22,30) abarca 22..29 ≡ 22..5. Para NIGHT probamos h y h+24.
            if (shiftTo <= 24) return h >= shiftFrom && h < shiftTo;
            return (h >= shiftFrom && h < 24) || (h + 24 >= shiftFrom && h + 24 < shiftTo);
        };

        // — Meds del turno actual —
        let medsShiftDenominator = 0;
        activeMedsForDenominator.forEach(pm => {
            if (pm.frequency === 'PRN') return;
            const hours = parseScheduleTimes(pm.scheduleTimes);
            medsShiftDenominator += hours.filter(hourInShift).length;
        });

        const parseHourFromSlot = (slot: string | null | undefined): number | null => {
            if (!slot) return null;
            const match = /(\d{1,2}):(\d{2})\s*(AM|PM)?/i.exec(slot);
            if (!match) return null;
            let h = parseInt(match[1], 10);
            const suf = (match[3] || '').toUpperCase();
            if (suf === 'PM' && h !== 12) h += 12;
            if (suf === 'AM' && h === 12) h = 0;
            return h;
        };

        const medsShiftCompleted = medsAdministeredToday.filter(ma => {
            if (ma.status !== 'ADMINISTERED') return false;
            const slotHour = parseHourFromSlot(ma.scheduleTime);
            if (slotHour === null && ma.scheduledTime) {
                const h = parseInt(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/Puerto_Rico' }).format(new Date(ma.scheduledTime)), 10) % 24;
                return hourInShift(h);
            }
            return slotHour !== null && hourInShift(slotHour);
        }).length;

        const medsShiftPct = medsShiftDenominator > 0
            ? Math.round((medsShiftCompleted / medsShiftDenominator) * 100)
            : null;

        // — Vitales agrupadas por cuidador —
        type VitalsBucket = { caregiverId: string | null; caregiverName: string; pending: number; completedOnTime: number; completedLate: number; expired: number };
        const vitalsByCaregiver: Record<string, VitalsBucket> = {};
        vitalsOrdersToday.forEach(v => {
            const key = v.caregiverId || '__UNASSIGNED__';
            if (!vitalsByCaregiver[key]) {
                vitalsByCaregiver[key] = {
                    caregiverId: v.caregiverId,
                    caregiverName: v.caregiver?.name || 'Sin asignar',
                    pending: 0, completedOnTime: 0, completedLate: 0, expired: 0,
                };
            }
            const b = vitalsByCaregiver[key];
            if (v.status === 'PENDING') b.pending++;
            else if (v.status === 'COMPLETED_ON_TIME') b.completedOnTime++;
            else if (v.status === 'COMPLETED_LATE') b.completedLate++;
            else if (v.status === 'EXPIRED') b.expired++;
        });

        const vitalsTotals = vitalsOrdersToday.reduce((acc, v) => {
            acc.total++;
            if (v.status === 'PENDING') acc.pending++;
            else if (v.status === 'EXPIRED') acc.expired++;
            else if (v.status === 'COMPLETED_ON_TIME' || v.status === 'COMPLETED_LATE') acc.completed++;
            return acc;
        }, { total: 0, pending: 0, completed: 0, expired: 0 });

        // — Team scores (cuidadores activos + complianceScore) —
        const teamScores = activeSessions
            .filter(s => s.caregiver)
            .map(s => ({
                caregiverId: s.caregiverId,
                name: s.caregiver!.name,
                role: s.caregiver!.role,
                complianceScore: (s.caregiver as any).complianceScore ?? null,
            }))
            .sort((a, b) => (a.complianceScore ?? 999) - (b.complianceScore ?? 999));

        // — Rondas del día: X/3 por turno actual (INICIO/MEDIO/CIERRE) —
        const roundsSummary = {
            inicio: todayZoneInspections.filter(r => r.roundType === 'INICIO').length,
            medio: todayZoneInspections.filter(r => r.roundType === 'MEDIO').length,
            cierre: todayZoneInspections.filter(r => r.roundType === 'CIERRE').length,
        };
        const roundsCompleted = (roundsSummary.inicio > 0 ? 1 : 0) + (roundsSummary.medio > 0 ? 1 : 0) + (roundsSummary.cierre > 0 ? 1 : 0);

        // — Observaciones vs apelaciones/warnings (split por severity) —
        const observationsFeed = activeIncidentReports
            .filter(ir => ir.severity === 'OBSERVATION')
            .map(ir => ({
                id: ir.id,
                createdAt: ir.createdAt,
                status: ir.status,
                category: ir.category,
                description: ir.description,
                pointsDeducted: ir.pointsDeducted,
                employeeId: ir.employeeId,
                employeeName: ir.employee?.name || 'Empleado',
                employeeRole: ir.employee?.role || '',
                supervisorName: ir.supervisor?.name || 'Supervisor',
                appealedAt: ir.appealedAt,
                respondedAt: ir.respondedAt,
            }));

        const incidentAppeals = activeIncidentReports
            .filter(ir => ir.severity !== 'OBSERVATION' && (ir.appealedAt || ir.status === 'EXPLANATION_RECEIVED'))
            .map(ir => ({
                id: ir.id,
                createdAt: ir.createdAt,
                status: ir.status,
                severity: ir.severity,
                category: ir.category,
                description: ir.description,
                appealText: ir.appealText,
                employeeName: ir.employee?.name || 'Empleado',
                appealedAt: ir.appealedAt,
            }));

        // — Handovers feed (individuales por cuidador, sin el prólogo del cron) —
        // Sprint L: cada fila es el reporte de una cuidadora con los colores que cubrió.
        // Estado derivado: PENDING_CONFIRMATION → CONFIRMED → SUPERVISOR_SIGNED.
        const handoversFeed = handoversTodayFull.map(h => {
            const derivedStatus: 'PENDING_CONFIRMATION' | 'CONFIRMED' | 'SUPERVISOR_SIGNED' =
                h.supervisorSignedAt ? 'SUPERVISOR_SIGNED'
                : h.seniorConfirmedAt ? 'CONFIRMED'
                : 'PENDING_CONFIRMATION';
            return {
                id: h.id,
                shiftType: h.shiftType,
                status: h.status,
                derivedStatus,
                createdAt: h.createdAt,
                signedOutAt: h.signedOutAt,
                seniorConfirmedAt: h.seniorConfirmedAt,
                supervisorSignedAt: h.supervisorSignedAt,
                handoverCompleted: h.handoverCompleted,
                outgoingName: h.outgoingNurse?.name || null,
                outgoingId: h.outgoingNurseId,
                incomingName: h.incomingNurse?.name || null,
                seniorName: h.seniorCaregiver?.name || null,
                supervisorName: h.supervisorSigned?.name || null,
                colorGroups: h.colorGroups || [],
                patientCount: h._count?.notes ?? 0,
                aiSummaryReport: h.aiSummaryReport || null,
            };
        });

        // — Vitales feed plano (para la tarjeta de "Vitales de Entrada") —
        const vitalsFeed = vitalsOrdersToday.map(v => ({
            id: v.id,
            patientId: v.patientId,
            patientName: v.patient?.name || 'Paciente',
            colorGroup: v.patient?.colorGroup || null,
            caregiverId: v.caregiverId,
            caregiverName: v.caregiver?.name || null,
            status: v.status,
            orderedAt: v.orderedAt,
            expiresAt: v.expiresAt,
            completedAt: v.completedAt,
            penaltyApplied: v.penaltyApplied,
        }));

        return NextResponse.json({
            success: true,
            activeCaregivers: activeSessions.length,
            liveStats: {
                baths: bathsToday,
                meals: mealsToday.reduce((acc, curr) => ({ ...acc, [curr.mealType]: curr._count.mealType }), {}),
                incidents: incidentsToday,
                triageInbox: pendingComplaintsList.length
            },
            activeSessions,
            missingHandovers,
            pendingComplaints: pendingComplaintsList,
            triageFeed: finalTriage,
            activeFastActions,
            fallIncidents, // Caídas reales últimas 24h (FallIncident, no Incident genérico)
            morningBriefing: briefing?.aiSummaryReport || null,
            lastBriefingAt: lastBriefingEver?.createdAt?.toISOString() || null,
            // ── Sprint K — Mission Control payload ──
            currentShift,
            vitalsFeed,
            vitalsByCaregiver: Object.values(vitalsByCaregiver),
            vitalsTotals,
            medsProgress: {
                shift: currentShift,
                completed: medsShiftCompleted,
                total: medsShiftDenominator,
                pct: medsShiftPct,
            },
            teamScores,
            handoversFeed,
            observationsFeed,
            incidentAppeals,
            roundsSummary: { ...roundsSummary, completedSlots: roundsCompleted, totalSlots: 3 },
        });

    } catch (error) {
        console.error("Live Supervisor Sync Error:", error);
        return NextResponse.json({ success: false, error: "Error obteniendo telemetría en vivo" }, { status: 500 });
    }
}
