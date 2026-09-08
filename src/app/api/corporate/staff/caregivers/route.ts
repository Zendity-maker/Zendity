import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { ACTIVE_PRESENCE_MAX_HOURS } from '@/lib/shift-coverage';
import { resolveEffectiveHqId } from '@/lib/hq-resolver';

export async function GET(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // hqId resuelto desde la sesión: roles limitados → su sede (ignora ?hqId);
    // DIRECTOR/ADMIN validados contra DB. Antes: ?hqId del cliente sin validar.
    const hqId = await resolveEffectiveHqId(session, new URL(req.url).searchParams.get('hqId'));

    /**
     * QUIÉN ESTÁ EN PISO — cap deslizante de 16h, no la frontera de las 6am.
     *
     * Usaba `todayStartAST()`, que NO es la medianoche: devuelve el corte de
     * las 6:00 AM del día clínico. El turno diurno EMPIEZA a las 6:00, así que
     * cualquiera que ponche unos minutos antes caía fuera y quedaba invisible
     * para asignarle una tarea durante todo su turno. Y el turno nocturno
     * entero —que empieza la noche anterior— nunca aparecía.
     *
     * Caso real: Caridad Veras ponchó el 08-sep-2026 a las 5:53 AM. Siete
     * minutos antes del corte. Salía "online" en el panel de cubierta —que sí
     * usa el cap de 16h— y "fuera de turno" en Asignar Meta. Misma persona, dos
     * respuestas, porque eran dos definiciones distintas de estar en turno.
     *
     * ACTIVE_PRESENCE_MAX_HOURS es la fuente de verdad de la presencia y su
     * propio comentario lo dice: "NO usar boundary6amUtc del día clínico como
     * ancla — eso rompe a una caregiver NIGHT real que cruza las 6am".
     */
    const todayStart = new Date(Date.now() - ACTIVE_PRESENCE_MAX_HOURS * 60 * 60 * 1000);

    // Consultas en paralelo: staff + sesiones activas (ShiftSession.actualEndTime = null)
    const [staff, activeSessions] = await Promise.all([
        prisma.user.findMany({
            where: {
                headquartersId: hqId,
                isActive: true,
                role: { in: ['CAREGIVER', 'NURSE', 'SUPERVISOR'] },
            },
            select: { id: true, name: true, role: true },
        }),
        prisma.shiftSession.findMany({
            where: {
                headquartersId: hqId,
                actualEndTime: null,
                startTime: { gte: todayStart },
            },
            select: { caregiverId: true },
        }),
    ]);

    const activeIds = new Set(activeSessions.map(s => s.caregiverId));

    return NextResponse.json({
        onShift: staff.filter(s => activeIds.has(s.id)),
        offShift: staff.filter(s => !activeIds.has(s.id)),
        // Backward compatibility: TaskAssignmentButton also reads .caregivers
        caregivers: staff.map(s => ({ ...s, isOnShift: activeIds.has(s.id) })),
    });
}
