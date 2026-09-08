/**
 * EL RESUMEN SEMANAL A QUIEN ESCRIBIÓ LA NOTA
 * ───────────────────────────────────────────
 * Zendi lee las notas de turno y encuentra sitios donde alguien escribió a
 * mano algo que YA TIENE SU BOTÓN. Medido el 08-sep-2026: de 36 hallazgos, 27
 * eran eso — seis sobre caídas teniendo módulo de caídas, seis sobre piel
 * teniendo Alerta Piel/UPP.
 *
 * Eso no es un campo que falte. Es un atajo que la persona no encontró. Y la
 * única forma de que lo encuentre es decírselo CON SU PROPIA NOTA DELANTE.
 *
 * POR QUÉ SEMANAL Y AGRUPADO, Y NO UN AVISO POR HALLAZGO. Seis avisos a la
 * misma cuidadora en una tarde no se leen como ayuda: se leen como una lista
 * de errores. Y quien se siente auditado deja de escribir en las notas — que
 * es justo donde Zendi encuentra todo esto. Uno por semana, con dos o tres
 * cosas, se lee.
 *
 * EL TONO NO ES COSMÉTICO, ES EL DISEÑO. El correo dice "tienes un atajo", no
 * "debiste usar". Abre reconociendo que lo escribió, porque lo escribió: la
 * nota existe y por eso Zendi la encontró. Lo que faltó fue que llegara a
 * donde sirve.
 *
 * NO LLEVA NOMBRE DE RESIDENTE en el cuerpo — es la regla del proyecto para
 * cualquier correo. Lleva la frase que la persona escribió, que es suya, y el
 * sitio donde va. Con eso basta para recordarlo.
 */
import sgMail from '@sendgrid/mail';
import { prisma } from '@/lib/prisma';
import { notifyUser } from '@/lib/notifications';
import { AVISADO } from '@/lib/hallazgos-zendi';

if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

export interface ResultadoResumen {
    sede: string;
    personas?: number;
    hallazgos?: number;
    saltada?: string;
}

/**
 * UNA NOTA, UNA ENTRADA — aunque Zendi haya sacado varios hallazgos de ella.
 *
 * Zendi lee una nota y puede encontrar dos o tres cosas distintas: la caída y
 * el hematoma de la misma frase salen como dos hallazgos. Sin agrupar, a la
 * cuidadora le llegaba SU MISMA FRASE repetida dos y tres veces, a veces con el
 * mismo destino. Eso se lee como descuido y desarma el correo entero.
 *
 * Se agrupa por nota y se listan los sitios, sin repetir.
 */
interface Pieza {
    hallazgoIds: string[];
    /** Lo que escribió, tal cual. Es lo que hace que se acuerde. */
    loQueEscribio: string;
    cuando: Date;
    /** Dónde va, en las palabras de quien revisó. Sin duplicados. */
    dondes: string[];
}

