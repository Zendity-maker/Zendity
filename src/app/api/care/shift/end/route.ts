import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/api-auth';
import { logError } from '@/lib/logger';
import { SystemAuditAction } from '@prisma/client';
import { todayStartAST } from '@/lib/dates';
import {
    inferShiftType,
    resolverTurnoTrabajado,
    resolveColorGroupsForCaregiver,
    resolvePatientsByColors,
    collectShiftActivity,
    buildZendiSummary,
} from '@/lib/shift-closure-report';
import { aplicarRespuestasDeCierre, ventanaDeDosisDelTurno } from '@/lib/dosis-sin-resolver';
import { etiquetaOmision, estadoParaOmision } from '@/lib/omision-medicamento';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const SUPERVISOR_ROLES = ['SUPERVISOR', 'DIRECTOR', 'ADMIN', 'SUPER_ADMIN'];

/**
 * Sprint L — Cierre de turno con reporte INDIVIDUAL por cuidador.
 *
 * Flujo 1 (Wizard — el cuidador mismo cierra):
 *   1. El wizard YA mostró al cuidador el reporte vía /api/care/shift/preview.
 *      Si handoverData.aiSummaryReport viene → respetamos ese texto literal
 *      (lo que el cuidador firmó === lo que se guarda).
 *   2. Si no viene (cierre legado sin preview), regeneramos con GPT-4o-mini.
 *   3. Crear ShiftHandover + HandoverNotes + actualizar ShiftSession.
 *
 * Flujo 2 (forceEnd por supervisor):
 *   - Crea ShiftHandover "vacío" con nota de cierre forzado.
 *   - Log SystemAuditAction.SYSTEM_ABANDONED.
 */

