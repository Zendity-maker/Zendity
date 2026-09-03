import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { puestaEnMarcha } from '@/lib/puesta-en-marcha';

/**
 * Estado de puesta en marcha de la sede del invocador.
 * La sede sale de la sesión: nadie consulta el avance de una sede ajena.
 */
export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }
        const role = (session.user as any).role;
        if (!['DIRECTOR', 'ADMIN', 'SUPER_ADMIN'].includes(role)) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 403 });
        }
        const hqId = (session.user as any).headquartersId;
        if (!hqId) {
            return NextResponse.json({ success: false, error: 'Tu usuario no tiene sede asignada' }, { status: 400 });
        }
        return NextResponse.json({ success: true, ...(await puestaEnMarcha(hqId)) });
    } catch (e: any) {
        console.error('[puesta-en-marcha]', e);
        return NextResponse.json({ success: false, error: 'Error de lectura' }, { status: 500 });
    }
}
