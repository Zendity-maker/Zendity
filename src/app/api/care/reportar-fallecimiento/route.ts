/**
 * REPORTAR UN FALLECIMIENTO
 * ─────────────────────────
 * NO declara nada. Saca al residente del piso en el momento y avisa a
 * dirección; el cierre formal del expediente sigue siendo de DIRECTOR y ADMIN.
 *
 * POR QUÉ EXISTE. Fernando González falleció el 4-sep-2026 y en el sistema
 * siguió ACTIVO, o sea en la lista de tareas de la cuidadora, que pide baño,
 * comidas y rotaciones de cada residente activo. Comprobado el mismo día: 0 de
 * 32 residentes activos tienen 48 horas sin registro. Nadie deja huecos.
 *
 * Así que quien estaba de turno tenía tres opciones: inventar un baño que no
 * ocurrió, dejar el hueco, o sacarlo del piso. ELIGIERON NO FALSIFICAR — usaron
 * el único botón que su rol les daba, el de hospitalización, y el expediente
 * quedó con "[TRASLADO HOSPITALARIO DE EMERGENCIA] Motivo: Fallecio pasiente".
 *
 * Respetaron la regla del hogar —que se registre el baño cuando se dé el baño—
 * con la herramienta equivocada, porque la correcta no existía. Esto es la
 * correcta.
 *
 * Entre las 11:47 en que se supo y el cierre formal pasaron horas en las que el
 * sistema seguía pidiendo cuidados de una persona que ya no estaba, y contando
 * su cuota.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { notifyRoles } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

/**
 * Quién puede REPORTAR. Deliberadamente más amplio que quién puede DECLARAR
 * (DIRECTOR y ADMIN): quien está en el piso a las once de la mañana es una
 * supervisora o una enfermera, y es quien lo sabe primero.
 */
const PUEDEN_REPORTAR = ['NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN'];

export async function POST(req: Request) {
    const auth = await requireRole(PUEDEN_REPORTAR);
    if (auth instanceof NextResponse) return auth;

    try {
        const body = await req.json().catch(() => ({}));
        const patientId = String(body.patientId ?? '').trim();
        const nota = String(body.nota ?? '').trim();

        if (!patientId) {
            return NextResponse.json({ success: false, error: 'Falta el residente' }, { status: 400 });
        }

        const paciente = await prisma.patient.findFirst({
            where: { id: patientId, headquartersId: auth.headquartersId },
            select: { id: true, name: true, status: true, fallecimientoReportadoAt: true },
        });
        if (!paciente) {
            return NextResponse.json({ success: false, error: 'Residente no encontrado' }, { status: 404 });
        }
        if (paciente.status === 'DECEASED' || paciente.status === 'DISCHARGED') {
            return NextResponse.json({ success: false, error: 'Este expediente ya está cerrado.' }, { status: 409 });
        }
        if (paciente.fallecimientoReportadoAt) {
            return NextResponse.json({ success: false, error: 'Ya fue reportado.' }, { status: 409 });
        }

        const ahora = new Date();

        /**
         * `TEMPORARY_LEAVE` con un `leaveType` propio.
         *
         * Es fontanería, no la verdad: saca al residente de las 79 consultas
         * que filtran por ACTIVE —que es lo que quita las tareas del piso— por
         * un camino que ya funciona, sin inventar un estado nuevo que 42
         * consultas tratarían de forma distinta.
         *
         * La verdad de lo que pasó vive en los tres campos de abajo, y es lo
         * que la pantalla muestra. El cuarto NO se libera: eso lo decide quien
         * cierra el expediente, cuando la familia haya recogido las cosas.
         */
        await prisma.patient.update({
            where: { id: patientId },
            data: {
                status: 'TEMPORARY_LEAVE',
                leaveType: 'FALLECIMIENTO_REPORTADO',
                leaveDate: ahora,
                fallecimientoReportadoAt: ahora,
                fallecimientoReportadoPorId: auth.id,
                fallecimientoNota: nota || null,
            },
        });

        const hora = ahora.toLocaleTimeString('es-PR', { hour: '2-digit', minute: '2-digit' });
        const fecha = ahora.toLocaleDateString('es-PR', { weekday: 'long', day: 'numeric', month: 'long' });

        // Queda en la bitácora con su marcador propio. Lo lee el equipo, NO la
        // familia: el filtro de `isCleanNote` solo deja pasar notas sin
        // marcador y los mensajes aprobados.
        await prisma.dailyLog.create({
            data: {
                patientId,
                authorId: auth.id,
                notes: `[FALLECIMIENTO REPORTADO] Reportado por ${auth.name ?? 'personal'} el ${fecha} a las ${hora}.`
                    + (nota ? ` ${nota}` : '')
                    + ' Pendiente de cierre formal por dirección.',
                isClinicalAlert: true,
            },
        }).catch(e => console.error('Nota de fallecimiento:', e));

        // Dirección se entera ahora, no cuando entre a mirar.
        notifyRoles(auth.headquartersId, ['DIRECTOR', 'ADMIN'], {
            type: 'HR_OBSERVATION',
            title: `Fallecimiento reportado — ${paciente.name.trim()}`,
            message: `${auth.name ?? 'Personal'} reportó el fallecimiento de ${paciente.name.trim()} a las ${hora}. `
                + 'Ya no aparece en el piso. Falta el cierre formal del expediente.',
            link: `/corporate/medical/patients/${patientId}`,
        }, auth.id).catch(e => console.error('Aviso de fallecimiento:', e));

        return NextResponse.json({
            success: true,
            mensaje: `${paciente.name.trim()} ya no aparece en el piso. Dirección fue notificada para el cierre del expediente.`,
        });
    } catch (error) {
        console.error('Reportar fallecimiento error:', error);
        return NextResponse.json({ success: false, error: 'No se pudo reportar' }, { status: 500 });
    }
}
