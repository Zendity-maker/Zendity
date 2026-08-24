import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { logError } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/hr/staff/[id]/attendance?days=90
 *
 * Historial de asistencia de un empleado: turnos programados, ausencias con su
 * motivo, y si avisó o no.
 *
 * Existe porque los datos estaban pero no se veían: para saber que una
 * cuidadora acumulaba 4 ausencias —dos en días consecutivos— había que
 * consultar la base directamente. En su perfil no aparecía nada, así que el
 * supervisor no tenía cómo entrar a esa conversación con hechos.
 *
 * La ventana por defecto son 90 días; el umbral disciplinario mira 30, y se
 * devuelve por separado para que la vista distinga "patrón vigente" de
 * "histórico".
 *
 * Auth: SUPERVISOR/DIRECTOR/ADMIN — mismo alcance que marcar la ausencia.
 */

const ALLOWED_ROLES = ['SUPERVISOR', 'DIRECTOR', 'ADMIN', 'HR_MANAGER'];

/** Debe coincidir con el umbral del endpoint que marca ausencias. */
const PATTERN_WINDOW_DAYS = 30;
const PATTERN_THRESHOLD = 3;

const REASON_LABELS: Record<string, string> = {
    SICK: 'Enfermedad',
    FAMILY_EMERGENCY: 'Emergencia familiar',
    MEDICAL_APPOINTMENT: 'Cita médica',
    PERSONAL: 'Asunto personal',
    NO_SHOW: 'No se presentó',
    OTHER: 'Otro',
};

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;
        const hqId = auth.headquartersId;

        const { id } = await params;
        const { searchParams } = new URL(req.url);
        const days = Math.min(Math.max(parseInt(searchParams.get('days') || '90', 10) || 90, 7), 365);

        // Ownership: el empleado debe ser de la sede del invocador.
        const empleado = await prisma.user.findFirst({
            where: { id, headquartersId: hqId, isDeleted: false },
            select: { id: true, name: true },
        });
        if (!empleado) {
            return NextResponse.json({ success: false, error: 'Empleado no encontrado en tu sede' }, { status: 404 });
        }

        const now = new Date();
        const desde = new Date(now.getTime() - days * 24 * 3600 * 1000);
        const ventanaPatron = new Date(now.getTime() - PATTERN_WINDOW_DAYS * 24 * 3600 * 1000);

        const turnos = await prisma.scheduledShift.findMany({
            where: {
                userId: id,
                date: { gte: desde },
                schedule: { headquartersId: hqId },
            },
            select: {
                id: true, date: true, shiftType: true, colorGroup: true,
                isAbsent: true, absentMarkedAt: true, absenceReason: true,
                absenceNotified: true, absenceNotes: true, absentClearedAt: true,
            },
            orderBy: { date: 'desc' },
        });

        const ausencias = turnos.filter(t => t.isAbsent);
        const sinAviso = ausencias.filter(a => !a.absenceNotified);
        const enVentana = sinAviso.filter(a => a.date >= ventanaPatron);

        // Desglose por motivo — los registros previos al campo salen como
        // "sin registrar", no se les inventa una categoría.
        const porMotivo: Record<string, number> = {};
        for (const a of ausencias) {
            const k = a.absenceReason ?? 'SIN_REGISTRAR';
            porMotivo[k] = (porMotivo[k] || 0) + 1;
        }

        // Ausencias en días consecutivos: dos turnos seguidos sin avisar es una
        // señal distinta a dos ausencias sueltas en el mes.
        const fechas = [...new Set(ausencias.map(a => a.date.toISOString().slice(0, 10)))].sort();
        const rachas: string[][] = [];
        let actual: string[] = [];
        for (let i = 0; i < fechas.length; i++) {
            if (i === 0) { actual = [fechas[i]]; continue; }
            const prev = new Date(fechas[i - 1] + 'T00:00:00Z').getTime();
            const cur = new Date(fechas[i] + 'T00:00:00Z').getTime();
            if (cur - prev === 86400000) actual.push(fechas[i]);
            else { if (actual.length > 1) rachas.push(actual); actual = [fechas[i]]; }
        }
        if (actual.length > 1) rachas.push(actual);

        const programados = turnos.length;
        const tasaAusencia = programados > 0
            ? Math.round((ausencias.length / programados) * 1000) / 10
            : 0;

        return NextResponse.json({
            success: true,
            empleado: { id: empleado.id, name: empleado.name.trim() },
            ventanaDias: days,
            resumen: {
                turnosProgramados: programados,
                ausencias: ausencias.length,
                sinAviso: sinAviso.length,
                conAviso: ausencias.length - sinAviso.length,
                tasaAusenciaPct: tasaAusencia,
                revertidas: turnos.filter(t => t.absentClearedAt).length,
            },
            patron: {
                ventanaDias: PATTERN_WINDOW_DAYS,
                umbral: PATTERN_THRESHOLD,
                sinAvisoEnVentana: enVentana.length,
                // Cuántas faltan para que el sistema genere la observación
                // disciplinaria automática.
                faltanParaObservacion: Math.max(0, PATTERN_THRESHOLD - enVentana.length),
                yaSupera: enVentana.length >= PATTERN_THRESHOLD,
            },
            diasConsecutivos: rachas,
            porMotivo: Object.entries(porMotivo).map(([k, n]) => ({
                motivo: k,
                label: REASON_LABELS[k] ?? 'Sin registrar',
                cantidad: n,
            })).sort((a, b) => b.cantidad - a.cantidad),
            detalle: ausencias.map(a => ({
                id: a.id,
                fecha: a.date.toISOString(),
                turno: a.shiftType,
                colorGroup: a.colorGroup,
                motivo: a.absenceReason,
                motivoLabel: a.absenceReason ? REASON_LABELS[a.absenceReason] : null,
                avisoPrevio: a.absenceNotified,
                nota: a.absenceNotes,
                marcadaEl: a.absentMarkedAt?.toISOString() ?? null,
            })),
        });
    } catch (err: any) {
        logError('hr.staff.attendance', err);
        return NextResponse.json({ success: false, error: 'Error cargando asistencia' }, { status: 500 });
    }
}
