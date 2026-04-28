import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import sgMail from '@sendgrid/mail';

if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

const SHIFT_LABELS: Record<string, string> = {
    MORNING: 'Diurno 6AM–2PM',
    EVENING: 'Vespertino 2PM–10PM',
    NIGHT: 'Nocturno 10PM–6AM'
};

const COLOR_LABELS: Record<string, string> = {
    RED: 'Grupo RED',
    YELLOW: 'Grupo YELLOW',
    GREEN: 'Grupo GREEN',
    BLUE: 'Grupo BLUE',
    ALL: 'Todos los grupos'
};

const NIGHT_SHIFTS      = ['NIGHT', 'FULL_NIGHT'];
const CARE_ROLES        = ['CAREGIVER', 'NURSE'];
const SUPERVISOR_ROLES  = ['SUPERVISOR'];
const NO_COLOR_ROLES    = ['CLEANING', 'ADMIN', 'DIRECTOR', 'INVESTOR'];

function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-PR', { weekday: 'long', month: 'long', day: 'numeric' });
}

// ── Tipos de validación ────────────────────────────────────────────────────────
interface ValidationIssue {
    type: string;
    message: string;
    shift: Record<string, any>;
}

function runValidations(shifts: any[]): { errors: ValidationIssue[]; warnings: ValidationIssue[] } {
    const errors: ValidationIssue[]   = [];
    const warnings: ValidationIssue[] = [];

    // REGLA 1 — ALL en turno no nocturno (advertencia)
    for (const s of shifts) {
        if (s.colorGroup === 'ALL' && !NIGHT_SHIFTS.includes(s.shiftType)) {
            warnings.push({
                type: 'ALL_NON_NIGHT',
                message: `${s.user?.name ?? 'Empleado'} tiene "Todos los colores" en turno ${SHIFT_LABELS[s.shiftType] ?? s.shiftType} (${new Date(s.date).toLocaleDateString('es-PR')}). Solo se recomienda en turno nocturno.`,
                shift: { id: s.id, name: s.user?.name, date: s.date, shiftType: s.shiftType },
            });
        }
    }

    // REGLA 2 — colorGroup null según rol
    //   ERROR CRÍTICO  → CAREGIVER / NURSE: deben tener color siempre
    //   ADVERTENCIA    → SUPERVISOR: puede iniciar sin color (lo selecciona en tablet)
    //   SIN VALIDACIÓN → CLEANING, ADMIN, DIRECTOR, INVESTOR
    for (const s of shifts) {
        const role = s.user?.role ?? '';
        if (s.colorGroup) continue;                         // tiene color → ok
        if (NO_COLOR_ROLES.includes(role)) continue;        // roles exentos → ignorar

        if (CARE_ROLES.includes(role)) {
            errors.push({
                type: 'NULL_COLOR_CAREGIVER',
                message: `${s.user?.name ?? 'Empleado'} no tiene color de grupo asignado el ${new Date(s.date).toLocaleDateString('es-PR')}. Los cuidadores y enfermeras deben tener un color.`,
                shift: { id: s.id, name: s.user?.name, date: s.date, role },
            });
        } else if (SUPERVISOR_ROLES.includes(role)) {
            warnings.push({
                type: 'NULL_COLOR_SUPERVISOR',
                message: `${s.user?.name ?? 'Supervisor'} (Supervisor) no tiene color asignado el ${new Date(s.date).toLocaleDateString('es-PR')}. Si cubre a un cuidador deberá seleccionar su color al iniciar turno en el tablet.`,
                shift: { id: s.id, name: s.user?.name, date: s.date, role },
            });
        }
    }

    // REGLA 3 — Mismo empleado, mismo día, colores distintos (advertencia)
    const byUserDate = new Map<string, any[]>();
    for (const s of shifts) {
        const key = `${s.userId}|${new Date(s.date).toDateString()}`;
        if (!byUserDate.has(key)) byUserDate.set(key, []);
        byUserDate.get(key)!.push(s);
    }
    for (const [, group] of byUserDate) {
        if (group.length > 1) {
            const colors = [...new Set(group.map((s: any) => s.colorGroup ?? 'Sin color'))];
            if (colors.length > 1) {
                warnings.push({
                    type: 'DUPLICATE_DIFFERENT_COLORS',
                    message: `${group[0].user?.name ?? 'Empleado'} tiene ${group.length} turnos el mismo día con colores distintos (${colors.join(', ')}). El sistema usará el primer turno encontrado.`,
                    shift: { name: group[0].user?.name, date: group[0].date, colors },
                });
            }
        }
    }

    return { errors, warnings };
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { scheduleId, force = false } = body;

        if (!scheduleId) {
            return NextResponse.json({ success: false, error: 'scheduleId requerido' }, { status: 400 });
        }

        // ── PASO 1: Cargar shifts del borrador para validar ────────────────────
        const shiftsForValidation = await prisma.scheduledShift.findMany({
            where: { scheduleId },
            include: { user: { select: { id: true, name: true, role: true } } },
        });

        const { errors, warnings } = runValidations(shiftsForValidation);

        // Errores críticos siempre bloquean (incluso con force=true)
        if (errors.length > 0) {
            return NextResponse.json({
                success: false,
                errors,
                warnings,
                message: 'Hay errores que deben corregirse antes de publicar.',
            }, { status: 400 });
        }

        // Solo advertencias y el director no confirmó → pedir confirmación
        if (warnings.length > 0 && !force) {
            return NextResponse.json({
                success: false,
                needsConfirmation: true,
                errors: [],
                warnings,
                message: 'Hay advertencias. Revisa antes de publicar.',
            }, { status: 200 });
        }

        // ── PASO 2: Sin bloqueos → publicar ───────────────────────────────────
        const schedule = await prisma.schedule.update({
            where: { id: scheduleId },
            data: { status: 'PUBLISHED', publishedAt: new Date() },
            include: {
                shifts: {
                    include: {
                        user: { select: { id: true, name: true, email: true, role: true } }
                    },
                    orderBy: [{ date: 'asc' }, { shiftType: 'asc' }]
                },
                headquarters: { select: { name: true, logoUrl: true } }
            }
        });

        const hqName = schedule.headquarters?.name || 'Zendity';
        const weekStart = new Date(schedule.weekStartDate).toLocaleDateString('es-PR', { month: 'long', day: 'numeric' });
        const weekEnd = new Date(new Date(schedule.weekStartDate).getTime() + 6 * 24 * 60 * 60 * 1000)
            .toLocaleDateString('es-PR', { month: 'long', day: 'numeric', year: 'numeric' });

        const byUser = new Map<string, { user: any; shifts: any[] }>();
        for (const shift of schedule.shifts) {
            if (!shift.user) continue;
            if (!byUser.has(shift.userId)) {
                byUser.set(shift.userId, { user: shift.user, shifts: [] });
            }
            byUser.get(shift.userId)!.shifts.push(shift);
        }

        const notificationPromises: Promise<any>[] = [];
        const emailPromises: Promise<any>[] = [];

        for (const [userId, { user, shifts }] of byUser) {
            const shiftsText = shifts.map(s => {
                const noteLine = s.notes ? ` · Nota: ${s.notes}` : '';
                return `${formatDate(s.date)} — ${SHIFT_LABELS[s.shiftType] || s.shiftType} (${COLOR_LABELS[s.colorGroup] || s.colorGroup})${noteLine}`;
            }).join('\n');

            notificationPromises.push(
                prisma.notification.create({
                    data: {
                        userId,
                        type: 'SCHEDULE_PUBLISHED',
                        title: `Horario publicado — semana del ${weekStart}`,
                        message: `Tu horario para la semana del ${weekStart} al ${weekEnd} ha sido publicado en ${hqName}.\n\n${shiftsText}`,
                        isRead: false
                    }
                }).catch(() => null)
            );

            if (user.email && process.env.SENDGRID_API_KEY) {
                const shiftsHtml = shifts.map(s => `
                    <tr>
                        <td style="padding:10px 16px;border-bottom:1px solid #E2E8F0;color:#1E293B;font-size:14px;">${formatDate(s.date)}</td>
                        <td style="padding:10px 16px;border-bottom:1px solid #E2E8F0;color:#64748B;font-size:14px;">${SHIFT_LABELS[s.shiftType] || s.shiftType}</td>
                        <td style="padding:10px 16px;border-bottom:1px solid #E2E8F0;font-size:14px;">
                            <span style="background:#E1F5EE;color:#0F6E56;font-weight:700;padding:3px 10px;border-radius:20px;font-size:12px;">${COLOR_LABELS[s.colorGroup] || s.colorGroup}</span>
                        </td>
                        <td style="padding:8px 16px;border-bottom:1px solid #E2E8F0;color:#666666;font-size:13px;font-style:italic;">${s.notes || '—'}</td>
                    </tr>`).join('');

                const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F8FAFC;font-family:Arial,sans-serif;">
                    <div style="max-width:560px;margin:32px auto;background:#FFFFFF;border-radius:12px;overflow:hidden;border:1px solid #E2E8F0;">
                        <div style="background:#1E293B;padding:24px 32px;">
                            <div style="color:#1D9E75;font-size:22px;font-weight:900;letter-spacing:2px;">ZENDITY</div>
                            <div style="color:#94A3B8;font-size:12px;margin-top:4px;">Healthcare Management Platform</div>
                        </div>
                        <div style="padding:32px;">
                            <h2 style="margin:0 0 8px;color:#1E293B;font-size:18px;">Tu horario esta listo</h2>
                            <p style="color:#64748B;font-size:14px;margin:0 0 24px;">Hola <strong>${user.name}</strong>, tu horario para la semana del <strong>${weekStart} al ${weekEnd}</strong> ha sido publicado en <strong>${hqName}</strong>.</p>
                            <table style="width:100%;border-collapse:collapse;border:1px solid #E2E8F0;border-radius:8px;overflow:hidden;">
                                <thead><tr style="background:#1E293B;">
                                    <th style="padding:10px 16px;text-align:left;color:#FFFFFF;font-size:12px;">FECHA</th>
                                    <th style="padding:10px 16px;text-align:left;color:#FFFFFF;font-size:12px;">TURNO</th>
                                    <th style="padding:10px 16px;text-align:left;color:#FFFFFF;font-size:12px;">GRUPO</th>
                                    <th style="padding:10px 16px;text-align:left;color:#FFFFFF;font-size:12px;">NOTAS</th>
                                </tr></thead>
                                <tbody>${shiftsHtml}</tbody>
                            </table>
                            <div style="margin-top:24px;padding:16px;background:#E1F5EE;border-radius:8px;border-left:4px solid #1D9E75;">
                                <p style="margin:0;color:#0F6E56;font-size:13px;">Al iniciar tu turno en Zendity, el sistema asignara tu grupo de residentes automaticamente segun este horario.</p>
                            </div>
                            <div style="margin-top:24px;text-align:center;">
                                <a href="https://app.zendity.com" style="background:#1D9E75;color:#FFFFFF;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">Abrir Zendity</a>
                            </div>
                        </div>
                        <div style="background:#F8FAFC;padding:16px 32px;text-align:center;border-top:1px solid #E2E8F0;">
                            <p style="margin:0;color:#94A3B8;font-size:12px;">${hqName} — Zendity Healthcare Management Platform</p>
                        </div>
                    </div></body></html>`;

                emailPromises.push(
                    sgMail.send({
                        to: user.email,
                        from: { email: process.env.SENDGRID_FROM_EMAIL || 'notificaciones@zendity.com', name: `${hqName} via Zendity` },
                        subject: `Tu horario esta listo — semana del ${weekStart}`,
                        html
                    }).catch(e => console.error(`Email error for ${user.email}:`, e))
                );
            }
        }

        await Promise.all([...notificationPromises, ...emailPromises]);

        return NextResponse.json({
            success: true,
            schedule,
            notified: byUser.size,
            publishedWithWarnings: warnings.length > 0,
            warnings,
        });

    } catch (error) {
        console.error('Publish error:', error);
        return NextResponse.json({ success: false, error: 'Error publicando horario' }, { status: 500 });
    }
}
