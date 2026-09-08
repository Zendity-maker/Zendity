/**
 * CERRAR UN CAMBIO DE CONDICIÓN
 * ─────────────────────────────
 * Quien lo vio no puede tocar el expediente; quien puede tocarlo no estaba en
 * el pasillo. Esto es el segundo paso.
 *
 * Sin este cierre, el modelo sería una bitácora más — y el problema nunca fue
 * dónde escribirlo, sino que nadie lo resolviera.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { notifyUser } from '@/lib/notifications';
import {
    esResultadoValido, etiquetaResultado, etiquetaArea,
    respuestaParaQuienReporto, PUEDEN_REVISAR_CAMBIO,
} from '@/lib/cambios-de-condicion';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
    const auth = await requireRole(PUEDEN_REVISAR_CAMBIO);
    if (auth instanceof NextResponse) return auth;

    try {
        const { id } = await ctx.params;
        const body = await req.json().catch(() => ({}));
        const resultado = String(body.resultado ?? '').trim();
        const respuesta = String(body.respuesta ?? '').trim();

        if (!esResultadoValido(resultado)) {
            return NextResponse.json({ success: false, error: 'Elija qué se hizo' }, { status: 400 });
        }

        // Ownership por id: el rol no basta, el registro tiene que ser de esta sede.
        const cambio = await prisma.cambioDeCondicion.findFirst({
            where: { id, headquartersId: auth.headquartersId },
            select: {
                id: true, revisadoAt: true, area: true, reportadoPorId: true,
                patient: { select: { name: true } },
            },
        });
        if (!cambio) {
            return NextResponse.json({ success: false, error: 'No encontrado' }, { status: 404 });
        }
        if (cambio.revisadoAt) {
            return NextResponse.json({ success: false, error: 'Ya fue revisado.' }, { status: 409 });
        }

        await prisma.cambioDeCondicion.update({
            where: { id },
            data: {
                revisadoAt: new Date(),
                revisadoPorId: auth.id,
                resultado,
                respuesta: respuesta.slice(0, 2000) || null,
            },
        });

        /**
         * QUIEN LO REPORTÓ SE ENTERA. Sin esto, reportar se siente como hablarle
         * a una pared: se escribe, desaparece, y la próxima vez nadie reporta.
         * Es la misma razón por la que el empleado tiene contador en sus
         * observaciones de personal.
         */
        notifyUser(cambio.reportadoPorId, {
            type: 'TRIAGE',
            title: `Revisado: ${etiquetaArea(cambio.area)} — ${cambio.patient.name.trim()}`,
            // La DECISIÓN va siempre, escrita para quien está en el pasillo.
            // Decir solo "Referido a médico" es cierto y vacío: no dice qué
            // pasa ahora ni si le toca hacer algo. La respuesta a mano se añade
            // detrás cuando la hay.
            message: `${auth.name ?? 'Enfermería'}: ${etiquetaResultado(resultado)}. `
                + respuestaParaQuienReporto(resultado)
                + (respuesta ? ` — ${respuesta.slice(0, 160)}` : ''),
            link: '/care',
        }).catch(e => console.error('Aviso de revisión:', e));

        return NextResponse.json({ success: true, mensaje: etiquetaResultado(resultado) });
    } catch (error) {
        console.error('Revisar cambio de condición:', error);
        return NextResponse.json({ success: false, error: 'No se pudo cerrar' }, { status: 500 });
    }
}
