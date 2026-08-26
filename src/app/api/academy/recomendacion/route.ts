import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { recomendarCurso } from '@/lib/recomendador-cursos';
import { formacionDe } from '@/lib/formacion';

/**
 * GET /api/academy/recomendacion
 *
 * Lo que Zendi le sugiere a quien pregunta, y cómo va su formación del año.
 * Solo para uno mismo: no hay caso de uso para pedir la recomendación de otro.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }
        const userId = (session.user as any).id;

        const [recomendacion, formacion] = await Promise.all([
            recomendarCurso(userId),
            formacionDe(userId),
        ]);

        return NextResponse.json({ success: true, recomendacion, formacion });
    } catch (e: any) {
        console.error('[academy/recomendacion] error:', e);
        return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 });
    }
}
