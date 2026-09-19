import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, type SessionUser } from '@/lib/api-auth';

const ALLOWED_ROLES = ['DIRECTOR', 'ADMIN', 'SUPERVISOR', 'NURSE', 'HR_MANAGER'];

/**
 * QUIÉN ENTRA POR LA PUERTA DE RRHH Y NADA MÁS.
 *
 * Misma prueba que en /api/hr/performance. Copiada a propósito: consolidarla en
 * src/lib/rrhh-sin-phi.ts toca ficheros fuera de este cambio.
 */
const ROLES_CON_ACCESO_AL_PISO = [
    'DIRECTOR', 'ADMIN', 'SUPER_ADMIN', 'HQ_OWNER',
    'SUPERVISOR', 'NURSE', 'CLINICAL_DIRECTOR', 'CAREGIVER',
];

function entraSoloPorRRHH(auth: SessionUser): boolean {
    const todos = [auth.role, ...auth.secondaryRoles];
    return !todos.some(r => ROLES_CON_ACCESO_AL_PISO.includes(r));
}

/**
 * QUÉ FUE, SIN DECIR A QUIÉN.
 *
 * `ScoreEvent.reason` es texto libre que escriben once sitios distintos, y uno
 * de ellos mete el nombre del medicamento dentro: `/api/care/meds` guarda
 * "Medicamento omitido: ${medName}". Otros nombran el acto clínico concreto —
 * "Rotación UPP retrasada (>135 min)". Medido el 16-sep-2026 hay 29 textos
 * distintos en los 2.774 eventos de los últimos 90 días, y la lista crece cada
 * vez que alguien añade un caller.
 *
 * Para RRHH el movimiento se cuenta por su CATEGORÍA, que es la parte que
 * resume, y se queda entero el número: delta, antes y después. Se manda una
 * etiqueta y no un campo vacío para que la pantalla tenga qué dibujar en vez de
 * quedarse en blanco.
 */
const ETIQUETA_CATEGORIA: Record<string, string> = {
    VITALS:     'Signos vitales',
    MEDS:       'Medicamentos',
    ROTATION:   'Cambios posturales',
    MISSION:    'Misiones',
    ACADEMY:    'Formación',
    INCIDENT:   'Observación de RRHH',
    SHIFT:      'Turno',
    PREVENTIVE: 'Acción preventiva',
    PHOTO:      'Fotos',
    EVALUATION: 'Evaluación',
};

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: targetUserId } = await params;

        // Pasa por requireSession y no por getServerSession a pelo: es el único
        // punto donde vive el corte por facturación suspendida (402). Este
        // endpoint se lo estaba saltando — una sede suspendida seguía sirviendo
        // el historial de scores.
        const auth = await requireSession();
        if (auth instanceof NextResponse) return auth;

        const sessionUserId = auth.id;
        const hqId          = auth.headquartersId;

        // El propio empleado puede ver su historial; roles de gestión también.
        // Se miran también los roles secundarios, como hace requireRole: Celia
        // es DIRECTOR con NURSE de segundo, y el chequeo contra el rol primario
        // a secas no la contaba por enfermería.
        const isSelf  = sessionUserId === targetUserId;
        const isStaff = [auth.role, ...auth.secondaryRoles].some(r => ALLOWED_ROLES.includes(r));
        if (!isSelf && !isStaff) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 403 });
        }

        // Quien entra solo por RRHH ve el número y su historia, no el acto
        // clínico que lo movió. A uno mismo no se le recorta su propio
        // historial: es suyo.
        const sinPiso = !isSelf && entraSoloPorRRHH(auth);

        // Verificar que el usuario objetivo pertenece a la misma sede
        const targetUser = await prisma.user.findUnique({
            where:  { id: targetUserId },
            select: { complianceScore: true, headquartersId: true, name: true },
        });
        if (!targetUser) return NextResponse.json({ success: false, error: 'Empleado no encontrado' }, { status: 404 });
        if (!isSelf && targetUser.headquartersId !== hqId) {
            return NextResponse.json({ success: false, error: 'Empleado fuera de tu sede' }, { status: 403 });
        }

        // Últimos 90 días
        const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

        const events = await prisma.scoreEvent.findMany({
            where:   { userId: targetUserId, createdAt: { gte: since } },
            orderBy: { createdAt: 'desc' },
            take:    200,
        });

        // ── Agrupar por semana para la gráfica ────────────────────────────
        // Semana = lunes de la semana (ISO)
        function getWeekKey(d: Date): string {
            const day = d.getDay(); // 0=sun
            const diff = (day === 0 ? -6 : 1) - day;
            const monday = new Date(d);
            monday.setDate(d.getDate() + diff);
            return monday.toISOString().slice(0, 10);
        }

        const weekMap: Record<string, number[]> = {};
        for (const ev of events) {
            const wk = getWeekKey(new Date(ev.createdAt));
            if (!weekMap[wk]) weekMap[wk] = [];
            weekMap[wk].push(ev.scoreAfter);
        }

        // Si no hay eventos en una semana, interpolamos con el evento más cercano previo
        const weeklyAverage = Object.entries(weekMap)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([week, scores]) => ({
                week,
                avgScore: Math.round(scores.reduce((s, v) => s + v, 0) / scores.length),
            }));

        // ── Resumen ────────────────────────────────────────────────────────
        const totalPositive = events.filter(e => e.delta > 0).reduce((s, e) => s + e.delta, 0);
        const totalNegative = events.filter(e => e.delta < 0).reduce((s, e) => s + e.delta, 0);

        const catCount: Record<string, number> = {};
        for (const e of events) {
            catCount[e.category] = (catCount[e.category] || 0) + Math.abs(e.delta);
        }
        const topCategory = Object.entries(catCount).sort(([, a], [, b]) => b - a)[0]?.[0] ?? null;

        return NextResponse.json({
            success: true,
            currentScore: targetUser.complianceScore,
            weeklyAverage,
            events: events.slice(0, 60).map(e => ({
                id:          e.id,
                date:        e.createdAt,
                delta:       e.delta,
                // Ver ETIQUETA_CATEGORIA arriba. Para dirección y supervisión
                // sale el texto tal cual, que es lo que leen hoy.
                reason:      sinPiso
                    ? (ETIQUETA_CATEGORIA[e.category] ?? 'Movimiento de score')
                    : e.reason,
                category:    e.category,
                scoreBefore: e.scoreBefore,
                scoreAfter:  e.scoreAfter,
            })),
            summary: { totalPositive, totalNegative, topCategory },
            sinDetalleClinico: sinPiso,
        });

    } catch (err) {
        console.error('[score-history GET]', err);
        return NextResponse.json({ success: false, error: 'Error cargando historial' }, { status: 500 });
    }
}
