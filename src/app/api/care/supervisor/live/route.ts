import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

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
        const { searchParams } = new URL(req.url);
        const hqId = searchParams.get('hqId');

        if (!hqId) {
            return NextResponse.json({ success: false, error: "headquartersId is required" }, { status: 400 });
        }

        // FIX timezone: ventana rodante de 24h en vez de "medianoche UTC del servidor",
        // que deja el dashboard vacío cada noche cuando UTC cruza 00:00.
        const todayStart = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const twelveHrsAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
        const twentyFourHrsAgo = new Date(Date.now() - 24 * 3600000);

        // ============================================================================
        // FASE 2: OPTIMIZACIÓN DE LATENCIA MEDIANTE PROMISE.ALL CONCURRENTE
        // Enlaza 11 consultas bloqueantes en un solo ciclo de red (Edge-Readiness)
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
            clinicalAlerts
        ] = await Promise.all([
            // 1. Cuidadores Activos
            prisma.shiftSession.findMany({ where: { headquartersId: hqId, actualEndTime: null, startTime: { gte: todayStart } }, include: { caregiver: true } }),
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
            // 8. Zendi Morning Briefing
            prisma.shiftHandover.findFirst({ where: { headquartersId: hqId, shiftType: 'MORNING', createdAt: { gte: todayStart }, aiSummaryReport: { not: null } }, orderBy: { createdAt: 'desc' } }),
            // 9. Schedules para validar Handovers (Ultimas 12 hrs)
            prisma.shiftSchedule.findMany({ where: { headquartersId: hqId, endTime: { lt: new Date(), gte: twelveHrsAgo } }, include: { employee: true } }),
            // 10. Handovers enviados hoy
            prisma.shiftHandover.findMany({ where: { headquartersId: hqId, createdAt: { gte: twelveHrsAgo } }, select: { outgoingNurseId: true, shiftType: true } }),
            // 11. Fast Actions Activas
            prisma.fastActionAssignment.findMany({ where: { headquartersId: hqId, status: 'PENDING', expiresAt: { gt: new Date() } }, include: { caregiver: true }, orderBy: { createdAt: 'desc' } }),
            // 12. Alertas Clínicas del Action Hub (DailyLog con isClinicalAlert = true, últimas 24h)
            prisma.dailyLog.findMany({ where: { patient: { headquartersId: hqId }, isClinicalAlert: true, createdAt: { gte: twentyFourHrsAgo } }, include: { patient: { select: { id: true, name: true, colorGroup: true } }, author: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' }, take: 20 })
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
            morningBriefing: briefing?.aiSummaryReport || null
        });

    } catch (error) {
        console.error("Live Supervisor Sync Error:", error);
        return NextResponse.json({ success: false, error: "Error obteniendo telemetría en vivo" }, { status: 500 });
    }
}
