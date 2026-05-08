import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { calculateDynamicScore } from '@/app/api/care/compliance-score/route';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
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
