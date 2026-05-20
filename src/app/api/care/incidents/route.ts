import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { logError, logWarn } from '@/lib/logger';
import { notifyRoles } from '@/lib/notifications';
import { resolveEffectiveHqId } from '@/lib/hq-resolver';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['CAREGIVER', 'NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN'];

// ── Schemas Zod ──
const IncidentFallSchema = z.object({
    type:        z.literal('FALL'),
    patientId:   z.string().min(1, 'patientId requerido'),
    description: z.string().max(2000).optional().nullable(),
    photoUrl:    z.string().max(2_000_000).optional().nullable(),  // base64 / URL
    conscious:   z.boolean().optional(),
    bleeding:    z.boolean().optional(),
    painLevel:   z.coerce.number().int().min(0).max(10).optional(),
    location:    z.string().max(200).optional().nullable(),
    // severity llega del cliente pero la sobreescribimos con deriveSeverity
    severity:    z.string().optional(),
});

const IncidentOtherSchema = z.object({
    type:        z.literal('OTHER'),
    patientId:   z.string().min(1).optional().nullable(),
    description: z.string().min(1, 'descripción requerida').max(2000),
    photoUrl:    z.string().max(2_000_000).optional().nullable(),
    severity:    z.string().optional(),
});

const IncidentPostBody = z.discriminatedUnion('type', [IncidentFallSchema, IncidentOtherSchema]);

/**
 * Deriva IncidentSeverity a partir del nivel de dolor reportado.
 * SEVERE si dolor ≥ 7, MILD si 4-6, NONE si < 4.
 */
function deriveSeverity(painLevel: number | undefined): 'SEVERE' | 'MILD' | 'NONE' {
    if (typeof painLevel !== 'number') return 'MILD';
    if (painLevel >= 7) return 'SEVERE';
    if (painLevel >= 4) return 'MILD';
    return 'NONE';
}

/**
 * Deriva FallRiskLevel a partir de sangrado + dolor.
 */
function deriveRiskLevel(bleeding: boolean, painLevel: number | undefined): 'HIGH' | 'MODERATE' | 'LOW' {
    const p = typeof painLevel === 'number' ? painLevel : 0;
    if (bleeding || p >= 7) return 'HIGH';
    if (p >= 4) return 'MODERATE';
    return 'LOW';
}

