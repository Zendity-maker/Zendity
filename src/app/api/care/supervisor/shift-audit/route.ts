import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { aFahrenheit } from '@/lib/vitals-thresholds';
import { scheduledShiftDateRangeForShiftStart } from '@/lib/shift-closure-report';

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

        // ── Resolver grupos de color del cuidador ────────────────────────────
        //
        // LA VENTANA LA DA LA FUNCION COMPARTIDA. NO SE ESCRIBE AQUI.
        //
        // Antes esto era `new Date(shiftStart); setUTCHours(0,0,0,0)` + un dia.
        // `shiftStart` es un timestamp de TURNO, y ahi esta el error de tipo:
        // quien entra a las 22:00 AST son las 02:00 UTC del dia SIGUIENTE, asi
        // que esa linea pedia la pauta de MAÑANA. Simetrico por abajo: un ponche
        // de madrugada cae en el dia UTC de hoy cuando su dia clinico es el de
        // ayer. Falla 10 de las 24 horas —las AST >= 20 y las AST < 6—, que son
        // justo las de NIGHT. Y no da error: devuelve otro color con aplomo.
        //
        // MEDIDO contra produccion, 90 dias en Cupey (21-sep-2026), 793 sesiones:
        // 187 tenian el dia desfasado y en 138 de ellas el color resuelto era
        // DISTINTO del que le tocaba. Contra la pauta que de verdad cubre la hora
        // del ponche (ventana AST real del shiftType, 1.5 h de gracia), de 666
        // sesiones comprobables fallaban 95; con esta ventana fallan 4. Los 4 que
        // quedan son ponches de las 5 y pico con pauta en dos dias y colores
        // distintos: eso ya no lo decide una fecha, lo decide el tipo de turno.
        //
        // Lo que se veia en pantalla: el supervisor auditaba la guardia nocturna
        // contra los residentes de OTRA cuidadora — baño no registrado, vitales
        // no tomados— de gente que esa persona nunca tuvo asignada.
        //
        // La misma linea, con el mismo defecto dentro, estaba copiada en
        // src/lib/shift-closure-report.ts. Por eso la ventana vive alli y aqui
        // solo se llama: este fallo nacio precisamente de copiarla de un fichero
        // a otro. Si hay que tocarla, se toca una vez y alli.
        const { start: diaDeLaPauta, end: diaSiguiente } =
            scheduledShiftDateRangeForShiftStart(shiftStart);

        const scheduledShifts = await prisma.scheduledShift.findMany({
            where: { userId: caregiverId, date: { gte: diaDeLaPauta, lt: diaSiguiente } },
            include: { colorAssignments: true },
        });

        // De donde salio el color. Va en la respuesta porque "no se pudo
        // resolver" y "se resolvio y no hay residentes" se ven iguales en la
        // pantalla —ambos dan 0 brechas en verde— y no son lo mismo.
        let colorSource: 'assignments' | 'legacy' | 'unresolved' = 'assignments';
        let colorGroups: string[] = Array.from(new Set(
            scheduledShifts.flatMap(s => s.colorAssignments.map(a => a.color)).filter(Boolean)
        ));
        if (colorGroups.length === 0) {
            colorGroups = Array.from(new Set(
                scheduledShifts
                    .map(s => s.colorGroup)
                    .filter((c): c is string => !!c && c !== 'UNASSIGNED')
            ));
            colorSource = colorGroups.length > 0 ? 'legacy' : 'unresolved';
        }

        // AQUI HABIA UN FALLBACK AL ULTIMO COLOR QUE LA PERSONA TUVO ALGUNA VEZ.
        // Se quito. No se acoto: se quito, y conviene decir por que las dos cosas.
        //
        // Era `shiftColorAssignment.findFirst({ where: { userId }, orderBy:
        // { assignedAt: 'desc' } })`, sin ninguna cota de fecha. (No era fuga
        // multi-tenant: un usuario pertenece a una sola sede. El problema es
        // otro.)
        //
        // POR QUE NO ACOTARLO AL TURNO: seria codigo muerto. Toda
        // ShiftColorAssignment cuelga de una ScheduledShift — comprobado contra
        // produccion: de las 170 de Cupey, 0 tienen un userId distinto al de su
        // pauta. Asi que el conjunto "asignaciones de este usuario en esta
        // ventana" es EXACTAMENTE el que ya devuelve la consulta de arriba por
        // `include: { colorAssignments: true }`. Acotarlo es borrarlo escribiendo
        // mas lineas.
        //
        // POR QUE QUITARLO EN VEZ DE DEJARLO: porque mentia, y no de vez en
        // cuando. Medido sobre 90 dias en Cupey: de las 76 veces que disparo en
        // sesiones comprobables, dio el color EQUIVOCADO 46 — el 61%. Y 59 de
        // esos ponches eran de las 22:00 AST, o sea que el fallback existia
        // sobre todo para tapar el desfase de fecha que se acaba de arreglar.
        // Ya arreglada la ventana solo quedarian 69 disparos, y en 67 de ellos
        // NO hay ninguna pauta que cubra la hora: no es que el dato estuviera
        // mal buscado, es que no existe.
        //
        // Lo que servia en esos casos era un color viejo: mediana de 7 dias de
        // antiguedad, 27 de 66 por encima de una semana, hasta 41 dias. Y siete
        // servian un color del FUTURO —`assignedAt` POSTERIOR al turno, uno de
        // ellos 69 dias despues—, o sea auditaban un turno de junio con un color
        // decidido en agosto.
        //
        // Una lista vacia dice "no se pudo resolver". Un color viejo dice algo
        // falso con aplomo, y encima invita al supervisor a firmar la auditoria
        // de una cuidadora contra residentes que no eran suyos. Preferimos el
        // hueco visible.

        // ── Residentes del grupo ─────────────────────────────────────────────
        const patients = colorGroups.length === 0 ? [] : await prisma.patient.findMany({
            where: {
                headquartersId: hqId,
                status: { in: ['ACTIVE', 'TEMPORARY_LEAVE'] as any[] },
                ...(colorGroups.includes('ALL') ? {} : { colorGroup: { in: colorGroups as any[] } }),
            },
            select: {
                id: true, name: true, colorGroup: true, roomNumber: true,
                // status + leaveType para excluir de brechas a quien está fuera
                // del hogar (HOSPITAL, DIALYSIS, OTHER). Un residente en hospital
                // no puede tener "baño no registrado" — no está en la sede.
                status: true, leaveType: true,
                pressureUlcers: { where: { status: 'ACTIVE' }, select: { id: true }, take: 1 }
            },
            orderBy: { roomNumber: 'asc' }
        });

        const patientIds = patients.map(p => p.id);

        if (patientIds.length === 0) {
            return NextResponse.json({
                success: true,
                audit: buildEmptyAudit({
                    shiftSessionId: shiftSession.id,
                    caregiverId,
                    caregiverName,
                    shiftType,
                    shiftStart,
                    shiftEnd: shiftSession.actualEndTime,
                    isOpen: !shiftSession.actualEndTime,
                    colorGroups,
                    colorSource,
                }),
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
            //
            // MISMO FALLO QUE EN shift-closure-report.ts, en el segundo sitio:
            // filtraba por `administeredAt` sobre filas cuyo estado NO es
            // ADMINISTERED, y meds/bulk escribe null en ese campo justo
            // entonces (meds/bulk/route.ts:218). La consulta no podia devolver
            // nada, asi que la auditoria de turno del supervisor tambien decia
            // siempre "cero omisiones".
            //
            // Se filtra por `createdAt`, que es cuando se registro la omision.
            // Y se selecciona tambien, porque `administeredAt` viene nulo en
            // estas filas y la pantalla necesita una hora que enseñar.
            prisma.medicationAdministration.findMany({
                where: {
                    administeredById: caregiverId,
                    createdAt: { gte: shiftStart, lte: shiftEnd },
                    status: { in: ['OMITTED', 'REFUSED', 'HELD'] },
                    patientMedication: { patientId: { in: patientIds } }
                },
                select: {
                    createdAt: true,
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
                select: { patientId: true, createdAt: true, occurredAt: true, content: true },
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
                select: { patientId: true, createdAt: true, occurredAt: true, content: true },
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
                    // `administeredAt` viene NULO en una omision — eso es lo que
                    // hacia imposible la consulta de arriba. Aqui el `?? new Date()`
                    // ponia la hora de AHORA en la linea de tiempo del turno, o
                    // sea que una omision de las 8am habria aparecido a la hora
                    // de mirar la auditoria. `createdAt` es cuando se registro.
                    time: m.administeredAt ?? m.createdAt,
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
                if (v.temperature) parts.push(`T° ${aFahrenheit(v.temperature)}°F`);
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
                    // La hora real si la declaro; si no, la del tecleo.
                    time: d.occurredAt ?? d.createdAt,
                    type: 'DIAPER_NIGHT',
                    label: '🌙 Control de pañal nocturno',
                    detail: parseDiaperType(d.content),
                    severity: 'ok'
                });
            });

            // Pañal diurno
            dayDiapers.filter(d => d.patientId === pid).forEach(d => {
                entries.push({
                    // La hora real si la declaro; si no, la del tecleo.
                    time: d.occurredAt ?? d.createdAt,
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

            // Residentes fuera del hogar (HOSPITAL/DIALYSIS/OTHER) NO generan
            // brechas: no están físicamente en la sede para recibir cuidados.
            // Se muestra solo un badge informativo y se omite toda evaluación.
            const isAway = (patient as any).status === 'TEMPORARY_LEAVE';
            const leaveType = (patient as any).leaveType as string | null;

            if (isAway) {
                // No agregamos a gaps — el residente no está disponible.
                // El frontend muestra el badge "🏥 Hospital" / "🩺 Diálisis" según leaveType.
            } else {
                // Sin atención en todo el turno
                if (entries.length === 0) {
                    gaps.push({ label: 'Sin actividad registrada en este turno', severity: 'critical' });
                }

                // Sin baño — SOLO turno AM (la ventana de baño cierra a las 10am,
                // ningún otro turno tiene baño obligatorio en el protocolo).
                if (shiftType === 'MORNING' && baths.filter(b => b.patientId === pid).length === 0) {
                    gaps.push({ label: 'Baño no registrado (ventana AM hasta 10am)', severity: 'warn' });
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
            }

            return {
                id: patient.id,
                name: patient.name,
                room: patient.roomNumber || '—',
                colorGroup: patient.colorGroup,
                hasActiveUPP,
                // Estado físico: si está fuera del hogar el frontend muestra
                // un badge informativo y no espera brechas.
                isAway,
                leaveType: isAway ? leaveType : null,
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
                colorSource,
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
                    incomingName: handover.incomingNurse?.name || null,
                    colorGroups: handover.colorGroups,
                } : null,
            }
        });

    } catch (err: any) {
        console.error('[shift-audit]', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

/**
 * El turno sin residentes que auditar.
 *
 * Se llamaba con `shiftSession` entero y hacia `...params`, asi que la
 * respuesta vacia salia con OTRA forma que la normal: metia el objeto
 * `shiftSession` completo y le faltaban `shiftSessionId` e `isOpen`, los dos
 * declarados como obligatorios en la pantalla que la consume
 * (`src/app/care/supervisor/audit/page.tsx`). Pasaba desapercibido porque casi
 * nunca se llegaba aqui: el fallback al ultimo color de siempre inventaba un
 * grupo y la respuesta se iba por el camino normal. Al quitarlo, este es el
 * camino honesto y tiene que devolver la misma forma.
 *
 * `colorSource: 'unresolved'` es la diferencia que importa: un turno del que no
 * se pudo resolver el grupo se ve hoy en pantalla igual que uno impecable
 * —0 brechas, 0 sin actividad, todo en verde—. No es lo mismo "no hubo nada que
 * señalar" que "no sabemos a quien cuidaba". Ver la nota al final del fichero.
 */
function buildEmptyAudit(params: {
    shiftSessionId: string;
    caregiverId: string;
    caregiverName: string | null;
    shiftType: string;
    shiftStart: Date;
    shiftEnd: Date | null;
    isOpen: boolean;
    colorGroups: string[];
    colorSource: 'assignments' | 'legacy' | 'unresolved';
}) {
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

/*
 * ─────────────────────────────────────────────────────────────────────────────
 * PENDIENTE EN LA PANTALLA, NO AQUI — `colorSource: 'unresolved'`
 *
 * Esta ruta ya distingue los tres casos. La pantalla todavia no:
 * `src/app/care/supervisor/audit/page.tsx` pinta los mismos ceros en verde
 * —"Brechas 0 ✅", "Sin actividad 0 ✅", "Detalle por residente (0)"— tanto si
 * el turno fue impecable como si no se pudo resolver a quien cuidaba.
 *
 * Es el olor que CLAUDE.md describe: una metrica que sale redonda siempre no es
 * una metrica buena. Con 'unresolved' la tarjeta deberia decir que no hay a
 * quien auditar, no felicitar a nadie. Medido el 21-sep-2026 sobre las 793
 * sesiones de 90 dias en Cupey: 69 caen ahi (139 resuelven por asignacion, 585
 * por colorGroup de la pauta). De esas 69, en 67 no hay NINGUNA pauta que
 * cubra la hora del ponche — no es un dato mal buscado, es un dato que no existe.
 *
 * No se toca el fichero de la pantalla desde aqui a proposito.
 * ─────────────────────────────────────────────────────────────────────────────
 */
