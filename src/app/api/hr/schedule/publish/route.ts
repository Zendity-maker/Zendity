import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { asignarPorPrimerTurnoDeNoche } from '@/lib/academy-assign';
import sgMail from '@sendgrid/mail';
import { emailLogoSrc } from '@/lib/email-logo';
import { requireRole } from '@/lib/api-auth';

// Publicar horarios (y notificar al equipo por email) es operación de gestión.
const MANAGE_ROLES = ['DIRECTOR', 'ADMIN', 'SUPERVISOR'];

if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

/**
 * LAS SIETE, NO TRES.
 *
 * Este mapa tenía solo MORNING, EVENING y NIGHT. Los otros cuatro caían al
 * `|| s.shiftType` y salían como el código crudo en inglés.
 *
 * Medido sobre el correo de la semana del 07-sep-2026: 28 de 84 filas, un
 * TERCIO del correo. La cuidadora recibía la palabra "OFF" con la columna de
 * grupo en blanco donde debía leer "Día libre" — y el día libre es el tipo de
 * turno más usado del sistema: 424 de 1 387.
 *
 * Mismas etiquetas que el constructor. Si se añade un tipo allí, va aquí.
 */
const SHIFT_LABELS: Record<string, string> = {
    MORNING:        'Diurno 6:00 AM – 2:00 PM',
    EVENING:        'Vespertino 2:00 PM – 10:00 PM',
    NIGHT:          'Nocturno 10:00 PM – 6:00 AM',
    FULL_DAY:       'Turno largo 6:00 AM – 6:00 PM',
    FULL_NIGHT:     'Turno largo 6:00 PM – 6:00 AM',
    SUPERVISOR_DAY: 'Supervisión 9:00 AM – 6:00 PM',
    OFF:            'Día libre',
};

const COLOR_LABELS: Record<string, string> = {
    RED: 'Grupo Rojo',
    YELLOW: 'Grupo Amarillo',
    GREEN: 'Grupo Verde',
    BLUE: 'Grupo Azul',
    ALL: 'Todos los grupos',
};

/**
 * Lo que lleva la persona ese día, en una línea.
 *
 * Un día libre no lleva grupo, y la supervisión de piso tampoco — pero por
 * razones distintas: una no trabaja y la otra trabaja sin ser dueña de un
 * grupo. Antes las dos salían con la casilla vacía, que se lee como un olvido.
 */
function etiquetaDeGrupo(s: { shiftType: string; colorGroup: string | null; isFloorSupervision: boolean }): string | null {
    if (s.shiftType === 'OFF') return null;
    if (s.isFloorSupervision) return 'Supervisión de piso';
    if (!s.colorGroup) return null;
    return COLOR_LABELS[s.colorGroup] ?? s.colorGroup;
}