export async function enviarResumenHallazgos(
    sedeId: string,
    sedeNombre: string,
): Promise<ResultadoResumen> {
    /**
     * YA_EXISTE y todavía sin avisar. Al mandarlo pasan a AVISADO, así que un
     * segundo pase el mismo lunes no repite nada.
     */
    const hallazgos = await prisma.hallazgoZendi.findMany({
        where: { headquartersId: sedeId, estado: 'YA_EXISTE' },
        select: { id: true, fuente: true, resumen: true, nota: true },
    });
    if (hallazgos.length === 0) return { sede: sedeNombre, saltada: 'nada que avisar' };

    // De cada hallazgo al autor de la nota original. Sin autor no hay a quién
    // decírselo, y el hallazgo se queda esperando en vez de perderse.
    const idsLog = hallazgos
        .map(h => h.fuente)
        .filter((f): f is string => !!f && f.startsWith('DailyLog:'))
        .map(f => f.slice('DailyLog:'.length));

    const logs = idsLog.length
        ? await prisma.dailyLog.findMany({
            where: { id: { in: idsLog } },
            select: { id: true, authorId: true, createdAt: true, notes: true },
        })
        : [];
    const porLog = new Map(logs.map(l => [l.id, l]));

    // autorId -> (logId -> Pieza). El segundo mapa es el que evita repetir la
    // misma frase cuando Zendi sacó varios hallazgos de una sola nota.
    const porPersona = new Map<string, Map<string, Pieza>>();
    for (const h of hallazgos) {
        const logId = h.fuente?.startsWith('DailyLog:') ? h.fuente.slice('DailyLog:'.length) : null;
        const log = logId ? porLog.get(logId) : null;
        if (!log?.authorId || !logId) continue;
        // La etiqueta [ALERTA CLÍNICA] y compañía sobran: ella sabe lo que escribió.
        const texto = (log.notes ?? h.resumen).replace(/^\[[^\]]+\]\s*/, '').trim();
        const donde = (h.nota ?? '').trim();

        const notas = porPersona.get(log.authorId) ?? new Map<string, Pieza>();
        const ya = notas.get(logId);
        if (ya) {
            ya.hallazgoIds.push(h.id);
            if (donde && !ya.dondes.includes(donde)) ya.dondes.push(donde);
        } else {
            notas.set(logId, {
                hallazgoIds: [h.id],
                loQueEscribio: texto,
                cuando: log.createdAt,
                dondes: donde ? [donde] : [],
            });
        }
        porPersona.set(log.authorId, notas);
    }
    if (porPersona.size === 0) return { sede: sedeNombre, saltada: 'sin autores que resolver' };

    const personas = await prisma.user.findMany({
        where: { id: { in: [...porPersona.keys()] }, isActive: true, isDeleted: false },
        select: { id: true, name: true, email: true },
    });

    const remitente = process.env.SENDGRID_FROM_EMAIL;
    const puedeCorreo = !!process.env.SENDGRID_API_KEY && !!remitente;
    let enviados = 0;
    const avisados: string[] = [];

    for (const p of personas) {
        const piezas = [...(porPersona.get(p.id)?.values() ?? [])].filter(x => x.dondes.length > 0);
        if (piezas.length === 0) continue;
        const nombre = (p.name ?? '').trim().split(/\s+/)[0] || 'Hola';

        /**
         * El aviso en la campana va SIEMPRE, tenga correo o no. El correo es
         * mejor para leerlo con calma; la campana es la que no falla.
         */
        notifyUser(p.id, {
            type: 'SHIFT_ALERT',
            title: piezas.length === 1 ? 'Un atajo para lo que escribiste' : `${piezas.length} atajos para lo que escribiste`,
            message: `${piezas[0].loQueEscribio.slice(0, 80)}… → ${piezas[0].dondes[0]}`,
            link: '/care',
        }).catch(e => console.error('[resumen-hallazgos] campana:', e));

        if (puedeCorreo && p.email?.includes('@')) {
            const filas = piezas.map(x => `
<div style="border-left:3px solid #0F6E56;padding:0 0 0 14px;margin:0 0 18px;">
<p style="margin:0 0 4px;font-size:14px;color:#3D4B45;font-style:italic;">"${x.loQueEscribio.slice(0, 240)}"</p>
<p style="margin:0 0 6px;font-size:12px;color:#66766F;">${x.cuando.toLocaleDateString('es-PR', { day: '2-digit', month: 'long', timeZone: 'America/Puerto_Rico' })}</p>
<p style="margin:0;font-size:14px;color:#12211D;"><strong>Eso tiene su sitio:</strong> ${x.dondes.join(' · ')}</p>
</div>`).join('');

            await sgMail.send({
                to: p.email,
                from: remitente!,
                subject: piezas.length === 1
                    ? 'Un atajo para algo que escribiste esta semana'
                    : `${piezas.length} atajos para cosas que escribiste esta semana`,
                html: `<meta charset="utf-8"><div style="background:#ffffff;color:#12211D;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;line-height:1.65;padding:28px;max-width:560px;margin:0 auto;">
<p style="margin:0 0 6px;font-size:18px;font-weight:800;">${nombre}, esto lo escribiste tú</p>
<p style="margin:0 0 20px;font-size:14px;color:#66766F;">${sedeNombre}</p>
<p style="margin:0 0 20px;font-size:14px;">
Lo anotaste en una nota de turno, y estuvo bien anotarlo — por eso lo estamos leyendo.
Lo que pasa es que en la tableta hay un sitio donde eso además <strong>llega a enfermería
y te contestan</strong>. En la nota se queda quieto.
</p>
${filas}
<div style="background:#F1F7F4;border-left:4px solid #0F6E56;padding:14px 16px;margin:0 0 18px;">
<p style="margin:0;font-size:14px;">No hace falta que escribas menos. Es el mismo trabajo, en el botón que hace que alguien lo vea.</p>
</div>
<p style="margin:0 0 18px;font-size:13px;color:#66766F;">Si crees que el sitio que te decimos no es el correcto, dilo en el relevo — a lo mejor el equivocado es el botón.</p>
<p style="margin:0;font-size:13px;color:#66766F;">Se entra por <strong>Zendity Care</strong> en app.zendity.com.</p>
</div>`,
            });
            enviados++;
        }
        avisados.push(...piezas.flatMap(x => x.hallazgoIds));
    }

    if (avisados.length) {
        await prisma.hallazgoZendi.updateMany({
            where: { id: { in: avisados } },
            data: { estado: AVISADO },
        });
    }

    return { sede: sedeNombre, personas: personas.length, hallazgos: avisados.length, ...(enviados === 0 ? { saltada: 'solo campana, sin correo' } : {}) };
}