export async function POST(req: Request) {
    try {
        const auth = await requireSession();
        if (auth instanceof NextResponse) return auth;
        const { id: invokerId, role: invokerRole, headquartersId: invokerHqId } = auth;
        const invokerName = auth.name || 'Supervisor';

        const { shiftSessionId, handoverData, signature, forceEnd } = await req.json();

        if (!shiftSessionId) {
            return NextResponse.json({ success: false, error: "shiftSessionId requerido" }, { status: 400 });
        }

        const session = await prisma.shiftSession.findUnique({
            where: { id: shiftSessionId },
            include: { caregiver: true },
        });

        if (!session) {
            return NextResponse.json({ success: false, error: "Turno no encontrado" }, { status: 404 });
        }

        const isOwner = session.caregiverId === invokerId;
        const isSupervisor = SUPERVISOR_ROLES.includes(invokerRole) && session.headquartersId === invokerHqId;
        if (!isOwner && !isSupervisor) {
            return NextResponse.json({ success: false, error: "No tienes permiso para cerrar este turno" }, { status: 403 });
        }

        const now = new Date();

        /**
         * UN CIERRE FORZADO NO PUEDE TIRAR A LA BASURA LO QUE ELLA YA CONTESTÓ.
         *
         * El camino de antes era un 400 seco: "Este turno ya fue finalizado".
         * Escenario real —11 cierres forzados en 30 días—: la cuidadora
         * responde los avisos de medicamentos, el supervisor le fuerza el
         * cierre mientras ella firma, y su POST se estrella. Sus respuestas
         * desaparecen, y con ellas la única constancia de que se le preguntó.
         * Lo que la función existe para recoger, perdido por un estado que
         * ella no controla.
         *
         * Ahora, si es la dueña del turno y trae respuestas de dosis, se
         * aplican igual: "cierre tardío". Es seguro porque la escritura ya es
         * idempotente y está acotada —solo toca filas PENDING/MISSED, solo
         * dentro de la ventana de SU turno, y solo de SUS residentes— así que
         * lo que el supervisor o cualquier otro ya hubiera resuelto cuenta
         * como `yaResueltas` y no se pisa.
         *
         * El relevo NO se vuelve a crear: se cuelga del que ya existe.
         */
        if (session.actualEndTime && !forceEnd) {
            const jTardias = (handoverData?.justifications ?? {}) as Record<string, string>;
            const traeDosis = Object.keys(jTardias).some(k => k.startsWith('meds:'));

            if (isOwner && traeDosis) {
                const tipoTardio = await resolverTurnoTrabajado(session.caregiverId, session.startTime);
                const coloresTardios = await resolveColorGroupsForCaregiver(
                    session.caregiverId, session.headquartersId, session.startTime,
                );
                const pacientesTardios = await resolvePatientsByColors(
                    coloresTardios, session.headquartersId,
                );
                const ventanaTardia = ventanaDeDosisDelTurno({
                    ponche: session.startTime,
                    tipoDeTurno: tipoTardio,
                    ahora: now,
                    cierre: session.actualEndTime,
                });
                const dosisTardias = await prisma.$transaction(async (tx) => aplicarRespuestasDeCierre(tx as any, {
                    justifications: jTardias,
                    patientIds: pacientesTardios.map(p => p.id),
                    desde: ventanaTardia.desde,
                    hasta: ventanaTardia.hasta,
                    caregiverId: session.caregiverId,
                    caregiverName: session.caregiver?.name || 'Cuidador(a)',
                    headquartersId: session.headquartersId,
                    // El relevo que ya existe, si lo hay. Sin él la auditoría
                    // sigue escribiéndose: lo que no puede es inventarse uno.
                    shiftHandoverId: session.shiftHandoverId || '',
                    // La firma del relevo no está disponible en este camino: el
                    // relevo lo cerró otra persona. Se guarda sin firma antes
                    // que perder la respuesta, y la auditoría dice por dónde
                    // entró.
                    firma: signature || '',
                    ahora: now,
                    etiquetaDeMotivo: etiquetaOmision,
                    estadoDeMotivo: estadoParaOmision,
                }));
                console.log(`[shift/end] cierre tardio — respuestas de ${session.caregiver?.name}`
                    + ` aplicadas sobre un turno ya cerrado: ${JSON.stringify(dosisTardias)}`);
                return NextResponse.json({
                    success: true,
                    cierreTardio: true,
                    dosisResueltas: dosisTardias,
                    message: 'Tu turno ya lo había cerrado un supervisor, pero lo que contestaste'
                        + ' sobre los medicamentos sí quedó guardado.',
                });
            }

            return NextResponse.json({ success: false, error: "Este turno ya fue finalizado" }, { status: 400 });
        }
        // El turno se etiqueta por lo que se TRABAJÓ, no por la hora de firmar.
        // Antes era `inferShiftType(now)` con `now` = instante del cierre, y como
        // cada turno se cierra en la frontera del siguiente, la etiqueta casi
        // siempre caía del lado equivocado: medido en 30 días, 55 turnos de
        // mañana que cerraron a las 14:00 quedaron etiquetados EVENING.
        // `session.startTime` es cuándo ponchó; el resolutor prefiere su pauta
        // del horario y solo cae a la hora de entrada si no hay pauta.
        const shiftTypeDraft = await resolverTurnoTrabajado(session.caregiverId, session.startTime);
        const shiftStart = session.startTime < todayStartAST() ? todayStartAST() : session.startTime;

        // ──────────────────────────────────────────────────────────────────
        // FLUJO 1 — Cierre con Wizard
        // ──────────────────────────────────────────────────────────────────
        if (handoverData && signature && !forceEnd) {
            const colorGroups = await resolveColorGroupsForCaregiver(session.caregiverId, session.headquartersId, shiftStart);
            const patients = await resolvePatientsByColors(colorGroups, session.headquartersId);
            const activity = await collectShiftActivity({
                caregiverId: session.caregiverId,
                patientIds: patients.map(p => p.id),
                shiftStart,
            });

            // Si el wizard ya mostró al cuidador un reporte pre-generado y lo
            // confirmó, usamos ese texto literal. Esto garantiza que lo que
            // firmó === lo que se guarda.
            const justifications = (handoverData.justifications ?? {}) as Record<string, string>;
            const previewedReport: string | undefined = handoverData.aiSummaryReport;
            let zendiSummary: string;
            if (typeof previewedReport === 'string' && previewedReport.trim().length > 40) {
                zendiSummary = previewedReport.trim();
                console.log(`[shift/end] usando reporte pre-generado del wizard (len=${zendiSummary.length}) caregiver=${session.caregiver?.name}`);
            } else {
                const built = await buildZendiSummary({
                    caregiverName: session.caregiver?.name || 'Cuidador(a)',
                    shiftType: shiftTypeDraft,
                    patients,
                    activity,
                    justifications,
                    shiftDate: shiftStart,
                });
                zendiSummary = built.summary;
            }

            /**
             * Guarda contra doble envio del cierre de turno.
             *
             * Medido el 30-ago-2026: 11 relevos duplicados de 860. Misma
             * cuidadora, mismo tipo de turno, menos de dos minutos aparte. Un
             * relevo duplicado no es cosmetico: cada uno arrastra su reporte de
             * Zendi, sus notas y su firma, y en el historial parece que el turno
             * se entrego dos veces.
             *
             * Va FUERA de la transaccion a proposito: si ya existe, no hay nada
             * que abrir. Y devuelve exito con el id del que ya esta, porque un
             * error rojo al final de un turno hace que la cuidadora lo repita —
             * que es exactamente lo que produce el duplicado.
             */
            /**
             * IDEMPOTENCIA POR LA SESIÓN, ANTES QUE POR LA HUELLA.
             *
             * `ShiftSession.shiftHandoverId` es `@unique`: si ya está puesto,
             * este turno YA tiene su relevo y no hay nada que decidir. La
             * guarda de huella de abajo —misma cuidadora, mismo tipo de turno,
             * dos minutos— se queda como red para el caso en que la sesión aún
             * no se hubiera enlazado, pero es aproximada por construcción: dos
             * turnos distintos de la misma persona cerrados seguidos se
             * confundirían entre sí.
             */
            if (session.shiftHandoverId) {
                return NextResponse.json({
                    success: true,
                    duplicado: true,
                    handoverId: session.shiftHandoverId,
                    message: 'Tu turno ya fue cerrado. No se duplicó.',
                });
            }

            const dosMinutosAtras = new Date(Date.now() - 2 * 60 * 1000);
            const relevoReciente = await prisma.shiftHandover.findFirst({
                where: {
                    headquartersId: session.headquartersId,
                    outgoingNurseId: session.caregiverId,
                    shiftType: shiftTypeDraft,
                    isDailyPrologue: false,
                    createdAt: { gte: dosMinutosAtras },
                },
                select: { id: true },
                orderBy: { createdAt: 'desc' },
            });
            if (relevoReciente) {
                return NextResponse.json({
                    success: true,
                    duplicado: true,
                    handoverId: relevoReciente.id,
                    message: 'Tu turno ya fue cerrado hace un momento. No se duplicó.',
                });
            }

            /**
             * EL AMBITO DE LAS DOSIS SE RESUELVE APARTE DEL DEL REPORTE.
             *
             * `colorGroups`/`patients` de arriba usan `shiftStart`, que esta
             * recortado a `todayStartAST()` (las 6 AM). Para el reporte esta
             * bien. Para las dosis es un fallo de los que CLAUDE.md llama "las
             * tres anclas": en un turno de noche ponchado a las 22:02, el
             * recorte lleva la fecha al dia siguiente y
             * `resolveColorGroupsForCaregiver` encuentra la pauta de MAÑANA —
             * otro color. Medido: 4 turnos de noche recibirian el aviso de un
             * grupo que no cuidaron, y 6 saldrian sin color teniendo pauta.
             *
             * Con el ponche REAL el ambito es el mismo que le mostro
             * /api/care/shift/pendientes, que es la unica forma de que firme lo
             * que vio.
             */
            const coloresDeLasDosis = await resolveColorGroupsForCaregiver(
                session.caregiverId, session.headquartersId, session.startTime,
            );
            const pacientesDeLasDosis = await resolvePatientsByColors(
                coloresDeLasDosis, session.headquartersId,
            );
            const ventanaDosis = ventanaDeDosisDelTurno({
                ponche: session.startTime,
                tipoDeTurno: shiftTypeDraft,
                ahora: now,
                cierre: session.actualEndTime,
            });

            const [handover, closedSession, dosisResueltas] = await prisma.$transaction(async (tx) => {
                // Flujo nuevo: cuidador firma → supervisor firma directo.
                // Sin paso de "senior confirma" (eliminado).
                // La firma del cuidador en el Wizard es suficiente para cerrar el relevo.
                // Status → ACCEPTED directamente (no requiere firma adicional del supervisor).
                // El supervisor puede ver y revisar el reporte en /corporate/reports pero
                // el relevo no queda bloqueado esperando su firma.
                const shiftHandover = await tx.shiftHandover.create({
                    data: {
                        headquartersId: session.headquartersId,
                        shiftType: shiftTypeDraft,
                        outgoingNurseId: session.caregiverId,
                        status: 'ACCEPTED',
                        acceptedAt: now,
                        aiSummaryReport: zendiSummary,
                        signature,
                        signedOutAt: now,
                        justifications,
                        handoverCompleted: true,
                        colorGroups,
                        isDailyPrologue: false,
                    },
                });

                /**
                 * LAS DOSIS QUE LA CUIDADORA ACABA DE GARANTIZAR.
                 *
                 * Dentro de la transaccion y despues de crear el relevo, con la
                 * MISMA firma: lo que firma es el reporte que dice que las dio.
                 * O se guardan las dos cosas o ninguna.
                 *
                 * Hasta el 21-sep-2026 esto no ocurria en ninguna parte. El
                 * wizard ya recogia la respuesta y la guardaba en
                 * `justifications`, pero nadie la aplicaba al eMAR: 0 de 294
                 * relevos de 30 dias llevan una sola justificacion, porque el
                 * unico sitio donde se monta el wizard le pasaba la lista de
                 * avisos vacia. Ver src/lib/dosis-sin-resolver.ts.
                 */
                const dosis = await aplicarRespuestasDeCierre(tx as any, {
                    justifications,
                    // Los mismos residentes que le MOSTRO el aviso, no los del
                    // reporte. Ver `pacientesDeLasDosis` arriba: el reporte
                    // resuelve el color con el inicio recortado al dia clinico y
                    // eso, en un turno de noche, trae la pauta del dia
                    // SIGUIENTE. Firmar sobre ese conjunto ponia dosis de otro
                    // grupo de color a nombre de quien no las dio.
                    patientIds: pacientesDeLasDosis.map(p => p.id),
                    // La ventana, que es lo que impide que una clave rancia del
                    // turno anterior firme dosis de hace dias.
                    desde: ventanaDosis.desde,
                    hasta: ventanaDosis.hasta,
                    caregiverId: session.caregiverId,
                    caregiverName: session.caregiver?.name || 'Cuidador(a)',
                    headquartersId: session.headquartersId,
                    // Ata cada dosis firmada al relevo del que cuelga su firma.
                    shiftHandoverId: shiftHandover.id,
                    firma: signature,
                    ahora: now,
                    etiquetaDeMotivo: etiquetaOmision,
                    estadoDeMotivo: estadoParaOmision,
                });

                const selected = (handoverData.selectedPatients ?? {}) as Record<string, string>;
                const selectedIds = Object.keys(selected);
                if (selectedIds.length > 0) {
                    await tx.handoverNote.createMany({
                        data: selectedIds.map(patientId => ({
                            shiftHandoverId: shiftHandover.id,
                            patientId,
                            clinicalNotes: selected[patientId],
                            isCritical: false,
                        })),
                    });
                } else if (patients.length > 0) {
                    const criticalIds = new Set<string>([
                        ...activity.falls.map(f => patients.find(p => p.name === f.patientName)?.id).filter((x): x is string => !!x),
                        ...activity.clinicalAlerts.map(a => patients.find(p => p.name === a.patientName)?.id).filter((x): x is string => !!x),
                    ]);
                    await tx.handoverNote.createMany({
                        data: patients.map(p => ({
                            shiftHandoverId: shiftHandover.id,
                            patientId: p.id,
                            clinicalNotes: `Turno ${shiftTypeDraft} cerrado por ${session.caregiver?.name || 'cuidador(a)'}. Ver aiSummaryReport para detalle.`,
                            isCritical: criticalIds.has(p.id),
                        })),
                    });
                }

                const updatedSession = await tx.shiftSession.update({
                    where: { id: shiftSessionId },
                    data: {
                        actualEndTime: now,
                        handoverCompleted: true,
                        aiSummaryReport: zendiSummary,
                        shiftHandoverId: shiftHandover.id,
                    },
                });

                // Cleanup: cancelar ventanas de vitales auto-creadas que quedaron
                // PENDING al cerrar el turno. Antes persistían como fantasmas en
                // el dashboard del supervisor hasta su expiresAt.
                await tx.vitalsOrder.updateMany({
                    where: {
                        shiftSessionId,
                        status: 'PENDING',
                        autoCreated: true,
                    },
                    data: { status: 'EXPIRED' },
                });

                // Cleanup: cerrar ShiftPatientOverride activos donde esta
                // cuidadora era la RECEPTORA. Antes quedaban isActive=true
                // indefinidamente al cerrar turno — el chokepoint los filtra
                // en runtime vía filterRealOverrides(... activeUserIdsSet)
                // así que no afectaban el wall, pero la DB acumulaba data
                // sucia y queries históricas que no aplicaran ese filtro
                // veían overrides "activos" de hace semanas.
                const cleanedOverrides = await tx.shiftPatientOverride.updateMany({
                    where: {
                        caregiverId: session.caregiverId,
                        isActive: true,
                    },
                    data: { isActive: false, resolvedAt: now },
                });

                await tx.systemAuditLog.create({
                    data: {
                        headquartersId: session.headquartersId,
                        entityName: 'ShiftHandover',
                        entityId: shiftHandover.id,
                        action: SystemAuditAction.SIGNED_OUT,
                        performedById: invokerId,
                        payloadChanges: {
                            shiftSessionId: session.id,
                            tasksExempted: justifications,
                            zendiApproved: true,
                            reportPreviewedByCaregiver: typeof previewedReport === 'string',
                            closedBySupervisor: !isOwner,
                            ownerCaregiverId: session.caregiverId,
                            colorGroups,
                            patientCount: patients.length,
                            overridesCleaned: cleanedOverrides.count,
                        },
                    },
                });

                return [shiftHandover, updatedSession, dosis];
            });

            // Recorte de ruido (17-ago-2026): el cierre de turno ya NO
            // notifica a supervisión — generaba 1,265 campanas/mes por un
            // evento que es el happy path. El reporte vive en
            // /corporate/reports y los handovers sin firmar tienen su propio
            // flujo de seguimiento. El cierre forzado (flujo 2) tampoco
            // notifica: lo ejecuta el propio supervisor.

            // `dosisResueltas` viaja a la tableta para poder decirle a la
            // cuidadora QUE paso con lo que acaba de garantizar. Un cierre que
            // contesta solo "listo" sobre 45 dosis firmadas es el mismo
            // silencio que teniamos, con mejor cara.
            console.log(`[shift/end] dosis del cierre — firmadas ${dosisResueltas.firmadas},`
                + ` omitidas ${dosisResueltas.omitidas}, sin garantia ${dosisResueltas.sinGarantia},`
                + ` ya resueltas ${dosisResueltas.yaResueltas} · ${session.caregiver?.name}`);
            return NextResponse.json({
                success: true,
                shiftSession: closedSession,
                handover,
                dosisResueltas,
            });
        }

        // ──────────────────────────────────────────────────────────────────
        // FLUJO 2 — Cierre forzado por supervisor
        // ──────────────────────────────────────────────────────────────────
        if (!isSupervisor) {
            return NextResponse.json({
                success: false,
                error: "Debes completar el wizard de cierre. Si el cuidador no puede, un supervisor debe forzar el cierre.",
            }, { status: 400 });
        }

        const forcedSummary = `Cierre forzado por supervisor ${invokerName}. Sin reporte clínico del cuidador.`;

        // Misma guarda en el cierre forzado. Aqui la clave es el CUIDADOR cuyo
        // turno se cierra, no el supervisor que lo fuerza: dos supervisores
        // forzando el mismo turno producirian dos relevos de la misma persona.
        const relevoForzadoReciente = await prisma.shiftHandover.findFirst({
            where: {
                headquartersId: session.headquartersId,
                outgoingNurseId: session.caregiverId,
                shiftType: shiftTypeDraft,
                isDailyPrologue: false,
                createdAt: { gte: new Date(Date.now() - 2 * 60 * 1000) },
            },
            select: { id: true },
            orderBy: { createdAt: 'desc' },
        });
        if (relevoForzadoReciente) {
            return NextResponse.json({
                success: true,
                duplicado: true,
                handoverId: relevoForzadoReciente.id,
                message: 'Este turno ya fue cerrado hace un momento. No se duplicó.',
            });
        }

        const [forcedHandover, forcedSession] = await prisma.$transaction(async (tx) => {
            const handover = await tx.shiftHandover.create({
                data: {
                    headquartersId: session.headquartersId,
                    shiftType: shiftTypeDraft,
                    outgoingNurseId: session.caregiverId,
                    status: 'PENDING',
                    aiSummaryReport: forcedSummary,
                    handoverCompleted: false,
                    colorGroups: [],
                    isDailyPrologue: false,
                    supervisorSignedById: invokerId,
                    supervisorSignedAt: now,
                    supervisorNote: `Cierre forzado — cuidador no disponible. Invocado por ${invokerName}.`,
                },
            });

            const updatedSession = await tx.shiftSession.update({
                where: { id: shiftSessionId },
                data: {
                    actualEndTime: now,
                    aiSummaryReport: forcedSummary,
                    shiftHandoverId: handover.id,
                },
            });

            // Cleanup vitales auto-creadas también en cierre forzado
            await tx.vitalsOrder.updateMany({
                where: {
                    shiftSessionId,
                    status: 'PENDING',
                    autoCreated: true,
                },
                data: { status: 'EXPIRED' },
            });

            // Cleanup overrides activos del cuidador — mismo razonamiento
            // que Flujo 1. Aplica también en cierre forzado para no dejar
            // data sucia.
            const cleanedOverrides = await tx.shiftPatientOverride.updateMany({
                where: {
                    caregiverId: session.caregiverId,
                    isActive: true,
                },
                data: { isActive: false, resolvedAt: now },
            });

            await tx.systemAuditLog.create({
                data: {
                    headquartersId: session.headquartersId,
                    entityName: 'ShiftHandover',
                    entityId: handover.id,
                    action: SystemAuditAction.SYSTEM_ABANDONED,
                    performedById: invokerId,
                    payloadChanges: {
                        kind: 'FORCE_CLOSED_BY_SUPERVISOR',
                        shiftSessionId: session.id,
                        ownerCaregiverId: session.caregiverId,
                        supervisorId: invokerId,
                        supervisorName: invokerName,
                        overridesCleaned: cleanedOverrides.count,
                    },
                },
            });

            return [handover, updatedSession];
        });

        // Nota: NO aplicamos applyScoreEvent aquí. La penalidad de -10 ya la
        // cuenta /api/care/compliance-score automáticamente por
        // handoverCompleted=false (ventana 14 días). Aplicarla aquí causaba
        // doble penalidad (-20) al cuidador cuyo turno fue cerrado.
        return NextResponse.json({ success: true, shiftSession: forcedSession, handover: forcedHandover, forced: true });

    } catch (error) {
        logError('care.shift.end.post', error);
        return NextResponse.json({ success: false, error: "Error de Servidor al Consolidar la Guardia" }, { status: 500 });
    }
}
