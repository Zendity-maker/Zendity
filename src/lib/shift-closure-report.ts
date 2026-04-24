import OpenAI from 'openai';
import { prisma } from '@/lib/prisma';

/**
 * Lógica compartida entre:
 *  - POST /api/care/shift/preview  (vista previa para el wizard, sin commit)
 *  - POST /api/care/shift/end      (cierre real con commit transaccional)
 *
 * Toda la resolución de grupos de color, residentes, actividad clínica y el
 * reporte Zendi (GPT-4o-mini) vive aquí. Cambiar la lógica en un solo lugar.
 */

export type ShiftT = 'MORNING' | 'EVENING' | 'NIGHT';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || 'dummy',
    timeout: 45_000,
});

export function inferShiftType(date: Date): ShiftT {
    const hAst = (date.getUTCHours() - 4 + 24) % 24;
    if (hAst >= 6 && hAst < 14) return 'MORNING';
    if (hAst >= 14 && hAst < 22) return 'EVENING';
    return 'NIGHT';
}

export async function resolveColorGroupsForCaregiver(
    caregiverId: string,
    hqId: string,
    shiftStart: Date,
): Promise<string[]> {
    const todayStart = new Date(shiftStart);
    todayStart.setUTCHours(0, 0, 0, 0);
    const tomorrow = new Date(todayStart);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    const scheduledShifts = await prisma.scheduledShift.findMany({
        where: { userId: caregiverId, date: { gte: todayStart, lt: tomorrow } },
        include: { colorAssignments: true },
    });

    const fromAssignments = scheduledShifts
        .flatMap(s => s.colorAssignments.map(a => a.color))
        .filter(Boolean);
    if (fromAssignments.length > 0) return Array.from(new Set(fromAssignments));

    const fromLegacy = scheduledShifts
        .map(s => s.colorGroup)
        .filter((c): c is string => !!c && c !== 'UNASSIGNED');
    if (fromLegacy.length > 0) return Array.from(new Set(fromLegacy));

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

export async function resolvePatientsByColors(
    colorGroups: string[],
    hqId: string,
) {
    if (colorGroups.length === 0) return [];

    // colorGroup 'ALL' significa que la cuidadora está asignada a todos los
    // residentes del turno — no filtrar por colorGroup en ese caso.
    if (colorGroups.includes('ALL')) {
        return prisma.patient.findMany({
            where: {
                headquartersId: hqId,
                status: { in: ['ACTIVE', 'TEMPORARY_LEAVE'] as any[] },
            },
            select: { id: true, name: true, colorGroup: true, roomNumber: true },
            orderBy: { name: 'asc' },
        });
    }

    return prisma.patient.findMany({
        where: {
            headquartersId: hqId,
            status: { in: ['ACTIVE', 'TEMPORARY_LEAVE'] as any[] },
            colorGroup: { in: colorGroups as any[] },
        },
        select: { id: true, name: true, colorGroup: true, roomNumber: true },
        orderBy: { name: 'asc' },
    });
}

export async function collectShiftActivity(params: {
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
            where: { administeredById: caregiverId, administeredAt: { gte: shiftStart }, status: 'ADMINISTERED' },
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

export type ShiftActivity = Awaited<ReturnType<typeof collectShiftActivity>>;
export type ShiftPatient = { id: string; name: string; colorGroup: string; roomNumber: string | null };

export async function buildZendiSummary(params: {
    caregiverName: string;
    shiftType: ShiftT;
    patients: { name: string; colorGroup: string; roomNumber: string | null }[];
    activity: ShiftActivity;
    justifications: Record<string, string>;
}): Promise<{ summary: string; source: 'gpt' | 'fallback' }> {
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

    const prompt = `Eres Zendi, el asistente de Zéndity. Genera el reporte de cierre de turno para ${caregiverName} en español profesional y claro. REGLAS ESTRICTAS: (1) Usa SOLO los datos que te doy — NO inventes nada. (2) Menciona a cada residente por su nombre completo y qué se hizo específicamente con él/ella. (3) NO uses frases genéricas como "se atendió a los residentes" — sé concreto/a. (4) Si no hubo actividad registrada para un residente, no lo menciones. (5) Máximo 4 párrafos. (6) Si hay situaciones que requieren atención del supervisor, resáltalas al final en un párrafo separado.

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
        if (text && text.length > 40) {
            console.log(`[shift-closure-report] source=gpt-4o-mini len=${text.length} caregiver=${caregiverName}`);
            return { summary: text, source: 'gpt' };
        }
        console.warn(`[shift-closure-report] GPT respuesta corta (${text?.length ?? 0} chars), fallback`);
    } catch (e) {
        console.error('[shift-closure-report] OpenAI error:', e);
    }

    console.warn(`[shift-closure-report] source=fallback caregiver=${caregiverName}`);
    const fallback = `Reporte de cierre — ${caregiverName} · ${shiftLabel}

Residentes a cargo (${patients.length}): ${patients.map(p => p.name).join(', ') || 'sin asignación por color'}.

Actividad registrada: ${activity.medsAdministered} meds administrados, ${activity.medsOmitted.length} omitidos/rehusados, ${activity.mealCount} comidas, ${activity.bathCount} baños, ${activity.vitalCount} vitales, ${activity.rotations} rotaciones UPP.

Incidencias: ${activity.falls.length} caídas, ${activity.clinicalAlerts.length} alertas clínicas. ${Object.keys(justifications).length > 0 ? `${Object.keys(justifications).length} tareas con justificación pendiente.` : ''}

(Resumen generado sin IA por fallo de servicio; revisar detalle en notas.)`;
    return { summary: fallback, source: 'fallback' };
}
