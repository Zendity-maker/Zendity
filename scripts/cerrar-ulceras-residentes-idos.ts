/**
 * CERRAR LAS ÚLCERAS DE QUIEN YA NO ESTÁ
 * ───────────────────────────────────────
 *
 * EN SECO POR DEFECTO. Para escribir hace falta `ESCRIBIR=SI` en el entorno.
 *
 * ═══ QUÉ PASA ═══
 *
 * Una úlcera se cierra cuando alguien la cierra. Si el residente fallece o se
 * va, nadie vuelve a abrir ese expediente y la úlcera se queda ACTIVE para
 * siempre. Medido el 28-sep-2026: de 8 úlceras, 6 sin resolver, y una de ellas
 * es de José A. Troche Santiago, fallecido.
 *
 * Eso no es solo una fila vieja: el reporte de dirección la contaba como úlcera
 * abierta de la sede (arreglado el mismo día en reporte-direccion.ts), y el
 * tablero de UPP la sigue enseñando.
 *
 * ═══ POR QUÉ `CERRADA_SIN_RESOLVER` Y NO `RESOLVED` ═══
 *
 * Porque no sanó. `RESOLVED` diría que la herida cerró, y eso es una
 * afirmación clínica que nadie hizo. `CERRADA_SIN_RESOLVER` es el estado que ya
 * existe en el repo para exactamente esto —hay dos úlceras así— y dice la
 * verdad: el seguimiento se acabó porque la persona ya no está.
 *
 * Y se escribe un UlcerLog de tipo CIERRE con el motivo, para que el
 * expediente diga QUIÉN lo cerró y POR QUÉ. Una fila que cambia de estado sin
 * dejar rastro es otra forma de que el expediente mienta.
 */
import { prisma } from '@/lib/prisma';
import { etiquetaDeCierre } from '@/lib/upp';


const ESCRIBIR = process.env.ESCRIBIR === 'SI';

/** Quién figura como autor del cierre. Sale de la env, no se inventa. */
const AUTOR_EMAIL = process.env.AUTOR_EMAIL || 'andrestyflores@gmail.com';

async function main() {
    const host = (process.env.DATABASE_URL || '').replace(/^[a-z+]+:\/\//, '').replace(/^[^@]*@/, '').replace(/[/?].*$/, '');
    console.log(`base: ${host}`);
    console.log(ESCRIBIR ? '⚠️  MODO ESCRITURA\n' : '(EN SECO — para escribir: ESCRIBIR=SI)\n');

    const autor = await prisma.user.findUnique({ where: { email: AUTOR_EMAIL }, select: { id: true, name: true } });
    if (!autor) { console.error(`No encuentro al autor ${AUTOR_EMAIL}`); process.exit(1); }

    const abiertas = await prisma.pressureUlcer.findMany({
        where: {
            resolvedAt: null,
            status: { notIn: ['RESOLVED', 'CERRADA_SIN_RESOLVER'] },
            patient: { status: { notIn: ['ACTIVE', 'TEMPORARY_LEAVE'] } },
        },
        select: {
            id: true, stage: true, bodyLocation: true, status: true, identifiedAt: true,
            patient: { select: { name: true, status: true, dischargeDate: true, fallecimientoReportadoAt: true } },
            logs: { select: { createdAt: true }, orderBy: { createdAt: 'desc' }, take: 1 },
        },
    });

    console.log(`úlceras abiertas de residentes que ya no están: ${abiertas.length}\n`);
    if (!abiertas.length) { await prisma.$disconnect(); return; }

    for (const u of abiertas) {
        const salida = u.patient?.fallecimientoReportadoAt ?? u.patient?.dischargeDate;
        const dias = salida ? Math.round((Date.now() - +salida) / 86400000) : null;
        console.log(`  ${u.patient?.name?.trim()}  ·  ${u.bodyLocation} estadio ${u.stage}  ·  ${u.status}`);
        console.log(`     residente: ${u.patient?.status}${dias !== null ? ` desde hace ${dias} días` : ''}`);
        console.log(`     identificada: ${u.identifiedAt.toISOString().slice(0, 10)}  ·  último registro: ${u.logs[0]?.createdAt.toISOString().slice(0, 10) ?? 'ninguno'}`);
        console.log(`     → quedaría CERRADA_SIN_RESOLVER con un log de CIERRE a nombre de ${autor.name}\n`);
    }

    if (!ESCRIBIR) { await prisma.$disconnect(); return; }

    for (const u of abiertas) {
        /**
         * El motivo sale del catálogo cerrado de src/lib/upp.ts, el mismo que
         * usa la pantalla. Escribirlo en texto libre lo dejaría fuera de
         * `etiquetaDeCierre` y de cualquier conteo por motivo.
         */
        const codigo = u.patient?.status === 'DECEASED' ? 'FALLECIMIENTO' : 'EGRESO';
        await prisma.$transaction([
            prisma.pressureUlcer.update({
                where: { id: u.id },
                data: { status: 'CERRADA_SIN_RESOLVER', resolvedAt: new Date() },
            }),
            prisma.ulcerLog.create({
                data: {
                    ulcerId: u.id,
                    nurseId: autor.id,
                    tipo: 'CIERRE',
                    motivo: codigo,
                    notes: `${etiquetaDeCierre(codigo)}. El seguimiento termina aquí: no consta que la úlcera haya cerrado.`,
                    treatmentApplied: null,
                },
            }),
        ]);
        console.log(`  ✓ cerrada la de ${u.patient?.name?.trim()}`);
    }
    console.log(`\n  ${abiertas.length} úlcera(s) cerradas.`);
    await prisma.$disconnect();
}
main().catch(async e => { console.error('ERROR', e?.message ?? e); await prisma.$disconnect(); process.exit(1); });
