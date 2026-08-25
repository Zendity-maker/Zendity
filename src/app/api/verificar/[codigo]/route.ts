import { NextResponse } from 'next/server';
import { buscarCertificado } from '@/lib/certificado';

/**
 * GET /api/verificar/[codigo]  — PÚBLICO, sin sesión.
 *
 * Es lo que hace verificable un certificado: quien lo recibe comprueba contra
 * la fuente en vez de creerle al PDF.
 *
 * Solo responde a un código EXACTO. No hay búsqueda por nombre, ni listado, ni
 * forma de enumerar: sin el código no se llega a ningún dato de nadie.
 *
 * Devuelve lo mínimo para acreditar formación — nombre, curso, fecha y sede.
 * Nada clínico y ningún identificador interno: un certificado acredita
 * formación, no da acceso a un expediente.
 */
export const dynamic = 'force-dynamic';

export async function GET(
    _req: Request,
    { params }: { params: Promise<{ codigo: string }> },
) {
    try {
        const { codigo } = await params;
        const r = await buscarCertificado(decodeURIComponent(codigo || ''));
        // Siempre 200: un 404 para "no existe" y 200 para "existe" convierte el
        // codigo de estado en un oraculo para quien pruebe codigos al azar.
        return NextResponse.json({ success: true, ...r }, { status: 200 });
    } catch (e: any) {
        console.error('[verificar] error:', e);
        return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 });
    }
}