/** El horario real del turno: el fijo, o las horas que se le pusieron a mano. */
function etiquetaDeTurno(s: {
    shiftType: string; isManual: boolean;
    customStartTime: Date | null; customEndTime: Date | null; customDescription: string | null;
}): string {
    if (s.isManual && s.customStartTime && s.customEndTime) {
        const hora = (d: Date) => d.toLocaleTimeString('es-PR', {
            hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Puerto_Rico',
        });
        const rango = `${hora(s.customStartTime)} – ${hora(s.customEndTime)}`;
        return s.customDescription ? `${s.customDescription} · ${rango}` : rango;
    }
    return SHIFT_LABELS[s.shiftType] ?? s.shiftType;
}

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

    // OFF (día libre planificado) salta TODAS las validaciones operativas — no es
    // un turno de trabajo, así que no aplica color/duplicados/etc.
    const workShifts = shifts.filter(s => s.shiftType !== 'OFF');

    // REGLA 1 — ALL en turno no nocturno (advertencia)
    for (const s of workShifts) {
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
    //   SIN VALIDACIÓN → SUPERVISOR: por DISEÑO operacional no tienen color
    //                    asignado en el horario. Cuando cubren un grupo
    //                    (cuidadora ausente), eligen el color en la tablet
    //                    con "cambiar grupo". El aviso histórico se removió
    //                    el 2-jun-2026: aparecía cada semana, hacía que el
    //                    director cancelara el publish creyendo que era un
    //                    error, y dejaba el schedule en DRAFT.
    //   SIN VALIDACIÓN → CLEANING, ADMIN, DIRECTOR, INVESTOR
    for (const s of workShifts) {
        const role = s.user?.role ?? '';
        if (s.colorGroup) continue;                          // tiene color → ok
        // Supervisión de piso declarada: la ausencia de color es intencional y
        // el horario lo dice. Se exime por el CAMPO, no por el rol, para que
        // valga también cuando quien supervisa no tiene rol SUPERVISOR.
        if (s.isFloorSupervision) continue;
        if (NO_COLOR_ROLES.includes(role)) continue;         // roles exentos → ignorar
        if (SUPERVISOR_ROLES.includes(role)) continue;       // supervisor sin color → normal

        if (CARE_ROLES.includes(role)) {
            errors.push({
                type: 'NULL_COLOR_CAREGIVER',
                message: `${s.user?.name ?? 'Empleado'} no tiene color de grupo asignado el ${new Date(s.date).toLocaleDateString('es-PR')}. Los cuidadores y enfermeras deben tener un color.`,
                shift: { id: s.id, name: s.user?.name, date: s.date, role },
            });
        }
    }

    // REGLA 3 — Mismo empleado, mismo día, colores distintos (advertencia)
    const byUserDate = new Map<string, any[]>();
    for (const s of workShifts) {
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
        const auth = await requireRole(MANAGE_ROLES);
        if (auth instanceof NextResponse) return auth;

        const body = await req.json();
        const { scheduleId, force = false } = body;

        if (!scheduleId) {
            return NextResponse.json({ success: false, error: 'scheduleId requerido' }, { status: 400 });
        }

        // Ownership: el horario debe pertenecer a la sede del invocador (anti cross-tenant).
        const owned = await prisma.schedule.findFirst({
            where: { id: scheduleId, headquartersId: auth.headquartersId },
            select: { id: true },
        });
        if (!owned) {
            return NextResponse.json({ success: false, error: 'Horario no encontrado' }, { status: 404 });
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
            /**
             * Su primera noche: el curso que la explica.
             *
             * Best-effort y sin await bloqueante del resto: publicar el horario
             * no se revierte porque una asignacion de curso falle. La funcion es
             * idempotente, asi que puede correr en cada publicacion.
             */
            if (shifts.some(s => NIGHT_SHIFTS.includes(s.shiftType))) {
                notificationPromises.push(
                    asignarPorPrimerTurnoDeNoche({
                        hqId: schedule.headquartersId,
                        userId,
                        assignedByUserId: auth.id,
                    })
                );
            }

            // La misma lectura que el correo. Antes un día libre salía aquí como
            // "OFF (null)" porque el grupo no existe para un día que no se trabaja.
            const shiftsText = [...shifts]
                .sort((a, b) => a.date.getTime() - b.date.getTime())
                .map(s => {
                    const grupo = etiquetaDeGrupo(s);
                    const nota = s.notes ? ` · Nota: ${s.notes}` : '';
                    return `${formatDate(s.date)} — ${etiquetaDeTurno(s)}${grupo ? ` (${grupo})` : ''}${nota}`;
                }).join('\n');

            notificationPromises.push(
                prisma.notification.create({
                    data: {
                        userId,
                        type: 'SCHEDULE_PUBLISHED',
                        title: `Tu horario del ${weekStart} al ${weekEnd}`,
                        message: `${hqName} publicó tu horario.\n\n${shiftsText}`,
                        isRead: false
                    }
                }).catch(() => null)
            );

            if (user.email && process.env.SENDGRID_API_KEY) {
                /**
                 * ES UN CORREO DEL HOGAR, NO DE LA PLATAFORMA.
                 *
                 * Este era el único correo del sistema que se salía del patrón
                 * de casa: ponía "ZENDITY — Healthcare Management Platform" en
                 * la cabecera, con otra paleta que las diez rutas que ya usan
                 * `emailLogoSrc`. Quien lo abre trabaja para el hogar; Zéndity
                 * es la herramienta con la que se lo mandan, y va al pie.
                 *
                 * Y NO ES UNA TABLA. Cuatro columnas no caben en un teléfono, y
                 * la de notas enseñaba "—" en casi todas las filas: un cuarto
                 * del ancho para no decir nada. Una fila por día, y la nota
                 * debajo de su día solo cuando existe.
                 */
                const ordenados = [...shifts].sort((a, b) => a.date.getTime() - b.date.getTime());
                const trabaja = ordenados.filter(s => s.shiftType !== 'OFF');
                const libres  = ordenados.filter(s => s.shiftType === 'OFF');
                const primero = trabaja[0];

                const filas = ordenados.map(s => {
                    const esLibre = s.shiftType === 'OFF';
                    const grupo = etiquetaDeGrupo(s);
                    const nota = s.notes && s.notes.trim()
                        ? `<div style="margin:6px 0 0;padding:8px 12px;background:#FFFBEB;border-left:3px solid #E5A93D;border-radius:6px;color:#78350F;font-size:13px;">${s.notes.trim()}</div>`
                        : '';
                    return `
                    <tr>
                      <td style="padding:14px 0;border-bottom:1px solid #E7E5E4;">
                        <div style="font-size:13px;font-weight:700;color:${esLibre ? '#78716C' : '#1F2D3A'};text-transform:capitalize;">${formatDate(s.date)}</div>
                        <div style="margin-top:4px;">
                          <span style="display:inline-block;font-size:14px;font-weight:${esLibre ? '600' : '700'};color:${esLibre ? '#78716C' : '#0F6B78'};">${etiquetaDeTurno(s)}</span>
                          ${grupo ? `<span style="display:inline-block;margin-left:8px;background:#EAF4F5;color:#0F6B78;font-weight:700;padding:2px 10px;border-radius:20px;font-size:12px;">${grupo}</span>` : ''}
                        </div>
                        ${nota}
                      </td>
                    </tr>`;
                }).join('');

                // Lo primero que quiere saber quien abre esto en el teléfono.
                const resumen = trabaja.length === 0
                    ? 'Esta semana no tienes turnos asignados.'
                    : `Esta semana trabajas <strong>${trabaja.length} ${trabaja.length === 1 ? 'día' : 'días'}</strong>`
                      + (libres.length ? ` y libras <strong>${libres.length}</strong>.` : '.')
                      + (primero ? ` Tu primer turno es el <strong>${formatDate(primero.date)}</strong>, ${etiquetaDeTurno(primero).toLowerCase()}.` : '');

                const logo = emailLogoSrc(schedule.headquartersId, schedule.headquarters?.logoUrl);

                const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#F5F5F4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:24px auto;background:#FFFFFF;border-radius:14px;overflow:hidden;border:1px solid #C9D4D8;">

    <div style="background:#1F2D3A;padding:24px;text-align:center;border-bottom:4px solid #0F6B78;">
      ${logo
        ? `<img src="${logo}" alt="${hqName}" style="max-height:52px;border-radius:8px;" />`
        : `<h2 style="color:#FFFFFF;margin:0;font-size:22px;font-weight:800;">${hqName}</h2>`}
      <p style="color:#3CC6C4;margin:8px 0 0;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;">Tu horario de la semana</p>
    </div>

    <div style="padding:28px 24px;color:#1F2D3A;line-height:1.6;">
      <p style="margin:0 0 6px;font-size:16px;"><strong>${user.name}</strong>,</p>
      <p style="margin:0 0 20px;font-size:15px;color:#44403C;">${resumen}</p>

      <table style="width:100%;border-collapse:collapse;">${filas}</table>

      ${trabaja.length > 0 ? `
      <div style="margin-top:24px;padding:14px 16px;background:#EAF4F5;border-radius:8px;border-left:4px solid #0F6B78;">
        <p style="margin:0;color:#0F6B78;font-size:13px;">Al ponchar tu turno, el sistema te asigna tu grupo de residentes según este horario. No hay que hacer nada más.</p>
      </div>` : ''}

      <div style="margin-top:24px;text-align:center;">
        <a href="https://app.zendity.com" style="background:#0F6B78;color:#FFFFFF;padding:13px 30px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;display:inline-block;">Ver mi horario</a>
      </div>
    </div>

    <div style="background:#F5F5F4;padding:16px 24px;text-align:center;border-top:1px solid #E7E5E4;">
      <p style="margin:0;color:#57534E;font-size:12px;">Horario publicado por la administración de ${hqName}.</p>
      <p style="margin:4px 0 0;color:#78716C;font-size:12px;">Si algo no cuadra, habla con tu supervisora antes del turno.</p>
      <p style="margin:12px 0 0;font-size:10px;font-weight:700;color:#0F6B78;text-transform:uppercase;letter-spacing:0.5px;">Tecnología impulsada por Zéndity</p>
    </div>
  </div></body></html>`;

                emailPromises.push(
                    sgMail.send({
                        to: user.email,
                        from: { email: process.env.SENDGRID_FROM_EMAIL || 'notificaciones@zendity.com', name: hqName },
                        subject: `Tu horario del ${weekStart} al ${weekEnd}`,
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