export async function POST(req: Request) {
    try {
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;
        const { id: invokerId, headquartersId: invokerHqId } = auth;

        const rawBody = await req.json().catch(() => null);
        const parsed = IncidentPostBody.safeParse(rawBody);
        if (!parsed.success) {
            const first = parsed.error.issues[0];
            const path = first?.path?.join('.') || 'body';
            return NextResponse.json({
                success: false,
                error: `Datos inválidos en ${path}: ${first?.message || 'formato incorrecto'}`,
            }, { status: 400 });
        }
        // hqId SIEMPRE de la sesión (ignoramos body.headquartersId)
        const hqId = invokerHqId;

        // ─── FLUJO FALL ───
        if (parsed.data.type === 'FALL') {
            const { patientId, description, conscious, bleeding, painLevel, location } = parsed.data;
            // Tenant check: paciente debe ser de la sede del invocador
            const fallPatient = await prisma.patient.findFirst({
                where: { id: patientId, headquartersId: hqId },
                select: { id: true, headquartersId: true, name: true }
            });
            if (!fallPatient) {
                return NextResponse.json({ success: false, error: 'Residente no encontrado en tu sede' }, { status: 404 });
            }

            const derivedSeverity = deriveSeverity(painLevel);
            const derivedRiskLevel = deriveRiskLevel(!!bleeding, painLevel);

            // Interventions construido desde los checkboxes + painLevel
            const conscStr = typeof conscious === 'boolean' ? (conscious ? 'Sí' : 'No') : 'No especificado';
            const bleedStr = typeof bleeding === 'boolean' ? (bleeding ? 'Sí' : 'No') : 'No especificado';
            const painStr = typeof painLevel === 'number' ? `${painLevel}/10` : 'No especificado';
            const interventions = `Consciente: ${conscStr} · Sangrado: ${bleedStr} · Dolor: ${painStr}`;
            const finalLocation = (typeof location === 'string' && location.trim()) || 'Reportada vía tablet';

            // FallRiskAssessment — NO hardcodear morseScore
            const riskAssessment = await prisma.fallRiskAssessment.create({
                data: {
                    patientId,
                    evaluatorId: invokerId,
                    riskLevel: derivedRiskLevel as any,
                    factors: `Post-caída: ${interventions}`,
                    nextReviewAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                }
            });

            // FallIncident con datos reales del form
            const incident = await prisma.fallIncident.create({
                data: {
                    patientId,
                    location: finalLocation,
                    severity: derivedSeverity as any,
                    interventions,
                    notes: description || null,
                }
            });

            // Actualizar Patient.downtonRisk = true tras cualquier caída
            await prisma.patient.update({
                where: { id: patientId },
                data: { downtonRisk: true }
            });

            // Auto-crear TriageTicket CRITICAL
            await prisma.triageTicket.create({
                data: {
                    headquartersId: fallPatient.headquartersId,
                    patientId,
                    originType: 'FALL',
                    originReferenceId: incident.id,
                    priority: 'CRITICAL',
                    status: 'OPEN',
                    description: `Caída de ${fallPatient.name} (${derivedSeverity}): ${interventions}. ${description || ''}`.trim(),
                }
            });

            // Audit trail
            await logAudit({
                headquartersId: hqId, performedById: invokerId,
                action: 'INCIDENT_REPORTED', entityName: 'FallIncident',
                entityId: incident.id,
                resourceName: `Caída — ${fallPatient.name} (${derivedSeverity})`,
                request: req,
            });

            // Notificar
            try {
                await notifyRoles(fallPatient.headquartersId, ['SUPERVISOR', 'NURSE', 'DIRECTOR'], {
                    type: 'TRIAGE',
                    title: `Caída reportada — ${derivedSeverity}`,
                    message: `${fallPatient.name} — ${interventions.substring(0, 120)}`,
                });
            } catch (e) { logWarn('care.incidents.notify_fall', e, { patientId }); }

            return NextResponse.json({
                success: true,
                incident,
                riskAssessment,
                derivedSeverity,
                derivedRiskLevel,
            });
        }

        // ─── FLUJO OTHER (mantenimiento) ───
        if (parsed.data.type === 'OTHER') {
            const { patientId, description, photoUrl } = parsed.data;
            const event = await prisma.headquartersEvent.create({
                data: {
                    headquartersId: hqId,
                    title: description ? description.substring(0, 120) : `Reporte de mantenimiento`,
                    description: description || null,
                    type: "INFRASTRUCTURE",
                    patientId: patientId || null,
                    startTime: new Date(),
                    endTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
                    photoUrl: photoUrl || null,
                }
            });

            await prisma.triageTicket.create({
                data: {
                    headquartersId: hqId,
                    patientId: patientId || null,
                    originType: 'INCIDENT',
                    originReferenceId: event.id,
                    priority: 'MEDIUM',
                    status: 'OPEN',
                    description: `${event.title}: ${description}`,
                }
            });

            try {
                let patientName = 'Reporte operativo';
                if (patientId) {
                    const p = await prisma.patient.findFirst({
                        where: { id: patientId, headquartersId: hqId },
                        select: { name: true }
                    });
                    patientName = p?.name || patientName;
                }
                await notifyRoles(hqId, ['SUPERVISOR', 'NURSE', 'DIRECTOR'], {
                    type: 'TRIAGE',
                    title: 'Nuevo ticket de Triage',
                    message: `${patientName} — Mantenimiento: ${(description || 'sin descripción').substring(0, 120)}`,
                });
            } catch (e) { logWarn('care.incidents.notify_other', e, { patientId }); }

            return NextResponse.json({ success: true, event });
        }

        // ─── FLUJO MEDICATION_ERROR ───
        if ((parsed.data as any).type === 'MEDICATION_ERROR') {
            const d = parsed.data as any;
            const medPatient = await prisma.patient.findFirst({
                where: { id: d.patientId, headquartersId: hqId },
                select: { id: true, headquartersId: true, name: true }
            });
            if (!medPatient) {
                return NextResponse.json({ success: false, error: 'Residente no encontrado' }, { status: 404 });
            }

            await prisma.triageTicket.create({
                data: {
                    headquartersId: hqId,
                    patientId: d.patientId,
                    originType: 'INCIDENT',
                    priority: 'HIGH',
                    status: 'OPEN',
                    description: `Error de Medicación — ${medPatient.name}: ${d.description}`,
                }
            });

            await logAudit({
                headquartersId: hqId, performedById: invokerId,
                action: 'INCIDENT_REPORTED', entityName: 'TriageTicket',
                entityId: d.patientId,
                resourceName: `Error de Medicación — ${medPatient.name}`,
                request: req,
            });

            try {
                await notifyRoles(hqId, ['SUPERVISOR', 'NURSE', 'DIRECTOR'], {
                    type: 'TRIAGE',
                    title: '⚠️ Error de Medicación',
                    message: `${medPatient.name}: ${(d.description || '').substring(0, 120)}`,
                });
            } catch (e) { logWarn('care.incidents.notify_med_error', e, {}); }

            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ success: false, error: "Invalid Incident Type" }, { status: 400 });

    } catch (error: any) {
        logError('care.incidents.post', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

/**
 * GET /api/care/incidents?hqId=&hoursBack=&type=&page=
 *
 * Retorna FallIncidents de la sede + incidentes del TriageTicket
 * unificados en un array común para el dashboard y el relay de turno.
 */
export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const hqId = await resolveEffectiveHqId(session, searchParams.get('hqId'));
        const hoursBack = parseInt(searchParams.get('hoursBack') || '720', 10); // 30 días default
        const onlyFalls = searchParams.get('type') === 'FALL';
        const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

        // FallIncidents reales (el modelo más rico para caídas clínicas)
        const falls = await prisma.fallIncident.findMany({
            where: {
                patient: { headquartersId: hqId },
                incidentDate: { gte: since },
            },
            include: {
                patient: { select: { id: true, name: true, roomNumber: true } },
            },
            orderBy: { incidentDate: 'desc' },
            take: 200,
        });

        const fallsMapped = falls.map(f => ({
            id: f.id,
            type: 'FALL' as const,
            severity: f.severity,
            patientId: f.patient.id,
            patientName: f.patient.name,
            roomNumber: f.patient.roomNumber,
            description: f.notes || f.interventions,
            location: f.location,
            occurredAt: f.incidentDate,
            createdAt: f.reportedAt,
        }));

        if (onlyFalls) {
            return NextResponse.json({ success: true, incidents: fallsMapped });
        }

        // Triage tickets de tipo FALL/INCIDENT (incluye errores de med y otros)
        const tickets = await prisma.triageTicket.findMany({
            where: {
                headquartersId: hqId,
                originType: { in: ['FALL', 'INCIDENT'] },
                createdAt: { gte: since },
            },
            include: {
                patient: { select: { id: true, name: true, roomNumber: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 200,
        });

        const ticketsMapped = tickets
            .filter(t => !falls.find(f => f.id === t.originReferenceId)) // no duplicar caídas
            .map(t => ({
                id: t.id,
                type: t.originType as string,
                severity: t.priority === 'CRITICAL' ? 'SEVERE' : t.priority === 'HIGH' ? 'MILD' : 'NONE',
                patientId: t.patient?.id || null,
                patientName: t.patient?.name || 'Sin residente',
                roomNumber: t.patient?.roomNumber || null,
                description: t.description,
                location: null,
                occurredAt: t.createdAt,
                createdAt: t.createdAt,
                status: t.status,
            }));

        const combined = [...fallsMapped, ...ticketsMapped]
            .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());

        return NextResponse.json({ success: true, incidents: combined, total: combined.length });
    } catch (error: any) {
        logError('care.incidents.get', error);
        return NextResponse.json({ success: false, error: 'Failed to fetch incidents' }, { status: 500 });
    }
}
