import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { calculateDynamicScore } from '@/app/api/care/compliance-score/route';
import { Z_SCORE_VISIBLE, Z_SCORE_OCULTO_MOTIVO } from '@/lib/z-score-visible';

export const dynamic = 'force-dynamic';

/**
 * EL SCORE DE LA PROPIA CUIDADORA.
 *
 * Esta es la ruta que alimentaba la OCTAVA y la NOVENA fuga del Z-Score.
 *
 * El apagado del 09-sep-2026 (bddaaf8) cubrió las pantallas de RRHH y
 * dirección. El del 10-sep (ef0422b) tapó otras siete fugas, entre ellas el
 * chip de la tableta `/care`. Ninguno de los dos tocó `/care/hub` ni
 * `/care/profile` —su pantalla de inicio y su perfil—, que llamaban aquí y
 * pintaban el número tal cual, en `/care/profile` incluso rotulado "Z-Score"
 * y con la fórmula desglosada.
 *
 * Medido el 13-sep-2026, cuatro días después de apagarlo, con esta misma
 * función: Yedaira González —517 notas en 30 días, la que más documenta del
 * piso— veía 25. Caridad Veras, con dieciséis días en el hogar y cero notas,
 * veía 100. Exactamente la inversión por la que se apagó.
 *
 * Por eso la bandera se comprueba AQUÍ y no solo en las dos pantallas: una
 * pantalla nueva que se olvide de mirarla no puede volver a filtrarlo, porque
 * ya no hay número que filtrar. Ver src/lib/z-score-visible.ts.
 */
export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }

        if (!Z_SCORE_VISIBLE) {
            return NextResponse.json({
                success: true,
                score: null,
                breakdown: null,
                oculto: true,
                motivo: Z_SCORE_OCULTO_MOTIVO,
            });
        }

        const userId = (session.user as any).id;

        // Calcular score dinámico en tiempo real + desglose completo
        const result = await calculateDynamicScore(userId);

        return NextResponse.json({
            success: true,
            score: result.score,
            breakdown: result.breakdown,
        });

    } catch (err) {
        console.error('[my-score GET]', err);
        return NextResponse.json({ success: false, error: 'Error cargando score' }, { status: 500 });
    }
}
