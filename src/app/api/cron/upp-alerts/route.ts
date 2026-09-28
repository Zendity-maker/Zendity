import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Vercel Cron: cada 2 horas (vercel.json: "0 */2 * * *")
// Detecta pacientes sin rotación postural >2h con nortonRisk=true
// O con UPP activa (status ACTIVE/HEALING) — aunque nortonRisk sea false.
// FIX: antes solo filtraba nortonRisk=true, ignorando pacientes con UPP activa.
// FIX: ahora envía notificaciones reales vía notifyRoles.
// FIX: eliminado PosturalChangeLog con nurseId="system_cron" (violaba FK).

export async function GET(req: Request) {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) return NextResponse.json({ error: 'CRON_SECRET no configurado en entorno' }, { status: 500 });
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Firma CRON Inválida' }, { status: 401 });
    }

    try {
        const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
        const now = new Date();
        const limitTime = new Date(now.getTime() - TWO_HOURS_MS);

        // Pacientes en riesgo: requiresPosturalChanges=true (flag clínico
        // explícito, p.ej. encamado), nortonRisk=true (escala predictiva),
        // O tienen UPP activa.
        //
        // FIX 2026-05-31: excluir DISCHARGED/DECEASED — antes el cron
        // disparaba notificaciones de rotación postural a cuidadores por
        // residentes egresados con UPPs históricas no marcadas como
        // RESOLVED. Falsa alerta = ruido operativo y erosiona la confianza
        // en las alertas reales.
        //
        // FIX 2026-06-16 (sprint nursing-upp-dashboard): añadido
        // requiresPosturalChanges al OR. Antes los pacientes flag-only
        // (encamado sin Norton sin úlcera) entraban al dashboard pero NO al
        // cron — quedaban sin push proactivo cuando se vencía la ventana.
        // Inconsistencia threshold cron-vs-postural (flat 2h vs 120/135)
        // sigue como follow-up — este cambio amplía señales, no umbrales.
        // Solo ACTIVE. Un residente en TEMPORARY_LEAVE (hospital, visita
        // familiar) NO está en el edificio: nadie puede rotarlo y alertar
        // "requiere cambio de posición inmediato" es falsa alarma por
        // definición (caso Isidra Beaton, ago-2026: 7 días de alertas
        // diarias estando hospitalizada). El sistema SÍ sabe dónde está —
        // status/leaveType/leaveDate — y este filtro ahora lo usa. Al volver
        // (status→ACTIVE) reentra al barrido automáticamente, y su rotación
        // "vieja" disparará la alerta de inmediato: eso sí es correcto,
        // porque recién llegada necesita rotación pronto.
        const atRiskPatients = await prisma.patient.findMany({
            where: {
                status: 'ACTIVE',
                OR: [
                    { requiresPosturalChanges: true },
                    { nortonRisk: true },
                    { pressureUlcers: { some: { status: { not: 'RESOLVED' } } } }
                ]
            },
            select: {
                id: true,
                name: true,
                headquartersId: true,
                // Multi-señal: necesario para renderizar el fallback correcto
                // del activeUlcer string cuando NO hay UPP activa pero el
                // paciente está enrolado via flag o norton.
                requiresPosturalChanges: true,
                nortonRisk: true,
                posturalChanges: {
                    orderBy: { performedAt: 'desc' },
                    take: 1,
                    select: { performedAt: true, isComplianceAlert: true }
                },
                pressureUlcers: {
                    where: { status: { not: 'RESOLVED' } },
                    orderBy: { stage: 'desc' },
                    take: 1,
                    select: { stage: true, bodyLocation: true, status: true }
                }
            }
        });

        // ── Targeting + dedup (recorte de ruido, 17-ago-2026) ────────────
        //
        // Antes: por CADA paciente vencido, notificación a TODOS los
        // CAREGIVER+NURSE+SUPERVISOR de la sede, repetida cada corrida (2h).
        // Medido en prod: 36,500 notificaciones/30 días — el 86% de TODO el
        // ruido del sistema. Una cuidadora en su casa recibía "requiere cambio
        // de posición inmediato" 60 veces al día. Como advierte el comentario
        // de arriba: falsa alerta erosiona la confianza en las alertas reales.
        //
        // Ahora:
        //   1. CAREGIVERs: solo con turno ACTIVO (sesión abierta <14h) —
        //      el resto no puede rotar a nadie desde su casa.
        //   2. NURSE/SUPERVISOR: siguen (son la ruta de escalamiento).
        //   3. Dedup: máx 1 notificación por paciente/usuario/día. La
        //      persistencia del estado vive en el dashboard UPP, no en
        //      martillar la campana.
        const fourteenHrsAgo = new Date(now.getTime() - 14 * 3600 * 1000);
        // 00:00 AST de hoy = 04:00 UTC del día AST en curso
        const nowAST = new Date(now.getTime() - 4 * 3600 * 1000);
        const todayStart = new Date(Date.UTC(nowAST.getUTCFullYear(), nowAST.getUTCMonth(), nowAST.getUTCDate(), 4, 0, 0));

        const hqIds = [...new Set(atRiskPatients.map(p => p.headquartersId))];
        const [escalationStaff, activeSessions, notifiedToday] = await Promise.all([
            /**
             * QUIÉN ESCALA — Y POR QUÉ NO BASTA EL ROL PRIMARIO.
             *
             * Esto era `role: { in: ['NURSE','SUPERVISOR'] }`, o sea SOLO el rol
             * primario. Medido el 28-sep-2026 contra producción: alcanzaba a UNA
             * persona, Mariangelie Rivera. Y NO alcanzaba a Celia Sierra, que es
             * quien hace la enfermería de este hogar — su NURSE es secundario,
             * su primario es DIRECTOR.
             *
             * O sea que la escalación de úlceras llevaba meses sin llegar a
             * enfermería. Mirando también los secundarios, y sumando dirección
             * —que es quien escribe los planes: 14 de las 17 curaciones son de
             * Andrés—, alcanza a 4.
             *
             * Es el mismo error que ya está escrito en la memoria del proyecto:
             * en este hogar el rol primario no dice quién hace el trabajo.
             */
            prisma.user.findMany({
                where: {
                    headquartersId: { in: hqIds },
                    isActive: true, isDeleted: false,
                    OR: [
                        { role: { in: ['NURSE', 'SUPERVISOR', 'DIRECTOR'] as any } },
                        { secondaryRoles: { hasSome: ['NURSE', 'SUPERVISOR'] } },
                    ],
                },
                select: { id: true, headquartersId: true },
            }),
            prisma.shiftSession.findMany({
                where: { headquartersId: { in: hqIds }, actualEndTime: null, startTime: { gte: fourteenHrsAgo } },
                select: { caregiverId: true, headquartersId: true },
            }),
            prisma.notification.findMany({
                where: { type: 'SHIFT_ALERT', title: { startsWith: 'Alerta UPP' }, createdAt: { gte: todayStart } },
                select: { userId: true, title: true },
            }),
        ]);
        const targetsByHq = new Map<string, Set<string>>();
        for (const u of escalationStaff) {
            if (!targetsByHq.has(u.headquartersId)) targetsByHq.set(u.headquartersId, new Set());
            targetsByHq.get(u.headquartersId)!.add(u.id);
        }
        for (const s of activeSessions) {
            if (!targetsByHq.has(s.headquartersId)) targetsByHq.set(s.headquartersId, new Set());
            targetsByHq.get(s.headquartersId)!.add(s.caregiverId);
        }
        // Clave de dedup: userId + título (el título lleva el nombre del paciente)
        const alreadyNotified = new Set(notifiedToday.map(n => `${n.userId}|${n.title}`));

        const violations: object[] = [];
        const toCreate: { userId: string; type: string; title: string; message: string; link: string; isRead: boolean }[] = [];

        for (const patient of atRiskPatients) {
            const lastRotation = patient.posturalChanges[0];
            const activeUlcer = patient.pressureUlcers[0] ?? null;

            const isSlaViolation = !lastRotation || lastRotation.performedAt < limitTime;
            if (!isSlaViolation) continue;

            const hoursOverdue = lastRotation
                ? ((now.getTime() - lastRotation.performedAt.getTime()) / (1000 * 60 * 60)).toFixed(1)
                : 'Crítico (+24h)';

            // Fallback text del campo activeUlcer del audit: refleja POR QUÉ
            // el paciente entró al at-risk set cuando no hay UPP material.
            // Antes: hardcoded "Sin UPP (nortonRisk)" — incorrecto para
            // flag-only o pacientes con ambos triggers.
            const enrollmentReason = activeUlcer
                ? `Estadio ${activeUlcer.stage} — ${activeUlcer.bodyLocation}`
                : patient.requiresPosturalChanges
                    ? 'Sin UPP (encamado)'
                    : patient.nortonRisk
                        ? 'Sin UPP (nortonRisk)'
                        : 'Sin UPP';

            violations.push({
                patientId: patient.id,
                patientName: patient.name,
                lastRotationTime: lastRotation?.performedAt ?? 'Ninguna',
                hoursOverdue,
                activeUlcer: enrollmentReason,
            });

            const ulcerDetail = activeUlcer
                ? ` UPP Estadio ${activeUlcer.stage} en ${activeUlcer.bodyLocation}.`
                : '';

            // El título lleva el nombre para que el dedup sea por paciente.
            const title = `Alerta UPP — ${patient.name.trim()}`;
            const message = `Lleva más de ${hoursOverdue}h sin rotación postural.${ulcerDetail} Requiere cambio de posición inmediato.`;
            const targets = targetsByHq.get(patient.headquartersId) ?? new Set<string>();
            for (const userId of targets) {
                if (alreadyNotified.has(`${userId}|${title}`)) continue;
                toCreate.push({ userId, type: 'SHIFT_ALERT', title, message, link: '/care', isRead: false });
            }
        }

        /**
         * ÚLCERAS ABIERTAS SIN PLAN DEL HOME CARE
         * ────────────────────────────────────────
         *
         * ═══ POR QUÉ ═══
         *
         * Desde el 28-sep-2026 la cuidadora puede registrar una curación, pero
         * SOLO si la úlcera tiene plan escrito: lo que se guarda es ese plan,
         * literal, y ella confirma que lo hizo. Sin plan no hay nada que
         * confirmar, así que la opción ni le aparece.
         *
         * Eso convierte un plan que falta en un cuidado que no se puede
         * registrar. Y faltan: medido ese día, CUATRO de las seis úlceras
         * activas no tienen plan —una de 83 días, y una SACRA ESTADIO 3 de 20—.
         * Nadie se estaba enterando porque nada lo decía.
         *
         * ═══ TRES DÍAS ═══
         *
         * No es un número redondo por gusto: es el tiempo razonable para que la
         * enfermera de fuera venga y alguien transcriba lo que indicó. Menos
         * sería avisar de algo que todavía está en camino; más es dejar a una
         * herida abierta sin tratamiento escrito.
         *
         * Las cuatro de hoy saltan desde el primer día, y está bien: las cuatro
         * llevan más de nueve.
         *
         * ═══ EL RUIDO ═══
         *
         * Se repite a diario mientras el plan falte, como la alerta de rotación
         * de arriba y por la misma llave de dedup (`userId|title`). Con la de 83
         * días eso son muchos avisos — y la forma de callarlo es escribir el
         * plan, que es exactamente lo que se pide. Un aviso que se lee una vez y
         * se va es como dos observaciones de personal se quedaron 56 y 45 días
         * paradas.
         */
        const TRES_DIAS_MS = 3 * 24 * 60 * 60 * 1000;
        const sinPlan = await prisma.pressureUlcer.findMany({
            where: {
                status: { in: ['ACTIVE', 'HEALING'] },
                resolvedAt: null,
                OR: [{ planTratamiento: null }, { planTratamiento: '' }],
                identifiedAt: { lte: new Date(now.getTime() - TRES_DIAS_MS) },
                // Solo de quien sigue aquí: una úlcera de alguien que se fue no
                // necesita plan, necesita cierre. Antipatrón #2 de CLAUDE.md.
                patient: { status: { in: ['ACTIVE', 'TEMPORARY_LEAVE'] } },
            },
            select: {
                id: true, stage: true, bodyLocation: true, identifiedAt: true,
                patient: { select: { id: true, name: true, headquartersId: true } },
            },
        });

        const hqSinPlan = [...new Set(sinPlan.map(u => u.patient!.headquartersId))];
        const [staffSinPlan, avisadosHoy] = await Promise.all([
            prisma.user.findMany({
                where: {
                    headquartersId: { in: hqSinPlan },
                    isActive: true, isDeleted: false,
                    OR: [
                        { role: { in: ['NURSE', 'SUPERVISOR', 'DIRECTOR'] as any } },
                        { secondaryRoles: { hasSome: ['NURSE', 'SUPERVISOR'] } },
                    ],
                },
                select: { id: true, headquartersId: true },
            }),
            prisma.notification.findMany({
                where: { type: 'SHIFT_ALERT', title: { startsWith: 'Úlcera sin plan' }, createdAt: { gte: todayStart } },
                select: { userId: true, title: true },
            }),
        ]);
        const yaAvisado = new Set(avisadosHoy.map(n => `${n.userId}|${n.title}`));
        const staffPorHq = new Map<string, string[]>();
        for (const u of staffSinPlan) {
            if (!staffPorHq.has(u.headquartersId)) staffPorHq.set(u.headquartersId, []);
            staffPorHq.get(u.headquartersId)!.push(u.id);
        }

        const ulcerasSinPlan: object[] = [];
        for (const u of sinPlan) {
            const dias = Math.floor((now.getTime() - u.identifiedAt.getTime()) / 86400000);
            const nombre = u.patient!.name.trim();
            const title = `Úlcera sin plan — ${nombre}`;
            const message = `${u.bodyLocation}, estadio ${u.stage}. Lleva ${dias} días abierta y no tiene el plan del home care escrito. Sin plan, la cuidadora no puede registrar la curación — solo el cambio de apósito.`;
            ulcerasSinPlan.push({ paciente: nombre, dias, estadio: u.stage, zona: u.bodyLocation });
            for (const userId of staffPorHq.get(u.patient!.headquartersId) ?? []) {
                if (yaAvisado.has(`${userId}|${title}`)) continue;
                toCreate.push({ userId, type: 'SHIFT_ALERT', title, message, link: '/care/nursing', isRead: false });
            }
        }

        if (toCreate.length > 0) {
            await prisma.notification.createMany({ data: toCreate });
        }

        return NextResponse.json({
            ok: true,
            message: 'Auditoría UPP completada.',
            scannedPatients: atRiskPatients.length,
            violationsDetected: violations.length,
            notificationsSent: toCreate.length,
            ulcerasSinPlan,
            onShiftCaregivers: activeSessions.length,
            violations,
        });

    } catch (error: any) {
        console.error('[cron/upp-alerts] error:', error);
        return NextResponse.json(
            { error: 'Fallo interno en auditoría UPP', detail: error.message },
            { status: 500 }
        );
    }
}
