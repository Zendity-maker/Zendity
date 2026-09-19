import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole, type SessionUser } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

/**
 * QUIÉN ENTRA POR LA PUERTA DE RRHH Y NADA MÁS.
 *
 * `requireRole` acepta el rol primario Y los secundarios, así que un DIRECTOR
 * al que mañana se le añada HR_MANAGER de segundo no debe perder nada: sigue
 * teniendo piso. El recorte es para quien NO tiene ninguna otra puerta.
 *
 * Medido en producción el 16-sep-2026: una sola cuenta cae aquí —LizMelanie
 * Trinidad, HR_MANAGER, sin roles secundarios— y está activa. Esto no es
 * hipotético.
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
 * DEJA PASAR NÚMEROS. TODO LO DEMÁS SE CAE.
 *
 * `systemFindings` se guarda como Json libre y el tipo del cliente dice
 * `Record<string, number>`, que es falso: en producción es un árbol. Medido el
 * 16-sep-2026 sobre las 34 filas de PerformanceScore, 21 llevan dentro
 * `incidents.recent[].description` — 43 narrativas de texto libre escritas por
 * supervisión, y no hablan solo del empleado:
 *
 *   "...no se administraron los medicamentos programados para las 2 p.m. a
 *    dos residentes"
 *   "Algunos pacientes no tenían puestos los pañales..."
 *   "...una residente expresó sentirse incómoda debido a que tenía deseos de
 *    llorar"
 *
 * Eso es el piso, contado en prosa. Es exactamente lo que el rol HR_MANAGER
 * existe para NO ver (ver el comentario del enum Role en prisma/schema.prisma:
 * "Lo que NO tiene es acceso clínico").
 *
 * Por qué un filtro por FORMA y no una lista de campos permitidos: el blob lo
 * escribe otro sitio y va a crecer. Una lista blanca se queda corta y una negra
 * deja pasar lo próximo que alguien añada. Aquí un contador nuevo pasa solo, y
 * un texto nuevo se cae solo — que es el lado correcto por el que equivocarse
 * en un sistema con PHI.
 *
 * Pasa: números y nulls (un null es "no se midió", y conserva la forma).
 * Se cae: strings (prosa), arrays (incidents.recent) y booleanos.
 */
function soloNumeros(valor: unknown): unknown {
    if (typeof valor === 'number') return valor;
    if (valor === null) return null;
    if (Array.isArray(valor)) return undefined;
    if (typeof valor === 'object') {
        const limpio: Record<string, unknown> = {};
        for (const [clave, v] of Object.entries(valor as Record<string, unknown>)) {
            const dentro = soloNumeros(v);
            if (dentro !== undefined) limpio[clave] = dentro;
        }
        return limpio;
    }
    return undefined;
}

export async function GET(_request: Request) {
    try {
        // Tenant fix — hqId SIEMPRE de la sesión; el ?hqId del query se ignora
        // (cierra la fuga cross-hq).
        //
        // ANTES ERA `requireSession()` SIN ROL, o sea que este endpoint le
        // servía a CUALQUIERA con sesión la tabla de scores de toda la sede —
        // nombre, puntuación y las narrativas de incidentes de arriba. Una
        // cuidadora incluida.
        //
        // La razón que había escrita era que /hr/academy lo consume también
        // para CAREGIVER. Comprobado el 16-sep-2026 y no se sostiene:
        //   · Ninguna pantalla enlaza a /hr/academy (grep en todo src/).
        //   · Su botón de override llama a /api/hr/performance/[scoreId]/override,
        //     que no existe en el repo — hoy da 404.
        //   · Su "vista CAREGIVER" pinta `performances[0]`, que es la fila más
        //     reciente de TODA la sede, no la suya. En producción esa fila es de
        //     otra persona.
        // O sea que lo que se le rompe a la cuidadora es una pantalla que ya le
        // enseñaba el score de un compañero. Un 403 es mejor que eso.
        const auth = await requireRole(['DIRECTOR', 'ADMIN', 'SUPERVISOR', 'HR_MANAGER']);
        if (auth instanceof NextResponse) return auth;

        const hqId = auth.headquartersId;
        const sinPiso = entraSoloPorRRHH(auth);

        const scores = await prisma.performanceScore.findMany({
            where: { headquartersId: hqId },
            include: { user: { select: { id: true, name: true } } },
            orderBy: { createdAt: 'desc' },
            // 34 filas en producción hoy, así que el tope no cambia nada — está
            // para que el día que sí crezca no se cargue la tabla entera.
            take: 200,
        });

        const performances = scores.map(s => ({
            id: s.id,
            userId: s.userId,
            userName: s.user.name,
            systemScore: s.systemScore,
            humanScore: s.humanScore ?? null,
            finalScore: s.finalScore,
            // RRHH ve el número y lo que lo resume —conteos, porcentajes,
            // ranking, puntos deducidos— y no la prosa que lo produjo.
            // Dirección y supervisión siguen recibiendo el blob tal cual.
            systemFindings: sinPiso
                ? (soloNumeros(s.systemFindings ?? {}) as Record<string, unknown>)
                : ((s.systemFindings as Record<string, number>) ?? {}),
        }));

        return NextResponse.json({ success: true, performances, sinDetalleClinico: sinPiso });
    } catch (error) {
        console.error('Performance GET error:', error);
        return NextResponse.json({ error: 'Failed to fetch performances' }, { status: 500 });
    }
}
