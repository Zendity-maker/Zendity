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

function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-PR', { weekday: 'long', month: 'long', day: 'numeric' });
}

export async function POST(req: Request) {
    try {
        const { scheduleId } = await req.json();
        if (!scheduleId) {
            return NextResponse.json({ success: false, error: 'scheduleId requerido' }, { status: 400 });
        }

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
            const shiftsText = shifts.map(s =>
                `${formatDate(s.date)} — ${SHIFT_LABELS[s.shiftType] || s.shiftType} (${COLOR_LABELS[s.colorGroup] || s.colorGroup})`
            ).join('\n');

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
                        from: { email: 'noreply@zendity.com', name: `${hqName} via Zendity` },
                        subject: `Tu horario esta listo — semana del ${weekStart}`,
                        html
                    }).catch(e => console.error(`Email error for ${user.email}:`, e))
                );
            }
        }

        await Promise.all([...notificationPromises, ...emailPromises]);

        return NextResponse.json({ success: true, schedule, notified: byUser.size });

    } catch (error) {
        console.error('Publish error:', error);
        return NextResponse.json({ success: false, error: 'Error publicando horario' }, { status: 500 });
    }
}
