/**
 * CONFIRMAR O DESCARTAR UN HALLAZGO
 * ─────────────────────────────────
 * Es el paso que convierte una sospecha de la IA en algo o en nada. Sin él,
 * esto sería una lista que crece — y una lista que crece y nadie cierra es
 * exactamente lo que enseña a ignorar la pantalla.
 *
 * DESCARTAR EXIGE UNA RAZÓN. No por burocracia: sin ella, dentro de dos meses
 * nadie sabrá si se descartó porque era falso o porque ese día no había tiempo,
 * y la misma discusión se repite. Confirmar no la exige — confirmar ya viene
 * con la evidencia al lado.
 *
 * CONFIRMAR UNA ALERTA NO ESCALADA ABRE UN CAMBIO DE CONDICIÓN (08-sep-2026).
 *
 * Hasta hoy confirmar solo marcaba la fila y la quitaba de la lista. Para los
 * hallazgos de tipo SIN_CAMPO eso está bien —son ideas de producto, no trabajo
 * de piso— pero ALERTA_NO_ESCALADA es otra cosa: es algo clínico que YA PASÓ y
 * que nadie escaló. Decir "sí, es real" y que no ocurra nada es la misma trampa
 * que tenía el botón de piel de la tableta.
 *
 * Los cuatro que encontró el 07-sep: deterioro de movilidad de Dwight
 * Santiago, erupción cutánea de Natalia Díaz, somnolencia que dificultó la
 * ingesta de Fernando García, y un traslado de emergencia de Betzaida.
 *
 * Va a CambioDeCondicion, que es la cola que enfermería ya cierra y que ya
 * responde a quien lo reportó. No se inventa una cola nueva.
 *
 * Y SE ATRIBUYE A QUIEN LO ESCRIBIÓ, no a quien confirma. `fuente` trae
 * "DailyLog:<id>", así que se busca el autor y la fecha de la nota original:
 * el piso SÍ lo reportó —lo escribió con sus palabras— y lo que falló fue que
 * nadie lo escalara. Poner al que confirma como reportante borraría eso.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { PUEDEN_RESOLVER } from '@/lib/hallazgos-zendi';
import { esAreaValida, etiquetaArea } from '@/lib/cambios-de-condicion';
import { notifyRoles } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

const ESTADOS = ['CONFIRMADO', 'DESCARTADO'];
const MINIMO_RAZON = 10;

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
    const auth = await requireRole(PUEDEN_RESOLVER);
    if (auth instanceof NextResponse) return auth;

    try {
        const { id } = await ctx.params;
        const body = await req.json().catch(() => ({}));
        const estado = String(body.estado ?? '').trim();
        const nota = String(body.nota ?? '').trim();
        // Solo para ALERTA_NO_ESCALADA confirmada: en qué área cae.
        const area = String(body.area ?? '').trim();

        if (!ESTADOS.includes(estado)) {
            return NextResponse.json({ success: false, error: 'Diga si es real o no' }, { status: 400 });
        }
        if (estado === 'DESCARTADO' && nota.length < MINIMO_RAZON) {
            return NextResponse.json({
                success: false,
                error: `Para descartarlo, diga por qué — al menos ${MINIMO_RAZON} caracteres.`,
            }, { status: 400 });
        }

        // Ownership por id: el rol no basta.
        const h = await prisma.hallazgoZendi.findFirst({
            where: { id, headquartersId: auth.headquartersId },
            select: {
                id: true, estado: true, tipo: true, resumen: true, evidencia: true,
                fuente: true, patientId: true,
            },
        });
        if (!h) return NextResponse.json({ success: false, error: 'No encontrado' }, { status: 404 });
        if (h.estado !== 'PENDIENTE') {
            return NextResponse.json({ success: false, error: 'Ya fue revisado.' }, { status: 409 });
        }

        const abreCambio = estado === 'CONFIRMADO'
            && h.tipo === 'ALERTA_NO_ESCALADA'
            && !!h.patientId;

        if (abreCambio && !esAreaValida(area)) {
            return NextResponse.json({
                success: false,
                error: 'Escoge en qué área cae, para que enfermería sepa qué está mirando.',
            }, { status: 400 });
        }

        /**
         * Quién lo escribió y cuándo. `fuente` es "DailyLog:<id>". Si no se
         * puede resolver, cae en quien confirma — pero se intenta primero,
         * porque el mérito de haberlo visto es de quien estaba delante.
         */
        let reportadoPorId = auth.id;
        let reportadoAt = new Date();
        if (abreCambio && h.fuente?.startsWith('DailyLog:')) {
            const log = await prisma.dailyLog.findUnique({
                where: { id: h.fuente.slice('DailyLog:'.length) },
                select: { authorId: true, createdAt: true },
            });
            if (log?.authorId) { reportadoPorId = log.authorId; reportadoAt = log.createdAt; }
        }

        const creado = await prisma.$transaction(async (tx) => {
            await tx.hallazgoZendi.update({
                where: { id },
                data: {
                    estado,
                    revisadoAt: new Date(),
                    revisadoPorId: auth.id,
                    nota: nota.slice(0, 2000) || null,
                },
            });

            if (!abreCambio) return null;

            // No duplicar: si ya hay un cambio sin revisar de ese residente en
            // esa área, el trabajo ya está en la cola.
            const yaHay = await tx.cambioDeCondicion.findFirst({
                where: { headquartersId: auth.headquartersId, patientId: h.patientId!, area, revisadoAt: null },
                select: { id: true },
            });
            if (yaHay) return null;

            return tx.cambioDeCondicion.create({
                data: {
                    headquartersId: auth.headquartersId,
                    patientId: h.patientId!,
                    reportadoPorId,
                    reportadoAt,
                    area,
                    descripcion: `${h.resumen.trim()}\n\nLo que se escribió: "${h.evidencia.trim()}"`.slice(0, 4000),
                },
                select: { id: true },
            });
        });

        if (creado) {
            notifyRoles(auth.headquartersId, ['NURSE', 'SUPERVISOR', 'DIRECTOR'], {
                type: 'TRIAGE',
                title: `${etiquetaArea(area)} — pendiente de revisar`,
                message: `${auth.name ?? 'Dirección'} confirmó un hallazgo que nadie había escalado: ${h.resumen.slice(0, 120)}`,
                link: '/care/cambios',
            }, auth.id).catch(e => console.error('[hallazgo->cambio] aviso:', e));
        }

        return NextResponse.json({
            success: true,
            mensaje: estado !== 'CONFIRMADO' ? 'Descartado.'
                : creado ? `Confirmado. Se abrió en ${etiquetaArea(area)} para que enfermería lo cierre.`
                : abreCambio ? 'Confirmado. Ya había un aviso abierto de ese residente en esa área.'
                : 'Confirmado.',
        });
    } catch (error) {
        console.error('Resolver hallazgo:', error);
        return NextResponse.json({ success: false, error: 'No se pudo guardar' }, { status: 500 });
    }
}
