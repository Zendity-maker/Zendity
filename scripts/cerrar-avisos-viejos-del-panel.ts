/**
 * Cierra los avisos del panel del supervisor que llevan más de 30 días abiertos.
 *
 * POR QUÉ EXISTEN
 * ---------------
 * Hasta el 10-sep-2026 la única forma de cerrar un aviso era un botón que decía
 * DESCARTAR y exigía escribir un motivo de 10 caracteres. Quien había ATENDIDO
 * la alerta no tenía dónde decirlo, así que la dejaba ahí.
 *
 * El resultado: 28 alertas clínicas y 7 caídas sin cerrar, algunas de junio.
 *
 * Casi seguro se atendieron en su momento — una caída de hace tres meses no
 * sigue pendiente de atención, sigue pendiente de un clic que no existía. Pero
 * CASI SEGURO no es lo mismo que consta, y por eso la nota que queda no dice
 * "atendido": dice exactamente lo que sabemos.
 *
 * QUÉ TOCA Y QUÉ NO
 * -----------------
 * Solo lo de MÁS DE 30 DÍAS. Lo reciente se queda para que lo cierre quien
 * corresponde, con el botón nuevo: son 18 alertas y 4 caídas que sí puede
 * repasar una persona.
 *
 * Y no inventa nada. Las alertas clínicas (DailyLog) solo tienen `isResolved`
 * —no hay campo de nota— así que el motivo va al SystemAuditLog, que es donde
 * se puede contestar "quién cerró esto y por qué" dentro de un año.
 *
 * USO
 *   npx tsx scripts/cerrar-avisos-viejos-del-panel.ts             (solo mira)
 *   npx tsx scripts/cerrar-avisos-viejos-del-panel.ts --escribir  (cierra)
 */
import { writeFileSync } from 'fs';
import { prisma } from '../src/lib/prisma';

const HQ = 'a792f420-07a5-4088-8097-5ef47ca05ac8';
const DIAS = 30;
const ESCRIBIR = process.argv.includes('--escribir');

const NOTA = `Cerrada en la limpieza del 10-sep-2026. Hasta esa fecha el panel del `
    + `supervisor no tenía forma de marcar un aviso como atendido: el único botón `
    + `decía "descartar" y exigía un motivo escrito. No consta si se atendió.`;

const dias = (d: Date) => Math.floor((Date.now() - d.getTime()) / 86_400_000);

async function main() {
    const corte = new Date(Date.now() - DIAS * 86_400_000);

    const [alertas, caidas, director] = await Promise.all([
        prisma.dailyLog.findMany({
            where: {
                patient: { headquartersId: HQ },
                isClinicalAlert: true, isResolved: false,
                createdAt: { lt: corte },
            },
            select: { id: true, createdAt: true, notes: true, patient: { select: { name: true } } },
            orderBy: { createdAt: 'asc' },
        }),
        prisma.fallIncident.findMany({
            where: {
                patient: { headquartersId: HQ },
                resolvedAt: null,
                incidentDate: { lt: corte },
            },
            select: { id: true, incidentDate: true, patient: { select: { name: true } } },
            orderBy: { incidentDate: 'asc' },
        }),
        // Quien firma el cierre. Es una acción de dirección, no del sistema:
        // un cierre sin autor es lo que nos trajo hasta aquí.
        prisma.user.findFirst({
            where: { headquartersId: HQ, role: 'DIRECTOR', isActive: true, isDeleted: false },
            select: { id: true, name: true },
            orderBy: { name: 'asc' },
        }),
    ]);

    console.log(`Alertas clínicas de más de ${DIAS} días: ${alertas.length}`);
    alertas.forEach(a => console.log(
        `   ${String(dias(a.createdAt)).padStart(3)} d  ${a.patient.name.trim().padEnd(24)} ${(a.notes ?? '').trim().slice(0, 46)}`));

    console.log(`\nCaídas de más de ${DIAS} días: ${caidas.length}`);
    caidas.forEach(c => console.log(
        `   ${String(dias(c.incidentDate)).padStart(3)} d  ${c.patient.name.trim()}`));

    const recientes = await prisma.dailyLog.count({
        where: { patient: { headquartersId: HQ }, isClinicalAlert: true, isResolved: false, createdAt: { gte: corte } },
    });
    const caidasRecientes = await prisma.fallIncident.count({
        where: { patient: { headquartersId: HQ }, resolvedAt: null, incidentDate: { gte: corte } },
    });
    console.log(`\nSE QUEDAN para que las cierre una persona: ${recientes} alertas y ${caidasRecientes} caídas.`);

    if (alertas.length === 0 && caidas.length === 0) { console.log('\nNada que cerrar.'); return; }
    if (!director) { console.log('\nNo encontré un DIRECTOR activo que firme el cierre. No se escribe nada.'); return; }
    console.log(`\nFirma el cierre: ${director.name?.trim()}`);

    if (!ESCRIBIR) {
        console.log(`\n[SOLO MIRANDO] Para cerrarlas: --escribir`);
        return;
    }

    // Respaldo antes de tocar nada, con los ids, por si hay que deshacerlo.
    const respaldo = `scripts/respaldo-avisos-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
    writeFileSync(respaldo, JSON.stringify({
        alertas: alertas.map(a => ({ id: a.id, creada: a.createdAt, nota: a.notes })),
        caidas: caidas.map(c => ({ id: c.id, fecha: c.incidentDate })),
    }, null, 1));
    console.log(`Respaldo escrito: ${respaldo}`);

    const alertasCerradas = await prisma.dailyLog.updateMany({
        where: { id: { in: alertas.map(a => a.id) } },
        data: { isResolved: true },
    });
    const caidasCerradas = await prisma.fallIncident.updateMany({
        where: { id: { in: caidas.map(c => c.id) } },
        data: { resolvedAt: new Date(), resolvedById: director.id, resolutionNote: NOTA },
    });

    // El porqué, donde se puede consultar. DailyLog no tiene campo de nota.
    for (const a of alertas) {
        await prisma.systemAuditLog.create({
            data: {
                headquartersId: HQ, entityName: 'DailyLog', entityId: a.id,
                action: 'VOIDED', performedById: director.id,
                payloadChanges: { kind: 'LIMPIEZA_AVISOS_VIEJOS', motivo: NOTA, diasAbierta: dias(a.createdAt) } as any,
            },
        }).catch(() => { /* el cierre ya se guardó; el rastro es best-effort */ });
    }

    console.log(`\nCerradas: ${alertasCerradas.count} alertas y ${caidasCerradas.count} caídas.`);

    const quedanA = await prisma.dailyLog.count({
        where: { patient: { headquartersId: HQ }, isClinicalAlert: true, isResolved: false },
    });
    const quedanC = await prisma.fallIncident.count({
        where: { patient: { headquartersId: HQ }, resolvedAt: null },
    });
    console.log(`\nVERIFICACIÓN — quedan abiertas: ${quedanA} alertas y ${quedanC} caídas.`);
    console.log(quedanA === recientes && quedanC === caidasRecientes ? '  OK — solo las recientes.' : '  REVISAR');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
