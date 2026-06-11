import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { clinicalDay } from '@/lib/dates';
import { resolveCaregiverColors, isSoloCaregiver } from '@/lib/shift-coverage';
import { requireSession } from '@/lib/api-auth';

/**
 * GET /api/hr/schedule/my-color
 *
 * Devuelve el color (o colores) que la cuidadora actual debe usar para
 * filtrar sus residentes en el tablet. userId y hqId vienen de la SESIÓN
 * — nunca del query (HIPAA: cualquiera no puede consultar el color de
 *  otra cuidadora).
 *
 * RESPONSE shape:
 *   {
 *     success: true,
 *     color:   string | null,    // primer color de `colors` (compat)
 *     colors:  string[],         // UNIÓN completa (D1) — base ∪ assignments
 *     source:  'assignment' | 'roster' | 'no_color_assigned'
 *            | 'shift_not_current' | 'none',
 *     shiftNotes: string | null,
 *     auto?:   true              // sólo si escaló a 'ALL' por solo-mode
 *     originalColor?: string     // sólo si auto=true (color real antes del solo-mode)
 *   }
 *
 * Cambios vs. legacy:
 *   - El resolver canónico (`resolveCaregiverColors`) reemplaza la lógica
 *     inline. Mismo source semántico, misma ventana, misma boundary 6am AST
 *     con rollback, mismo solo-mode (ahora vía helper).
 *   - D1 ADITIVO: si la cuidadora tiene base BLUE + ColorAssignment YELLOW,
 *     antes legacy devolvía solo 'YELLOW' (precedencia). Ahora retorna
 *     `colors: ['BLUE','YELLOW']` Y `color: 'BLUE'`. El frontend usa
 *     `colors.join(',')` para pedir pacientes de ambos grupos.
 *
 * Anclaje: usa `session.startTime` como `at` si hay sesión activa hoy
 * — preserva el fix del cruce de turno (caregiver inició MORNING 6am
 * y sigue en piso a las 15:00 sigue viendo MORNING/su-color).
 */
export async function GET(_req: Request) {
    try {
        const auth = await requireSession();
        if (auth instanceof NextResponse) return auth;
        const userId = auth.id;
        const hqId = auth.headquartersId;

        // Anclar la resolución al inicio de sesión si hay sesión activa
        // del día clínico actual. Si no, usar `at = undefined` (= now).
        const { boundary6amUtc } = clinicalDay();
        const activeSession = await prisma.shiftSession.findFirst({
            where: {
                caregiverId: userId,
                headquartersId: hqId,
                actualEndTime: null,
                startTime: { gte: boundary6amUtc },
            },
            orderBy: { startTime: 'desc' },
            select: { id: true, startTime: true },
        });
        const evaluatedAt = activeSession?.startTime ?? undefined;

        // Resolver vía el chokepoint canónico (D1+D2+D3).
        //
        // FIX 11-jun-2026: overtimeFallback es CONDICIONAL a tener sesión activa.
        // Si la cuidadora está clocked-in (activeSession existe) y tiene pauta del
        // día aunque sea overtime (ej. MORNING terminó 14:00 pero ella sigue en piso
        // a las 16:00), el resolver debe seguir reportando su color de pauta — no
        // 'shift_not_current'. Sin esto, el supervisor wall (que usa overtimeFallback)
        // veía base YELLOW + assignments mientras my-color veía SOLO assignments,
        // creando divergencia visible (caso Vivid Cupey, Medelyn 11-jun).
        // Cuando NO hay sesión activa (cuidadora consulta sin clock-in), mantenemos
        // la semántica precisa anterior — sin fallback, devuelve 'shift_not_current'
        // o 'none'.
        const resolved = await resolveCaregiverColors({
            mode: 'single',
            caregiverId: userId,
            hqId,
            at: evaluatedAt,
            includeSource: true,
            overtimeFallback: !!activeSession,
        });

        let colors = resolved.colors;
        let primaryColor = colors[0] ?? null;
        const source = resolved.source;
        const shiftNotes = resolved.shiftNotes;

        // Solo-mode: si hay color real (no 'ALL', no vacío) y la cuidadora
        // es la única en piso AHORA → escalar a 'ALL' (ve todos los residentes).
        // Mantiene `originalColor` para que la UI sepa que es escalación.
        //
        // Importante: `at: undefined` (= now), NO `evaluatedAt`. La pregunta
        // "¿está sola?" es del momento ACTUAL, no del inicio de su sesión.
        // Anclar a session.startTime puede contar zombies recientes como
        // sesiones activas (cap = startTime - 16h captura sesiones que el cap
        // = now - 16h ya excluiría). Confirmado por análisis de caso de borde.
        let auto: true | undefined;
        let originalColor: string | undefined;
        if (primaryColor && !colors.includes('ALL')) {
            const solo = await isSoloCaregiver({ hqId });
            if (solo) {
                auto = true;
                originalColor = primaryColor;
                primaryColor = 'ALL';
                colors = ['ALL'];
            }
        }

        return NextResponse.json({
            success: true,
            color: primaryColor,
            colors,
            source,
            shiftNotes,
            ...(auto ? { auto, originalColor } : {}),
        });
    } catch (error) {
        console.error('my-color error:', error);
        // Misma forma de error que el legacy — no rompe consumidores
        return NextResponse.json({ success: false, color: null, colors: [] });
    }
}
