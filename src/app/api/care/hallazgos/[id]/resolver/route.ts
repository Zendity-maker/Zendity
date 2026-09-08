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
import { PUEDEN_RESOLVER, SALIDAS, CONSTRUIDO } from '@/lib/hallazgos-zendi';
import { esAreaValida, etiquetaArea } from '@/lib/cambios-de-condicion';
import { notifyRoles } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

/**
 * LOS ESTADOS, Y QUÉ TRANSICIÓN ES LEGÍTIMA.
 *
 *   PENDIENTE  -> CONFIRMADO | DESCARTADO   lo decide quien lo lee
 *   CONFIRMADO -> CONSTRUIDO                lo marca dirección al construirlo
 *
 * CONSTRUIDO existe porque sin él la lista de confirmados crece y no baja
 * nunca, que es exactamente lo que enseña a ignorar una pantalla. Un hueco del
 * sistema confirmado deja de contar cuando el hueco se tapa — no antes.
 */
const ESTADOS = SALIDAS.map(s => s.codigo);
const MINIMO_DESTINO = 4;


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

        if (!ESTADOS.includes(estado) && estado !== CONSTRUIDO) {
            return NextResponse.json({ success: false, error: 'Diga si es real o no' }, { status: 400 });
        }
        /**
         * LA RAZÓN YA NO SE EXIGE AL DESCARTAR. Con tres salidas, el botón que
         * se escoge ES la razón: "no hace falta" ya dice lo que decía la nota
         * obligatoria. Lo que sí se exige es el DESTINO cuando se dice que ya
         * se puede documentar — sin él no hay nada que decirle a la cuidadora,
         * y el aviso quedaría en "esto tiene un sitio" sin decir cuál.
         */
        if (estado === 'YA_EXISTE' && nota.trim().length < MINIMO_DESTINO) {
            return NextResponse.json({
                success: false,
                error: 'Diga dónde se documenta: es lo único que le sirve a quien lo escribió.',
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
        // Marcar construido parte de CONFIRMADO, no de PENDIENTE: no se puede
        // dar por construido algo que nadie ha dicho todavia que haga falta.
        if (estado === CONSTRUIDO) {
            if (h.estado !== 'CONFIRMADO') {
                return NextResponse.json({ success: false, error: 'Solo se marca construido lo que ya se confirmó.' }, { status: 409 });
            }
        } else if (h.estado !== 'PENDIENTE') {
            return NextResponse.json({ success: false, error: 'Ya fue revisado.' }, { status: 409 });
        }

        // Una alerta que nadie escaló abre trabajo pase lo que pase: da igual
        // si el campo existía o no — lo que importa es que aquello no llegó a
        // enfermería. Por eso vale tanto YA_EXISTE como CONFIRMADO.
        const abreCambio = (estado === 'CONFIRMADO' || estado === 'YA_EXISTE')
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
                    // Marcar construido no borra la razon con la que se confirmo.
                    ...(nota ? { nota: nota.slice(0, 2000) } : estado === CONSTRUIDO ? {} : { nota: null }),
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
            mensaje: estado === CONSTRUIDO ? 'Marcado como construido. Deja de contar.'
                : estado === 'DESCARTADO' ? 'Cerrado.'
                : estado === 'YA_EXISTE'
                    ? (creado
                        ? `Anotado. Se abrió en ${etiquetaArea(area)}, y va en el resumen del lunes a quien escribió la nota.`
                        : 'Anotado. Va en el resumen del lunes a quien escribió la nota.')
                : creado ? `Para evaluar. Se abrió en ${etiquetaArea(area)} para que enfermería lo cierre.`
                : abreCambio ? 'Para evaluar. Ya había un aviso abierto de ese residente en esa área.'
                : 'Guardado en la lista de dirección.',
        });
    } catch (error) {
        console.error('Resolver hallazgo:', error);
        return NextResponse.json({ success: false, error: 'No se pudo guardar' }, { status: 500 });
    }
}
