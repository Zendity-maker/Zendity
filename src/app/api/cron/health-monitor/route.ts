import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { notifyRoles } from '@/lib/notifications';
import { SystemAuditAction, ColorGroup } from '@prisma/client';

// Vercel Cron: cada 6 horas (vercel.json: "0 */6 * * *")
// AUTO-CORRECCIÓN: FastActions expiradas, Notificaciones >48h, complianceScore fuera de rango.
// SOLO ALERTA: ShiftSessions zombi, Patients sin color, VitalsOrders vencidas,
//              FamilyMember huérfanos, Intake estancado, Meds sin horario.

import { verificarSede, type Hallazgo } from '@/lib/verificaciones';
import sgMail from '@sendgrid/mail';

if (process.env.SENDGRID_API_KEY) sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const COLOR_SEVERIDAD: Record<string, string> = {
    CRITICA: '#b91c1c',
    ALTA:    '#b45309',
    MEDIA:   '#0F6E56',
};

/** Correo a dirección. Solo sale si hay algo que decir. */
async function enviarResumen(hqNombre: string, destinatarios: string[], hallazgos: Hallazgo[]) {
    if (!hallazgos.length || !destinatarios.length) return false;
    if (!process.env.SENDGRID_API_KEY) return false;

    const bloques = hallazgos.map(h => `
        <div style="border-left:4px solid ${COLOR_SEVERIDAD[h.severidad]};padding:12px 16px;margin:0 0 16px;background:#fafaf9;">
            <p style="margin:0 0 4px;font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:${COLOR_SEVERIDAD[h.severidad]};">
                ${h.severidad} · ${h.total} caso${h.total === 1 ? '' : 's'}
            </p>
            <p style="margin:0 0 8px;font-size:16px;font-weight:800;color:#12211D;">${h.titulo}</p>
            <ul style="margin:0 0 10px;padding-left:18px;color:#3f3f46;font-size:14px;line-height:1.6;">
                ${h.ejemplos.map(e => `<li>${e}</li>`).join('')}
                ${h.total > h.ejemplos.length ? `<li style="color:#78716c;">y ${h.total - h.ejemplos.length} más</li>` : ''}
            </ul>
            <p style="margin:0;font-size:13px;color:#57534e;"><strong>Qué hacer:</strong> ${h.accion}</p>
        </div>`).join('');

    await sgMail.send({
        to: destinatarios,
        from: {
            email: process.env.SENDGRID_FROM_EMAIL || 'notificaciones@zendity.com',
            name: 'Zéndity',
        },
        subject: `Revisión diaria — ${hallazgos.length} cosa${hallazgos.length === 1 ? '' : 's'} que revisar en ${hqNombre}`,
        html: `<div style="background:#ffffff;padding:28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#12211D;">
            <p style="margin:0 0 6px;font-size:20px;font-weight:800;">Revisión diaria de Zéndity</p>
            <p style="margin:0 0 22px;font-size:14px;color:#57534e;">
                ${hqNombre} · Esto lo encontró el sistema revisándose a sí mismo. No es una lista de tareas
                pendientes: es lo que hoy está diciendo algo distinto de la verdad, o algo que se marcó
                como hecho y no ocurrió.
            </p>
            ${bloques}
            <p style="margin:22px 0 0;font-size:12px;color:#78716c;">
                Si alguno de estos avisos aparece todos los días sin que nadie lo pueda resolver, avísanos:
                una alerta que nadie puede apagar deja de servir y hay que arreglarla de raíz o retirarla.
            </p>
        </div>`,
    });
    return true;
}

interface AnomalyItem {
    check: string;
    count: number;
    autoFixed: boolean;
    detail?: string;
}

