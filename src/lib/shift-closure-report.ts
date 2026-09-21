import OpenAI from 'openai';
import { prisma } from '@/lib/prisma';
import { compatibleShiftTypesAt } from '@/lib/shift-coverage';

/**
 * Lógica compartida entre:
 *  - POST /api/care/shift/preview  (vista previa para el wizard, sin commit)
 *  - POST /api/care/shift/end      (cierre real con commit transaccional)
 *
 * Toda la resolución de grupos de color, residentes, actividad clínica y el
 * reporte Zendi (GPT-4o-mini) vive aquí. Cambiar la lógica en un solo lugar.
 */

export type ShiftT = 'MORNING' | 'EVENING' | 'NIGHT' | 'FULL_DAY' | 'FULL_NIGHT';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || 'dummy',
    timeout: 45_000,
});

/**
 * Qué turno es la hora que se le pase. RESPALDO, no fuente principal.
 *
 * Sirve para decidir "qué turno corre AHORA". NO sirve para etiquetar un turno
 * ya trabajado: para eso está `resolverTurnoTrabajado`, abajo, y el porqué está
 * medido ahí.
 */
export function inferShiftType(date: Date): ShiftT {
    const hAst = (date.getUTCHours() - 4 + 24) % 24;
    if (hAst >= 6 && hAst < 14) return 'MORNING';
    if (hAst >= 14 && hAst < 22) return 'EVENING';
    return 'NIGHT';
}

/**
 * QUÉ TURNO SE TRABAJÓ — no a qué hora se firmó el cierre.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * EL FALLO QUE ESTO ARREGLA
 *
 * El cierre de turno etiquetaba el relevo con `inferShiftType(now)`, donde
 * `now` era el instante de FIRMAR. O sea: la etiqueta decía a qué hora se
 * cerró, no qué turno se trabajó. Y como cada turno se cierra justo en la
 * frontera del siguiente, casi siempre caía del lado equivocado.
 *
 * Medido sobre los 247 relevos firmados de 30 días (20-sep-2026), por la hora
 * AST real de la firma:
 *
 *   etiqueta NIGHT   → 38 se firmaron a las 22h  ·  36 a las 5h
 *   etiqueta EVENING → 55 se firmaron a las 14h  ·  43 a las 21h
 *   etiqueta MORNING → 28 se firmaron a las 13h  ·  22 a las 6h
 *
 * Léase: un turno de MAÑANA que cierra a las 14:00 quedaba etiquetado EVENING
 * —55 casos, el grupo más numeroso—. Uno de NOCHE que cierra a las 6:00
 * quedaba MORNING. Uno de TARDE que cierra a las 22:00 quedaba NIGHT.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * DE DÓNDE SE SACA AHORA, EN ORDEN
 *
 * 1. DEL HORARIO. `ScheduledShift.shiftType` es lo que la persona fue pautada
 *    a trabajar, que es la respuesta correcta por definición. Se miran el día
 *    del ponche y el ANTERIOR, porque un turno de noche empieza a las 22:00 de
 *    un día y termina a las 6:00 del siguiente.
 *    Entre varias pautas del mismo día se elige la que de verdad estaba
 *    corriendo a la hora del ponche, con `compatibleShiftTypesAt` — la regla D2
 *    que ya documenta src/lib/shift-coverage.ts: ventanas, nunca bucket único,
 *    porque una pauta FULL_NIGHT (18–06) no arranca a las 14:30.
 *
 * 2. DE LA HORA DE ENTRADA. Sin pauta —cobertura de última hora, alguien que
 *    ponchó sin estar en el horario— se infiere de cuándo ENTRÓ. No es exacto
 *    si ponchó tardísimo, pero es el turno que empezó a trabajar.
 *
 * 3. NUNCA de la hora de cierre. Ese era el fallo.
 *
 * Las pautas con `isAbsent` y las de tipo OFF quedan fuera: no son turnos
 * trabajados. Y SUPERVISOR_DAY tampoco se devuelve — no está en `ShiftT`, que
 * es el tipo que consume el reporte; si alguien tiene solo esa pauta se cae al
 * respaldo por hora de entrada.
 *
 * Esto NO reescribe el histórico: las filas ya guardadas conservan su etiqueta
 * vieja. Corrige de aquí en adelante.
 */
