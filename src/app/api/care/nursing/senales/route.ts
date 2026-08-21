import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { detectarSenales } from '@/lib/clinical-signals';
import { withPhiAccessLog } from '@/lib/phi-audit';

export const dynamic = 'force-dynamic';

// Mismo gate que el resto de /api/care/nursing.
const ROLES = ['NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN'];

/**
 * Señales clínicas de la sede — qué residentes conviene mirar esta semana.
 *
 * No dice qué tiene nadie. Cruza lo que ya estaba guardado por separado
 * —vitales, eMAR, ingesta, alertas de turno, piel— y devuelve los patrones con
 * su evidencia al lado. El juicio clínico queda donde pertenece.
 *
 * Ver src/lib/clinical-signals.ts para por qué esto es determinista y no IA.
 */
async function handler(req: Request) {
    try {
        const auth = await requireRole(ROLES);
        if (auth instanceof NextResponse) return auth;

        // Ventana configurable, acotada: menos de 3 días no forma patrón y más
        // de 30 lo diluye hasta volverlo inútil.
        const raw = parseInt(new URL(req.url).searchParams.get('dias') ?? '7', 10);
        const dias = Number.isFinite(raw) ? Math.min(30, Math.max(3, raw)) : 7;

        const residentes = await detectarSenales(auth.headquartersId, dias);

        return NextResponse.json({
            success: true,
            dias,
            residentes,
            resumen: {
                total: residentes.length,
                revisar: residentes.filter(r => r.senales.some(s => s.gravedad === 'REVISAR')).length,
            },
        });
    } catch (error) {
        console.error('Error detectando señales clínicas:', error);
        return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 });
    }
}

// PHI audit — la respuesta nombra residentes y su estado clínico.
export const GET = withPhiAccessLog(handler, { resourceType: 'ClinicalSignals' });