export async function GET(req: Request) {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) return NextResponse.json({ error: 'CRON_SECRET no configurado en entorno' }, { status: 500 });
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Firma CRON Inválida' }, { status: 401 });
    }

    try {
        const now = new Date();
        const h14ago = new Date(now.getTime() - 14 * 60 * 60 * 1000);
        const h4ago  = new Date(now.getTime() -  4 * 60 * 60 * 1000);
        const h1ago  = new Date(now.getTime() -  1 * 60 * 60 * 1000);
        const h48ago = new Date(now.getTime() - 48 * 60 * 60 * 1000);
        const d7ago  = new Date(now.getTime() -  7 * 24 * 60 * 60 * 1000);

        const headquarters = await prisma.headquarters.findMany({
            select: { id: true, name: true },
        });

        const globalReport: Record<string, AnomalyItem[]> = {};
        let totalAnomalies = 0;

        // ── Checks globales (sin auto-corrección) ─────────────────────
        const [
            orphanedFamily,
            nullScheduleTimes,
            staleIntake,
            dupeEmails,
        ] = await Promise.allSettled([
            prisma.$queryRaw<{ id: string; name: string; headquartersId: string }[]>`
                SELECT fm.id, fm.name, fm."headquartersId"
                FROM "FamilyMember" fm
                LEFT JOIN "Patient" p ON p.id = fm."patientId"
                WHERE p.id IS NULL
            `,
            prisma.patientMedication.findMany({
                where: { status: 'ACTIVE', isActive: true, scheduleTimes: '' },
                include: { patient: { select: { name: true, headquartersId: true } } },
            }),
            prisma.intakeData.findMany({
                where: { status: 'PENDIENTE_REVISION', updatedAt: { lt: d7ago } },
                include: { patient: { select: { name: true, headquartersId: true } } },
            }),
            prisma.$queryRaw<{ email: string; count: number }[]>`
                SELECT email, COUNT(*)::int AS count
                FROM "FamilyMember"
                GROUP BY email HAVING COUNT(*) > 1
            `,
        ]);

        // ── Checks + auto-correcciones POR HQ ────────────────────────
        await Promise.allSettled(
            headquarters.map(async (hq) => {
                const anomalies: AnomalyItem[] = [];

                // ── A. FastActions expiradas → AUTO-CORRECCIÓN ──────────
                let fastActionsFixed = 0;
                try {
                    const result = await prisma.fastActionAssignment.updateMany({
                        // Las NOTAS ([NOTA]) son instrucciones sin penalización —
                        // nunca se marcan FAILED ni restan score, aunque venzan.
                        where: {
                            headquartersId: hq.id,
                            status: 'PENDING',
                            expiresAt: { lt: h1ago },
                            NOT: { description: { startsWith: '[NOTA]' } },
                        },
                        data: { status: 'FAILED' },
                    });
                    fastActionsFixed = result.count;
                } catch { /* silenciar */ }

                // ── B. Notificaciones >48h → AUTO-CORRECCIÓN ────────────
                // EXENTAS las accionables: una notificación que apunta a una
                // cola de aprobación (citas familiares, visitas externas por
                // aprobar) representa a una persona esperando respuesta. Antes
                // esta limpieza las marcaba leídas sin distinción y dos
                // solicitudes de cita pasaron su fecha sin que nadie las viera
                // (ago-2026). "Mantener el sistema limpio" no puede costar
                // solicitudes reales; esas mueren solo cuando su badge de
                // estado (pending-count) muere con ellas.
                let notificationsFixed = 0;
                try {
                    const result = await prisma.notification.updateMany({
                        where: {
                            isRead: false,
                            createdAt: { lt: h48ago },
                            user: { headquartersId: hq.id },
                            NOT: {
                                OR: [
                                    { link: '/corporate/family-appointments' },
                                    { type: 'EXTERNAL_VISIT_PENDING' },
                                ],
                            },
                        },
                        data: { isRead: true },
                    });
                    notificationsFixed = result.count;
                } catch { /* silenciar */ }

                // ── C. complianceScore fuera de rango → AUTO-CORRECCIÓN ─
                let scoresFixed = 0;
                try {
                    scoresFixed = await prisma.$executeRaw`
                        UPDATE "User"
                        SET "complianceScore" = GREATEST(0, LEAST(100, "complianceScore"))
                        WHERE "headquartersId" = ${hq.id}
                        AND "isActive" = true
                        AND "isDeleted" = false
                        AND ("complianceScore" > 100 OR "complianceScore" < 0)
                    `;
                } catch { /* silenciar */ }

                // ── Checks sin auto-corrección ──────────────────────────
                const [
                    zombieSessions,
                    noColorPatients,
                    staleVitals,
                ] = await Promise.allSettled([
                    prisma.shiftSession.count({
                        where: { headquartersId: hq.id, actualEndTime: null, startTime: { lt: h14ago } },
                    }),
                    prisma.patient.count({
                        where: { headquartersId: hq.id, status: 'ACTIVE', colorGroup: ColorGroup.UNASSIGNED },
                    }),
                    prisma.vitalsOrder.count({
                        where: { headquartersId: hq.id, status: 'PENDING', expiresAt: { lt: h4ago } },
                    }),
                ]);

                const z  = zombieSessions.status  === 'fulfilled' ? zombieSessions.value  : 0;
                const nc = noColorPatients.status  === 'fulfilled' ? noColorPatients.value : 0;
                const sv = staleVitals.status      === 'fulfilled' ? staleVitals.value     : 0;

                // ── Registrar anomalías auto-corregidas ─────────────────
                if (fastActionsFixed > 0) {
                    anomalies.push({
                        check: 'FastActions expiradas cerradas automáticamente',
                        count: fastActionsFixed,
                        autoFixed: true,
                    });
                }
                if (notificationsFixed > 0) {
                    anomalies.push({
                        check: 'Notificaciones antiguas limpiadas automáticamente',
                        count: notificationsFixed,
                        autoFixed: true,
                    });
                }
                if (scoresFixed > 0) {
                    anomalies.push({
                        check: 'complianceScore corregido al rango 0-100',
                        count: scoresFixed,
                        autoFixed: true,
                    });
                }

                // ── Registrar anomalías que requieren acción humana ─────
                if (z > 0) anomalies.push({
                    check: 'ShiftSession zombi detectada',
                    count: z,
                    autoFixed: false,
                });
                if (nc > 0) anomalies.push({
                    check: 'Patients ACTIVE sin colorGroup asignado',
                    count: nc,
                    autoFixed: false,
                });
                if (sv > 0) anomalies.push({
                    check: 'VitalsOrders PENDING vencidas (>4h)',
                    count: sv,
                    autoFixed: false,
                });

                // Anomalías globales filtradas por HQ
                if (orphanedFamily.status === 'fulfilled') {
                    const hqOrph = (orphanedFamily.value as any[]).filter((f: any) => f.headquartersId === hq.id);
                    if (hqOrph.length > 0) anomalies.push({
                        check: 'FamilyMember sin Patient válido',
                        count: hqOrph.length,
                        autoFixed: false,
                    });
                }
                if (nullScheduleTimes.status === 'fulfilled') {
                    const hqNull = (nullScheduleTimes.value as any[]).filter(
                        (m: any) => m.patient?.headquartersId === hq.id
                    );
                    if (hqNull.length > 0) anomalies.push({
                        check: 'PatientMedication ACTIVE sin scheduleTimes',
                        count: hqNull.length,
                        autoFixed: false,
                    });
                }
                if (staleIntake.status === 'fulfilled') {
                    const hqStale = (staleIntake.value as any[]).filter(
                        (i: any) => i.patient?.headquartersId === hq.id
                    );
                    if (hqStale.length > 0) anomalies.push({
                        check: 'IntakeData PENDIENTE_REVISION >7 días sin actualizar',
                        count: hqStale.length,
                        autoFixed: false,
                    });
                }

                if (anomalies.length === 0) return;

                totalAnomalies += anomalies.length;
                globalReport[hq.id] = anomalies;

                // ── Mensajes explicativos por tipo de anomalía ──────────
                type MsgDef = { title: (n: number) => string; message: (n: number) => string; link: string };

                const anomalyDefs: Record<string, MsgDef> = {
                    'FastActions expiradas cerradas automáticamente': {
                        title: (n) => `✅ ${n} tarea${n !== 1 ? 's' : ''} expirada${n !== 1 ? 's' : ''} cerrada${n !== 1 ? 's' : ''} automáticamente`,
                        message: (n) => `Causa: ${n} tarea${n !== 1 ? 's' : ''} de acción rápida pasaron su fecha límite sin completarse.\nAcción aplicada: marcadas como FAILED automáticamente por el monitor.\nSin acción requerida.`,
                        link: '/care/supervisor',
                    },
                    'Notificaciones antiguas limpiadas automáticamente': {
                        title: (n) => `✅ ${n} notificación${n !== 1 ? 'es' : ''} antigua${n !== 1 ? 's' : ''} limpiada${n !== 1 ? 's' : ''} automáticamente`,
                        message: (n) => `Causa: ${n} notificación${n !== 1 ? 'es' : ''} acumulada${n !== 1 ? 's' : ''} sin leer por más de 48 horas.\nAcción aplicada: marcadas como leídas para mantener el sistema limpio.\nSin acción requerida.`,
                        link: '/corporate',
                    },
                    'complianceScore corregido al rango 0-100': {
                        title: (n) => `✅ ${n} score${n !== 1 ? 's' : ''} de cumplimiento corregido${n !== 1 ? 's' : ''} automáticamente`,
                        message: (n) => `Causa: ${n} usuario${n !== 1 ? 's' : ''} tenía${n !== 1 ? 'n' : ''} un complianceScore fuera del rango válido (0-100), probablemente por misiones o bonos que sumaron puntos en exceso.\nAcción aplicada: ajustado${n !== 1 ? 's' : ''} al límite de 100 automáticamente.\nSin acción requerida.`,
                        link: '/hr',
                    },
                    'ShiftSession zombi detectada': {
                        title: (n) => `⚠️ ${n} turno${n !== 1 ? 's' : ''} zombi detectado${n !== 1 ? 's' : ''} (>14h abierto${n !== 1 ? 's' : ''})`,
                        message: (n) => `Causa: ${n} cuidador${n !== 1 ? 'es' : ''} no cerró${n !== 1 ? 'ron' : ''} sesión de turno correctamente hace más de 14 horas.\nAcción requerida: Ir a /care/supervisor → "Turnos Activos" y cerrar manualmente los turnos huérfanos.`,
                        link: '/care/supervisor',
                    },
                    'Patients ACTIVE sin colorGroup asignado': {
                        title: (n) => `⚠️ ${n} residente${n !== 1 ? 's' : ''} sin color de ruta asignado`,
                        // Fix (jun-2026): el colorGroup del Patient se edita en el perfil
                        // del residente (/corporate/medical/patients/[id] → modo edición),
                        // NO en el Schedule Builder. El link viejo (/hr/schedule) mandaba
                        // al lugar equivocado y el usuario terminaba en el builder de
                        // horarios sin poder resolver el problema.
                        message: (n) => `Causa: ${n} residente${n !== 1 ? 's' : ''} activo${n !== 1 ? 's' : ''} no tiene${n !== 1 ? 'n' : ''} colorGroup configurado (UNASSIGNED).\nAcción requerida: Ir al directorio de residentes (/corporate/medical/patients), abrir el perfil de cada residente afectado y asignar el color de ruta desde la edición del perfil.`,
                        link: '/corporate/medical/patients',
                    },
                    'VitalsOrders PENDING vencidas (>4h)': {
                        title: (n) => `⚠️ ${n} orden${n !== 1 ? 'es' : ''} de vitales vencida${n !== 1 ? 's' : ''} sin completar`,
                        message: (n) => `Causa: ${n} orden${n !== 1 ? 'es' : ''} de signos vitales lleva${n !== 1 ? 'n' : ''} más de 4 horas en estado PENDING sin registrarse.\nAcción requerida: Verificar en /care/supervisor si los residentes afectados tienen vitales pendientes y tomarlos o cancelar la orden.`,
                        link: '/care/supervisor',
                    },
                    'FamilyMember sin Patient válido': {
                        title: (n) => `⚠️ ${n} familiar${n !== 1 ? 'es' : ''} vinculado${n !== 1 ? 's' : ''} a residentes inexistentes`,
                        message: (n) => `Causa: ${n} cuenta${n !== 1 ? 's' : ''} de familiar${n !== 1 ? 'es' : ''} apunta${n !== 1 ? 'n' : ''} a un Patient que fue eliminado o nunca existió en la base de datos.\nAcción requerida: Ir a /corporate/medical/patients y revisar los registros de familiares para limpiar o reasignar.`,
                        link: '/corporate/medical/patients',
                    },
                    'PatientMedication ACTIVE sin scheduleTimes': {
                        title: (n) => `⚠️ ${n} medicamento${n !== 1 ? 's' : ''} sin horario de administración`,
                        message: (n) => `Causa: ${n} medicación${n !== 1 ? 'es' : ''} activa${n !== 1 ? 's' : ''} no tiene${n !== 1 ? 'n' : ''} horario configurado (scheduleTimes vacío).\nAcción requerida: Ir al catálogo médico en /corporate/medical y configurar los horarios de administración faltantes.`,
                        link: '/corporate/medical/catalog',
                    },
                    'IntakeData PENDIENTE_REVISION >7 días sin actualizar': {
                        title: (n) => `⚠️ ${n} ingreso${n !== 1 ? 's' : ''} pendiente${n !== 1 ? 's' : ''} sin actualizar en >7 días`,
                        message: (n) => `Causa: ${n} residente${n !== 1 ? 's' : ''} lleva${n !== 1 ? 'n' : ''} más de 7 días con su ficha de ingreso en estado PENDING sin avanzar.\nAcción requerida: Ir a /corporate/patients/intake y completar o cancelar el proceso de ingreso estancado.`,
                        link: '/corporate/patients/intake',
                    },
                };

                // ── Enviar 1 notificación por anomalía ─────────────────
                // La limpieza de notificaciones NO se anuncia con otra
                // notificación: es ruido sobre ruido (una campana avisando que
                // se limpió la campana). Queda registrada en el SystemAuditLog
                // de abajo, que es donde pertenece.
                await Promise.allSettled(
                    anomalies
                        .filter(a => a.check !== 'Notificaciones antiguas limpiadas automáticamente')
                        .map(a => {
                        const def = anomalyDefs[a.check];
                        const title   = def ? def.title(a.count)   : `${a.autoFixed ? '✅' : '⚠️'} ${a.check}`;
                        const message = def ? def.message(a.count) : `${a.count} caso${a.count !== 1 ? 's' : ''} en ${hq.name}.`;
                        const link    = def ? def.link : '/corporate';

                        return notifyRoles(hq.id, ['DIRECTOR', 'ADMIN', 'SUPER_ADMIN'], {
                            type: 'SHIFT_ALERT',
                            title,
                            message,
                            link,
                        });
                    })
                );

                // ── Crear SystemAuditLog ────────────────────────────────
                await prisma.systemAuditLog.create({
                    data: {
                        headquartersId: hq.id,
                        entityName: 'HealthMonitor',
                        entityId: `health_${hq.id}_${now.toISOString().slice(0, 13)}`,
                        action: SystemAuditAction.AUDIT_REPORT_SENT,
                        clientIp: 'SystemCRON',
                        payloadChanges: JSON.parse(JSON.stringify({
                            anomaliesDetected: anomalies.length,
                            autoFixed: anomalies.filter(a => a.autoFixed).length,
                            checks: anomalies,
                            runAt: now.toISOString(),
                        })),
                    },
                });
            })
        );

        const dupCount = dupeEmails.status === 'fulfilled' ? (dupeEmails.value as any[]).length : 0;

        // ── VERIFICACIONES DE VERACIDAD ──────────────────────────────────
        // El health-monitor llevaba meses encontrando anomalias y devolviendolas
        // en un JSON que solo leia Vercel. Aqui es donde el sistema deja de
        // hablar consigo mismo: corre los checks de veracidad y le escribe a
        // direccion. Ver src/lib/verificaciones.ts.
        const veracidad: Record<string, { hallazgos: number; correoEnviado: boolean }> = {};
        for (const hq of headquarters) {
            try {
                const hallazgos = await verificarSede(hq.id);
                let enviado = false;
                if (hallazgos.length) {
                    const directores = await prisma.user.findMany({
                        where: { headquartersId: hq.id, role: { in: ['DIRECTOR', 'ADMIN'] }, isActive: true },
                        select: { email: true },
                    });
                    enviado = await enviarResumen(
                        hq.name,
                        directores.map(d => d.email).filter(Boolean),
                        hallazgos,
                    );
                }
                veracidad[hq.name] = { hallazgos: hallazgos.length, correoEnviado: enviado };
                totalAnomalies += hallazgos.reduce((a, h) => a + h.total, 0);
            } catch (e) {
                // Una verificacion rota no puede tumbar el monitor entero.
                console.error(`[health-monitor] verificaciones ${hq.name}:`, e);
                veracidad[hq.name] = { hallazgos: -1, correoEnviado: false };
            }
        }

        return NextResponse.json({
            ok: true,
            message: 'Health Monitor completado.',
            veracidad,
            runAt: now.toISOString(),
            headquartersScanned: headquarters.length,
            totalAnomalies,
            globalChecks: { duplicateFamilyEmails: dupCount },
            reportByHq: globalReport,
        });

    } catch (error: any) {
        console.error('[cron/health-monitor] error:', error);
        return NextResponse.json(
            { error: 'Fallo interno en Health Monitor', detail: error.message },
            { status: 500 }
        );
    }
}