export async function resolverTurnoTrabajado(
    caregiverId: string,
    horaDeEntrada: Date,
): Promise<ShiftT> {
    const TIPOS_DE_RELEVO: ShiftT[] = ['MORNING', 'EVENING', 'NIGHT', 'FULL_DAY', 'FULL_NIGHT'];

    try {
        // El día del ponche y el anterior: la noche cruza la medianoche.
        const diaDelPonche = new Date(horaDeEntrada);
        diaDelPonche.setUTCHours(0, 0, 0, 0);
        const diaAnterior = new Date(diaDelPonche);
        diaAnterior.setUTCDate(diaAnterior.getUTCDate() - 1);
        const diaSiguiente = new Date(diaDelPonche);
        diaSiguiente.setUTCDate(diaSiguiente.getUTCDate() + 1);

        const pautas = await prisma.scheduledShift.findMany({
            where: {
                userId: caregiverId,
                date: { gte: diaAnterior, lt: diaSiguiente },
                isAbsent: false,
            },
            select: { shiftType: true, date: true },
            orderBy: { date: 'desc' },
            take: 10,
        });

        const utiles = pautas
            .map(p => p.shiftType as string)
            .filter((t): t is ShiftT => (TIPOS_DE_RELEVO as string[]).includes(t));

        if (utiles.length > 0) {
            const corriendoAhora = compatibleShiftTypesAt(horaDeEntrada);
            const calza = utiles.find(t => corriendoAhora.includes(t));
            if (calza) return calza;
            // Pautada pero ponchó fuera de su ventana. Su pauta sigue siendo
            // mejor respuesta que la hora: es el turno que le tocaba.
            return utiles[0];
        }
    } catch (e) {
        // Nunca romper un cierre de turno por no poder leer el horario.
        console.error('[resolverTurnoTrabajado] no se pudo leer el horario:', e);
    }

    return inferShiftType(horaDeEntrada);
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
            clinicalAlerts: [] as { patientName: string; notes: string; reportadoPor: string | null }[],
            rotations: 0,
        };
    }

    const [medsAdmin, medsOmit, mealCount, bathCount, vitalCount, falls, alerts, rotations] = await Promise.all([
        prisma.medicationAdministration.count({
            where: { administeredById: caregiverId, administeredAt: { gte: shiftStart }, status: 'ADMINISTERED' },
        }),
        /**
         * ESTA CONSULTA NO PODIA DEVOLVER NADA. NUNCA.
         *
         * Filtraba por `administeredAt >= shiftStart` sobre filas cuyo estado NO
         * es ADMINISTERED — y `meds/bulk` escribe exactamente eso:
         *
         *   administeredAt: adminStatus === 'ADMINISTERED' ? administeredAt : null
         *   (src/app/api/care/meds/bulk/route.ts:218)
         *
         * Un campo nulo no cumple `gte` jamas, y el schema no le pone default.
         * Resultado: TODOS los relevos firmados desde que existe este flujo
         * dicen, implicitamente, "no se omitio nada".
         *
         * Comprobado contra produccion el 11-sep-2026: de los ultimos 30 dias
         * hay 3 registros OMITTED y los 3 tienen administeredAt en NULL. Los
         * tres fueron invisibles para el turno que entraba.
         *
         * Se filtra por `createdAt`, que es cuando se registro la omision y
         * siempre tiene valor. Y se suma HELD, que es una retencion deliberada
         * de la cuidadora y le importa igual al que entra. MISSED queda fuera a
         * proposito: lo escribe el sistema cuando vence la ventana, sin
         * `administeredById`, asi que ni siquiera pasaria el filtro de autor.
         */
        prisma.medicationAdministration.findMany({
            where: {
                administeredById: caregiverId,
                createdAt: { gte: shiftStart },
                status: { in: ['OMITTED', 'REFUSED', 'HELD'] },
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
        /**
         * SIN filtrar por autor. Antes llevaba `authorId: caregiverId`, y esa
         * linea es la que hacia mentir al relevo.
         *
         * Medido el 09-sep-2026 sobre 858 relevos de 90 dias: 102 dijeron
         * "Sin novedades que requieran seguimiento" y 39 de esos eran falsos —
         * habia alerta o caida en el turno. En 32 de los 39 la alerta la habia
         * escrito OTRA persona, asi que Zendi nunca la vio.
         *
         * Entre ellos, cuatro relevos del 28-ago que dijeron "sin novedades"
         * el dia que un residente FALLECIO.
         *
         * El relevo no es un parte de lo que hizo la cuidadora: es lo que el
         * turno que entra necesita saber de ESTOS residentes. Una caida que
         * reporto una companera le importa igual a quien recibe. Por eso ahora
         * el criterio es el residente, no el autor — que es como ya funcionaba
         * la consulta de caidas, tres lineas mas arriba.
         *
         * Se trae el autor para que el resumen pueda decir quien lo reporto:
         * incluirlo sin decir de quien viene convertiria el relevo en algo que
         * ella firma sin haberlo visto.
         */
        prisma.dailyLog.findMany({
            where: {
                patientId: { in: patientIds },
                createdAt: { gte: shiftStart },
                isClinicalAlert: true,
            },
            include: {
                patient: { select: { name: true } },
                author: { select: { id: true, name: true } },
            },
            take: 15,
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
        clinicalAlerts: alerts.map(a => ({
            patientName: a.patient?.name || 'Desconocido',
            notes: a.notes || '(sin notas)',
            reportadoPor: a.author?.id === caregiverId ? null : (a.author?.name ?? null),
        })),
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
    /** Fecha del turno. Sin esto, GPT inventaba un encabezado "Fecha:" con un
     *  placeholder literal "[Fecha del turno]" que aparecía sin rellenar en el
     *  briefing del relevo. Pasarla explícita cierra ese bug. */
    shiftDate?: Date;
}): Promise<{ summary: string; source: 'gpt' | 'fallback' }> {
    const { caregiverName, shiftType, patients, activity, justifications, shiftDate } = params;

    // Fecha formateada en AST (es-PR). Si no se pasa, usamos hoy.
    const fechaStr = (shiftDate ?? new Date()).toLocaleDateString('es-PR', {
        timeZone: 'America/Puerto_Rico',
        day: '2-digit', month: 'long', year: 'numeric',
    });

    const shiftLabel =
        shiftType === 'MORNING'    ? 'Mañana (6am–2pm)'
        : shiftType === 'EVENING'    ? 'Tarde (2pm–10pm)'
        : shiftType === 'FULL_DAY'   ? 'Turno Largo Día (6am–6pm)'
        : shiftType === 'FULL_NIGHT' ? 'Turno Largo Noche (6pm–6am)'
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
        ? activity.clinicalAlerts.map(a =>
            `  · ${a.patientName}: ${a.notes}${a.reportadoPor ? ` (lo reportó ${a.reportadoPor})` : ''}`).join('\n')
        : '  · ninguno';

    const justLines = Object.keys(justifications).length > 0
        ? Object.entries(justifications).map(([id, r]) => `  · ${id}: ${r}`).join('\n')
        : '  · ninguna';

    // El relevo empieza por lo que hay que MIRAR, no por el recuento.
    //
    // El prompt anterior producia esto: "Se administraron un total de 63
    // medicamentos. Se registraron 13 comidas y se completaron 12 banos..."
    // seguido de la lista completa de residentes del grupo. Eso es un tally,
    // no un relevo: a quien entra al turno no le sirve saber que se dieron 63
    // medicamentos, le sirve saber a quien mirar. Y nombrarlos a todos no
    // senala a nadie.
    //
    // Media anterior: 1.274 caracteres. En una tablet, a las diez de la noche,
    // al cambio de turno. Un resumen que no se lee entero vale lo mismo que no
    // tenerlo, asi que se recorta a la mitad y los numeros van al final en una
    // sola linea.
    const prompt = `Eres Zendi. Escribe el relevo de turno de ${caregiverName}, en español, para la persona que ENTRA al turno.

Tu trabajo es que quien entra sepa A QUIÉN MIRAR. No es un informe de productividad.

ESTRUCTURA OBLIGATORIA, en este orden:

1. **Atención** — Solo residentes con algo que requiera seguimiento: una caída,
   una alerta clínica, un medicamento rehusado, un traslado, una úlcera, una
   tarea que quedó pendiente. Un residente por línea, con su nombre completo y
   QUÉ hay que vigilar. Si no hay ninguno, escribe "Sin novedades que requieran
   seguimiento." y pasa al punto 3.

2. **Pendiente del turno anterior** — Solo si hay justificaciones o tareas
   trasladadas. Una línea cada una.

REGLAS:
- MÁXIMO 500 caracteres en total. Es un relevo, no un informe.
- Solo los datos que te doy. No inventes nada.
- NO listes residentes sin novedad. Nombrar a todos no señala a nadie.
- NO abras con un párrafo de resumen general. Empieza directo por Atención.
- NO incluyas recuentos ni totales: ni medicamentos, ni comidas, ni baños, ni
  vitales, ni rotaciones. Esos numeros ya estan en el panel y en los reportes,
  y aqui solo entierran lo que importa.
- Nunca uses corchetes ni marcadores como [Fecha] o [Nombre].

DATOS:

${patientList}

Actividad del turno (CONTEXTO — no lo repitas como recuento; úsalo solo para
detectar si algo requiere seguimiento):
- Medicamentos administrados: ${activity.medsAdministered}
- Medicamentos omitidos/rehusados:
${omittedLines}
- Comidas registradas: ${activity.mealCount}
- Baños completados: ${activity.bathCount}
- Vitales tomados: ${activity.vitalCount}
- Rotaciones UPP (cambios posturales): ${activity.rotations}
- Caídas durante el turno:
${fallLines}
- Alertas clínicas de estos residentes durante el turno (las haya escrito quien
  las haya escrito; si la reportó otra persona, dilo — "lo reportó Fulana"):
${alertLines}
- Justificaciones del wizard (tareas pendientes/trasladadas):
${justLines}

Escribe el relevo ahora.`;

    try {
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            // 700 tokens daban de sobra para el informe largo de antes. El
            // relevo cabe en 500 caracteres; el tope evita que se alargue solo.
            max_tokens: 260,
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
