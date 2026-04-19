import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { notifyRoles } from '@/lib/notifications';
import { todayStartAST } from '@/lib/dates';
import OpenAI from 'openai';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'dummy' });

/**
 * CRON — Inicio del día clínico (6:00 AM AST / 10:00 UTC)
 *
 * Dispara al cambiar el día clínico. Para cada sede activa:
 *   1. Compila actividad de las últimas 24h (el día clínico que termina)
 *      — incidentes, meds omitidos, vitales críticos, UPPs nuevas,
 *      hospitalizaciones y retornos.
 *   2. Genera un ShiftHandover con resumen IA (Zendi) para el turno MORNING.
 *   3. Notifica a CAREGIVER/NURSE/SUPERVISOR con type:'HANDOVER'.
 *
 * El cron nocturno de 5:45 AM (/api/ai/zendi/handovers/cron) se mantiene y
 * cubre solo la franja nocturna de 12h. Este cron complementa con el
 * prólogo de 24h al inicio del día clínico.
 */
export async function GET(req: Request) {
    // Protección CRON_SECRET
    const authHeader = req.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new Response('Unauthorized', { status: 401 });
    }

    try {
        // Ventana = día clínico que ACABA de terminar
        // todayStartAST() al ejecutarse el cron (6:00 AM AST) = 6:00 AM AST hoy
        // Restar 24h → 6:00 AM AST ayer
        const clinicalDayEnd = todayStartAST();
        const clinicalDayStart = new Date(clinicalDayEnd.getTime() - 24 * 60 * 60 * 1000);

        const fechaHoy = new Date().toLocaleDateString('es-PR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });

        const hqs = await prisma.headquarters.findMany({ where: { isActive: true } });
        const results: Array<{ hq: string; handoverId: string; notified: number }> = [];

        for (const hq of hqs) {
            // 1. Residentes de la sede
            const patients = await prisma.patient.findMany({
                where: { headquartersId: hq.id },
                select: { id: true, name: true, roomNumber: true, status: true, leaveType: true, leaveDate: true }
            });
            const patientIds = patients.map(p => p.id);

            // 2. Incidentes del día clínico anterior
            const incidents = await prisma.incident.findMany({
                where: {
                    patientId: { in: patientIds },
                    reportedAt: { gte: clinicalDayStart, lt: clinicalDayEnd }
                },
                include: { patient: { select: { name: true } } }
            });

            // 3. Meds omitidos/rechazados
            const omittedMeds = await prisma.medicationAdministration.findMany({
                where: {
                    patientMedication: { patientId: { in: patientIds } },
                    createdAt: { gte: clinicalDayStart, lt: clinicalDayEnd },
                    status: { in: ['MISSED', 'REFUSED', 'OMITTED'] }
                },
                include: {
                    patientMedication: {
                        include: {
                            medication: true,
                            patient: { select: { name: true } }
                        }
                    }
                }
            });

            // 4. Vitales críticos
            const criticalVitals = await prisma.vitalSigns.findMany({
                where: {
                    patientId: { in: patientIds },
                    createdAt: { gte: clinicalDayStart, lt: clinicalDayEnd },
                    OR: [
                        { temperature: { gt: 99.5 } },
                        { systolic: { gt: 140 } },
                        { systolic: { lt: 90 } },
                        { heartRate: { gt: 110 } },
                        { heartRate: { lt: 50 } },
                        { glucose: { gt: 200 } },
                        { glucose: { lt: 70 } }
                    ]
                },
                include: { patient: { select: { name: true } } }
            });

            // 5. UPPs nuevas (ACTIVE identificadas en la ventana)
            const newUPPs = await prisma.pressureUlcer.findMany({
                where: {
                    patientId: { in: patientIds },
                    status: 'ACTIVE',
                    identifiedAt: { gte: clinicalDayStart, lt: clinicalDayEnd }
                },
                include: { patient: { select: { name: true } } }
            });

            // 6. Residentes que salieron a hospital / regresaron
            const hospitalized = patients.filter(
                p => p.status === 'TEMPORARY_LEAVE' &&
                     p.leaveType === 'HOSPITAL' &&
                     p.leaveDate && p.leaveDate >= clinicalDayStart && p.leaveDate < clinicalDayEnd
            );

            const noEvents =
                incidents.length === 0 &&
                omittedMeds.length === 0 &&
                criticalVitals.length === 0 &&
                newUPPs.length === 0 &&
                hospitalized.length === 0;

            // 7. Armar prompt de Zendi
            let dataBlock = `CONTEXTO: Prólogo del día clínico para ${fechaHoy} — sede ${hq.name}.\nResumen del día clínico anterior (últimas 24h).\n\n`;

            if (noEvents) {
                dataBlock += `No se registraron incidentes, medicamentos omitidos, vitales críticos ni UPPs nuevas. Día clínico sin novedades.\n`;
            } else {
                if (incidents.length > 0) {
                    dataBlock += `INCIDENTES:\n${incidents.map(i => `- ${i.patient.name}: ${i.type} (${i.severity}) — ${i.description}`).join('\n')}\n\n`;
                }
                if (omittedMeds.length > 0) {
                    dataBlock += `MEDICAMENTOS OMITIDOS / RECHAZADOS:\n${omittedMeds.map(m => `- ${m.patientMedication.patient.name}: ${m.patientMedication.medication.name} (${m.status}) — ${m.notes || 'Sin nota'}`).join('\n')}\n\n`;
                }
                if (criticalVitals.length > 0) {
                    dataBlock += `VITALES CRÍTICOS:\n${criticalVitals.map(v => `- ${v.patient.name}: T ${v.temperature ?? 'N/A'} · PA ${v.systolic ?? '?'}/${v.diastolic ?? '?'} · FC ${v.heartRate ?? '?'} · Glu ${v.glucose ?? '?'}`).join('\n')}\n\n`;
                }
                if (newUPPs.length > 0) {
                    dataBlock += `UPPs NUEVAS:\n${newUPPs.map(u => `- ${u.patient.name}: Etapa ${u.stage} — ${u.bodyLocation}`).join('\n')}\n\n`;
                }
                if (hospitalized.length > 0) {
                    dataBlock += `HOSPITALIZACIONES:\n${hospitalized.map(p => `- ${p.name} (${p.roomNumber ?? 's/n'})`).join('\n')}\n\n`;
                }
            }

            const prompt = `
Eres Zendi AI. Generas el Prólogo del Día Clínico (6:00 AM AST) para ${fechaHoy}, sede ${hq.name}.
Tu audiencia: CAREGIVERS, ENFERMERAS y SUPERVISOR del turno de mañana que inician su día.
Resume el día clínico anterior COMPLETO (últimas 24h).

Incluye:
- Estado general de los residentes al iniciar el día
- Incidentes ocurridos y su severidad
- Medicamentos omitidos o rechazados que requieren seguimiento
- Vitales fuera de rango que necesitan revisión
- UPPs nuevas y residentes en hospital
- Prioridades y tareas pendientes para el turno de mañana

Tono: ejecutivo, directo, operacional. Formato markdown con viñetas claras.
Resalta en **negrita** nombres de pacientes y medicamentos críticos.
Si no hubo eventos relevantes, redacta un mensaje positivo y motivador en 2-3 líneas.
NO inventes datos. Usa solo la información proporcionada.

DATOS DEL DÍA CLÍNICO ANTERIOR:
${dataBlock}
`;

            let aiSummary = 'Prólogo no disponible.';
            try {
                const completion = await openai.chat.completions.create({
                    model: 'gpt-4o-mini',
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: 500,
                });
                aiSummary = completion.choices[0].message.content || aiSummary;
            } catch (e) {
                console.error('[clinical-day-start] OpenAI error:', e);
            }

            // 8. Firmante del handover — ADMIN/DIRECTOR → SUPERVISOR → null (Zendi)
            let systemUser = await prisma.user.findFirst({
                where: { headquartersId: hq.id, role: { in: ['ADMIN', 'DIRECTOR'] }, isActive: true }
            });
            if (!systemUser) {
                systemUser = await prisma.user.findFirst({
                    where: { headquartersId: hq.id, role: 'SUPERVISOR', isActive: true }
                });
            }

            const handover = await prisma.shiftHandover.create({
                data: {
                    headquartersId: hq.id,
                    shiftType: 'MORNING',
                    outgoingNurseId: systemUser?.id ?? null,
                    status: 'PENDING',
                    aiSummaryReport: aiSummary,
                    ...(patientIds.length > 0 ? {
                        notes: {
                            create: {
                                patientId: patientIds[0],
                                clinicalNotes: 'Prólogo del día clínico autogenerado por Zendi AI a las 6:00 AM AST.',
                                isCritical: !noEvents
                            }
                        }
                    } : {})
                }
            });

            // 9. Notificar a todo el equipo del turno mañana
            const notified = await notifyRoles(
                hq.id,
                ['CAREGIVER', 'NURSE', 'SUPERVISOR'],
                {
                    type: 'HANDOVER',
                    title: 'Nuevo día clínico — Prólogo Zendi',
                    message: 'El resumen del día está listo. Toca para leer el briefing de hoy.'
                }
            );

            results.push({ hq: hq.name, handoverId: handover.id, notified });
        }

        return NextResponse.json({
            success: true,
            processedSites: results.length,
            clinicalDayStart: clinicalDayStart.toISOString(),
            clinicalDayEnd: clinicalDayEnd.toISOString(),
            results
        });

    } catch (error: any) {
        console.error('[clinical-day-start] Cron error:', error);
        return NextResponse.json({ success: false, error: error.message || String(error) }, { status: 500 });
    }
}
