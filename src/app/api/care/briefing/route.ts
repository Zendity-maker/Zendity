import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { todayStartAST } from '@/lib/dates';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';


export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        const hqId = session?.user?.headquartersId;
        const { colorGroup, userName } = await req.json();

        const todayStart = todayStartAST();
        const todayEnd = new Date(new Date().setHours(23, 59, 59, 999));

        // Sprint O — Multi-color. El tablet puede pasar 'RED' o 'RED,YELLOW'
        // (sustituto cubriendo varios grupos). Split + usar { in } en queries
        // y un OR en el filtro de eventos institucionales.
        const userColors = typeof colorGroup === 'string'
            ? colorGroup.split(',').map(c => c.trim()).filter(Boolean)
            : [];
        const primaryColor = userColors[0] || colorGroup;

        // 1. Residentes del color + alertas clínicas recientes +
        //    prólogo del día (cron 6am AST) + relevo del color anterior
        const [patients, hqEvents, dailyPrologueRow, colorHandoverRow] = await Promise.all([
            prisma.patient.findMany({
                where: {
                    ...(hqId ? { headquartersId: hqId } : {}),
                    colorGroup: userColors.length > 0 ? { in: userColors as any[] } : (colorGroup as any),
                    status: { in: ['ACTIVE', 'TEMPORARY_LEAVE'] },
                },
                include: {
                    vitalSigns: {
                        where: { createdAt: { gte: todayStart } },
                        orderBy: { createdAt: 'desc' },
                    },
                    dailyLogs: {
                        where: { createdAt: { gte: todayStart } },
                        orderBy: { createdAt: 'desc' },
                    },
                    healthAppointments: {
                        where: {
                            appointmentDate: { gte: todayStart, lt: todayEnd },
                        },
                    },
                },
            }),
            prisma.headquartersEvent.findMany({
                where: {
                    ...(hqId ? { headquartersId: hqId } : {}),
                    startTime: { gte: todayStart, lt: todayEnd },
                },
            }),
            // Prólogo del día (cron 6am AST) — solo si tenemos hqId autenticado
            hqId
                ? prisma.shiftHandover.findFirst({
                      where: {
                          headquartersId: hqId,
                          isDailyPrologue: true,
                          createdAt: { gte: todayStart },
                          aiSummaryReport: { not: null },
                      },
                      orderBy: { createdAt: 'desc' },
                      select: { id: true, aiSummaryReport: true, createdAt: true },
                  })
                : Promise.resolve(null),
            // Relevo del color anterior — último handover individual firmado
            hqId && primaryColor
                ? prisma.shiftHandover.findFirst({
                      where: {
                          headquartersId: hqId,
                          isDailyPrologue: false,
                          colorGroups: userColors.length > 0 ? { hasSome: userColors } : { has: primaryColor },
                          signature: { not: null },
                          createdAt: { gte: todayStart },
                      },
                      orderBy: { createdAt: 'desc' },
                      select: {
                          id: true,
                          aiSummaryReport: true,
                          createdAt: true,
                          shiftType: true,
                          outgoingNurse: { select: { name: true } },
                      },
                  })
                : Promise.resolve(null),
        ]);

        const firstName = userName ? userName.split(' ')[0] : 'compañero';
        let ttsMessage = `Buen día, ${firstName}. Bienvenido al Grupo ${colorGroup}. He revisado los expedientes de este turno y estoy lista para asistirte en los cuidados de hoy. `;

        const quickRead = { vitalsAlerts: 0, foodAlerts: 0, appointments: 0 };
        let hasIssues = false;

        patients.forEach(p => {
            const fever = p.vitalSigns.find(v => v.temperature > 99.5);
            if (fever) {
                ttsMessage += `Por favor, mantén en observación a ${p.name}, presentó una temperatura elevada de ${fever.temperature} grados recientemente. Sugiero aumentar su ingesta hídrica. `;
                quickRead.vitalsAlerts++;
                hasIssues = true;
            }

            const emptyFood = p.dailyLogs.find(l => l.foodIntake === 0);
            if (emptyFood) {
                ttsMessage += `Noté que ${p.name} tuvo una ingesta reducida en su última comida. Recomiendo ofrecer una alternativa o suplemento para asegurar su perfil nutricional. `;
                quickRead.foodAlerts++;
                hasIssues = true;
            }

            p.healthAppointments.forEach(app => {
                ttsMessage += `También te recuerdo que hay una ${app.type} programada para ${p.name} el día de hoy y debemos estar preparados. `;
                quickRead.appointments++;
                hasIssues = true;
            });
        });

        const assignedPatientIds = patients.map(p => p.id);
        const relevantEvents = hqEvents.filter(ev => {
            if (ev.targetPopulation === 'ALL') return true;
            // Multi-color: cualquiera de los colores del cuidador matchea targetGroups
            if (ev.targetPopulation === 'GROUP' && userColors.some(c => ev.targetGroups.includes(c))) return true;
            if (ev.targetPopulation === 'SPECIFIC' && ev.targetPatients.some(id => assignedPatientIds.includes(id))) return true;
            return false;
        });

        if (relevantEvents.length > 0) {
            hasIssues = true;
            const eventDescriptions = relevantEvents
                .map(e => `${e.title} a las ${new Date(e.startTime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`)
                .join(', ');
            ttsMessage += `Además, toma nota del calendario general: hoy tenemos ${eventDescriptions}. `;
        }

        if (!hasIssues) {
            ttsMessage += 'Los signos vitales de nuestros residentes se encuentran estables en este momento. Estoy a tu disposición cuando desees iniciar nuestro recorrido.';
        } else {
            ttsMessage += 'He enviado estas alertas a tu pantalla principal para fácil referencia. Cuando gustes, empezamos a atender estos frentes.';
        }

        // Formar el payload de prólogo y relevo del color
        const dailyPrologue = dailyPrologueRow
            ? {
                  id: dailyPrologueRow.id,
                  report: dailyPrologueRow.aiSummaryReport,
                  generatedAt: dailyPrologueRow.createdAt,
              }
            : null;

        const colorHandover = colorHandoverRow
            ? {
                  id: colorHandoverRow.id,
                  report: colorHandoverRow.aiSummaryReport,
                  fromCaregiver: colorHandoverRow.outgoingNurse?.name || 'Cuidador anterior',
                  closedAt: colorHandoverRow.createdAt,
                  shiftType: colorHandoverRow.shiftType,
              }
            : null;

        return NextResponse.json({
            success: true,
            briefing: { ttsMessage, quickRead, dailyPrologue, colorHandover },
        });

    } catch (error) {
        console.error('Briefing API Error:', error);
        return NextResponse.json({ success: false, error: 'Fallo compilando briefing' }, { status: 500 });
    }
}
