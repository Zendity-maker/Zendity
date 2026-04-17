import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { notifyRoles } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['CAREGIVER', 'NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN'];

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
        // ─── Validación de sesión + rol ───
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }

        const invokerId = (session.user as any).id;
        const invokerRole = (session.user as any).role;
        const invokerHqId = (session.user as any).headquartersId;

        if (!ALLOWED_ROLES.includes(invokerRole)) {
            return NextResponse.json({ success: false, error: 'Rol no autorizado para reportar incidentes' }, { status: 403 });
        }

        const body = await req.json();
        const {
            patientId, type, severity, description, photoUrl,
            // FALL-specific (nuevos, del form del cuidador)
            conscious, bleeding, painLevel, location,
        } = body;

        // hqId SIEMPRE de la sesión (ignoramos body.headquartersId)
        const hqId = invokerHqId;

        // ─── FLUJO FALL ───
        if (type === 'FALL') {
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

            // Notificar
            try {
                await notifyRoles(fallPatient.headquartersId, ['SUPERVISOR', 'NURSE', 'DIRECTOR'], {
                    type: 'TRIAGE',
                    title: `Caída reportada — ${derivedSeverity}`,
                    message: `${fallPatient.name} — ${interventions.substring(0, 120)}`,
                });
            } catch (e) { console.error('[notify TRIAGE fall]', e); }

            return NextResponse.json({
                success: true,
                incident,
                riskAssessment,
                derivedSeverity,
                derivedRiskLevel,
            });
        }

        // ─── FLUJO OTHER (mantenimiento) ───
        if (type === 'OTHER') {
            const event = await prisma.headquartersEvent.create({
                data: {
                    headquartersId: hqId,
                    title: `Reporte de Mantenimiento / Operación [Severidad: ${severity}]`,
                    description: `[Firmado por ${invokerId}] - ${description}`,
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
            } catch (e) { console.error('[notify TRIAGE incident]', e); }

            return NextResponse.json({ success: true, event });
        }

        return NextResponse.json({ success: false, error: "Invalid Incident Type" }, { status: 400 });

    } catch (error: any) {
        console.error("Care Incidents POST Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
