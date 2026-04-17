import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { notifyRoles } from '@/lib/notifications';



export async function POST(req: Request) {
    try {
        const { patientId, headquartersId, type, severity, description, biometricSignature, photoUrl } = await req.json();

        // Si es una caída (FALL), la procesamos con la lógica severa
        if (type === 'FALL') {
            const riskAssessment = await prisma.fallRiskAssessment.create({
                data: {
                    patientId,
                    evaluatorId: biometricSignature, // The caregiver ID
                    morseScore: 85, // Dummy default dictando Alto Riesgo
                    riskLevel: 'HIGH',
                    factors: "Asignación de Zendi Vision Pose-Detection (IoT Sentinel)",
                    nextReviewAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
                }
            });

            const incident = await prisma.fallIncident.create({
                data: {
                    patientId,
                    location: "Ubicación reportada vía Triage",
                    severity: 'SEVERE',
                    interventions: 'Activado Protocolo Emergencia Zendi',
                    notes: description
                }
            });

            // Auto-crear TriageTicket para caída
            const fallPatient = await prisma.patient.findUnique({ where: { id: patientId }, select: { headquartersId: true, name: true } });
            if (fallPatient) {
                await prisma.triageTicket.create({
                    data: {
                        headquartersId: fallPatient.headquartersId,
                        patientId,
                        originType: 'FALL',
                        originReferenceId: incident.id,
                        priority: 'CRITICAL',
                        status: 'OPEN',
                        description: `Caída reportada: ${description || 'Sin descripción'}`,
                    }
                });

                // Notificar a SUPERVISOR/NURSE/DIRECTOR de la sede
                try {
                    await notifyRoles(fallPatient.headquartersId, ['SUPERVISOR', 'NURSE', 'DIRECTOR'], {
                        type: 'TRIAGE',
                        title: 'Nuevo ticket de Triage',
                        message: `${fallPatient.name} — Caída reportada: ${(description || 'sin descripción').substring(0, 120)}`,
                    });
                } catch (e) { console.error('[notify TRIAGE fall]', e); }
            }

            return NextResponse.json({ success: true, incident, riskAssessment });
        }

        // FASE 32: Reportes No-Clínicos / Incidentes Generales u Operativos (Mantenimiento)
        if (type === 'OTHER') {
            // Utilizamos HeadquartersEvent para loggear situaciones del edificio o inventario referentes a un residente
            const event = await prisma.headquartersEvent.create({
                data: {
                    headquartersId,
                    title: `Reporte de Mantenimiento / Operación [Severidad: ${severity}]`,
                    description: `[Firmado por Cuidador ID: ${biometricSignature}] - ${description}`,
                    type: "INFRASTRUCTURE",
                    patientId: patientId || null,
                    startTime: new Date(),
                    endTime: new Date(Date.now() + 2 * 60 * 60 * 1000), // Default 2 hours resolve time ETA
                    photoUrl: photoUrl || null // FASE 37
                }
            });

            // Auto-crear TriageTicket para mantenimiento
            await prisma.triageTicket.create({
                data: {
                    headquartersId,
                    patientId: patientId || null,
                    originType: 'INCIDENT',
                    originReferenceId: event.id,
                    priority: 'MEDIUM',
                    status: 'OPEN',
                    description: `${event.title}: ${description}`,
                }
            });

            // Notificar a SUPERVISOR/NURSE/DIRECTOR
            try {
                let patientName = 'Residente';
                if (patientId) {
                    const p = await prisma.patient.findUnique({ where: { id: patientId }, select: { name: true } });
                    patientName = p?.name || patientName;
                } else {
                    patientName = 'Reporte operativo';
                }
                await notifyRoles(headquartersId, ['SUPERVISOR', 'NURSE', 'DIRECTOR'], {
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
