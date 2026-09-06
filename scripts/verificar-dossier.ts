/**
 * ¿DE VERDAD SON DOS PÁGINAS?
 *
 *     npx tsx scripts/verificar-dossier.ts
 *
 * src/lib/dossier-pdf.ts promete un tope duro de dos páginas. Esto lo mide
 * contra los residentes REALES de producción, con sus vitales, medicamentos,
 * caídas y alertas de los últimos 30 días — no contra un ejemplo inventado.
 *
 * El análisis de Zendi NO se pide a OpenAI: sale de aquí un texto del tamaño
 * máximo que puede devolver (max_tokens 520 ≈ 2.000 caracteres), porque lo que
 * se está probando es el PEOR caso, no el caso típico. Además así la prueba no
 * cuesta dinero ni manda PHI a un tercero para comprobar un margen.
 *
 * Solo lee. No escribe nada.
 */
import { prisma } from '../src/lib/prisma';
import { construirDossierPDF, type DossierMeta } from '../src/lib/dossier-pdf';
import { textoDeAlergias, alergiasSinDocumentar } from '../src/lib/alergias';

/** Lo más largo que el prompt puede devolver hoy. El peor caso, no el normal. */
const ANALISIS_PEOR_CASO = [
    '1. Resumen Ejecutivo',
    'El residente presenta durante los ultimos treinta dias un patron de tension arterial elevada que coincide temporalmente con el ajuste de su antihipertensivo, ademas de episodios aislados de taquicardia que no se acompanan de sintomatologia reportada por el personal de piso. Se documenta ademas una disminucion progresiva del apetito referida por cuidadoras en tres turnos distintos.',
    '2. Patron de Signos Vitales Anormales',
    'Las lecturas fuera de rango se concentran en el turno de la manana, lo que sugiere revisar el horario de administracion del antihipertensivo. Se recomienda correlacionar con la hoja de administracion.',
    '3. Alertas Preventivas y Comportamiento',
    'Se registraron acciones preventivas relacionadas con deambulacion nocturna y con la colocacion de barandas. No se documentan lesiones. El personal reporta buena tolerancia a la dieta indicada.',
    '4. Recomendaciones para el medico visitante',
    '- Revisar horario del antihipertensivo frente al patron matutino observado.',
    '- Considerar analitica de control si persiste la disminucion del apetito.',
    '- Valorar necesidad de ajuste en la pauta nocturna dado el patron de deambulacion.',
    '- Confirmar con el hogar las alergias no documentadas antes de cualquier prescripcion nueva.',
].join('\n\n');

async function main() {
    const hace30 = new Date(); hace30.setDate(hace30.getDate() - 30);
    const sedes = await prisma.headquarters.findMany({ where: { isActive: true }, select: { id: true, name: true, phone: true, billingAddress: true, logoUrl: true } });

    let peor = 0, total = 0, conAviso = 0;
    for (const sede of sedes) {
        const pacientes = await prisma.patient.findMany({
            where: { headquartersId: sede.id, status: 'ACTIVE' },
            include: {
                intakeData: true,
                vitalSigns: { where: { createdAt: { gte: hace30 } }, orderBy: { createdAt: 'asc' }, include: { measuredBy: { select: { name: true } } } },
                dailyLogs: { where: { createdAt: { gte: hace30 }, isClinicalAlert: true }, orderBy: { createdAt: 'asc' }, include: { author: { select: { name: true } } } },
                fallIncidents: { where: { reportedAt: { gte: hace30 } }, orderBy: { reportedAt: 'asc' } },
                medications: { where: { isActive: true }, include: { medication: true } },
            },
        });
        if (pacientes.length === 0) { console.log(`— ${sede.name}: sin residentes activos`); continue; }
        console.log(`\n== ${sede.name} (${pacientes.length} residentes)`);

        for (const p of pacientes) {
            // Mismo filtro que la API: sin los cuatro campos no se puede juzgar.
            const v = p.vitalSigns.filter(
                (x): x is typeof x & { systolic: number; diastolic: number; heartRate: number; temperature: number } =>
                    x.systolic != null && x.diastolic != null && x.heartRate != null && x.temperature != null,
            );
            const prom = v.length > 0 ? {
                sys: Math.round(v.reduce((a, x) => a + x.systolic, 0) / v.length),
                dia: Math.round(v.reduce((a, x) => a + x.diastolic, 0) / v.length),
                hr: Math.round(v.reduce((a, x) => a + x.heartRate, 0) / v.length),
                temp: Number((v.reduce((a, x) => a + x.temperature, 0) / v.length).toFixed(1)),
            } : null;
            const anormal = (x: typeof v[number]) =>
                x.systolic > 140 || x.systolic < 90 || x.diastolic > 90 || x.diastolic < 60 || x.heartRate > 100 || x.heartRate < 55 || x.temperature >= 99.5;

            const señales: string[] = [];
            if (prom && (prom.sys > 140 || prom.dia > 90)) señales.push(`Hipertension promedio: ${prom.sys}/${prom.dia} mmHg`);
            if (prom && prom.hr > 100) señales.push(`Taquicardia promedio: ${prom.hr} bpm`);
            if (prom && prom.temp >= 99.5) señales.push(`Temperatura elevada promedio: ${prom.temp} F`);
            const nFuera = v.filter(anormal).length;
            if (nFuera >= 5) señales.push(`${nFuera} lecturas anormales en 30 dias`);
            if (p.fallIncidents.length > 0) señales.push(`${p.fallIncidents.length} caida(s) en 30 dias`);
            if (p.dailyLogs.length >= 3) señales.push(`${p.dailyLogs.length} alertas clinicas en 30 dias`);

            const meta: DossierMeta = {
                nombre: p.name,
                habitacion: p.roomNumber, grupoColor: p.colorGroup, dieta: p.diet,
                alergias: textoDeAlergias(p.intakeData?.allergies),
                alergiasSinDocumentar: alergiasSinDocumentar(p.intakeData?.allergies),
                diagnosticos: p.intakeData?.diagnoses ?? null,
                señalesDeAlarma: señales,
                vitales: v.map(x => ({
                    date: x.createdAt.toISOString(), systolic: x.systolic, diastolic: x.diastolic,
                    heartRate: x.heartRate, temperature: x.temperature,
                    measuredBy: x.measuredBy?.name ?? null, isAbnormal: anormal(x),
                })),
                promedio: prom,
                medicamentos: p.medications.map(pm => ({
                    name: pm.medication.name, dosage: pm.medication.dosage, route: pm.medication.route,
                    frequency: pm.frequency, scheduleTimes: pm.scheduleTimes,
                })),
                caidas: p.fallIncidents.map(f => ({ date: f.reportedAt.toISOString(), severity: f.severity, notes: f.notes, interventions: f.interventions })),
                alertas: p.dailyLogs.map(l => ({ date: l.createdAt.toISOString(), notes: l.notes, author: l.author?.name ?? null })),
                analisis: ANALISIS_PEOR_CASO,
                hogar: { nombre: sede.name, telefono: sede.phone, direccion: sede.billingAddress, logo: sede.logoUrl },
                generadoAt: new Date(), desde: hace30,
            };

            const { doc, omitido } = construirDossierPDF(meta);
            // --guardar <trozo del nombre>: escribe el PDF para poder mirarlo.
            const guardar = process.argv.indexOf('--guardar');
            if (guardar > -1 && p.name.toLowerCase().includes((process.argv[guardar + 1] ?? '').toLowerCase())) {
                const fs = await import('fs');
                const ruta = `/tmp/dossier-${p.name.trim().split(/\s+/)[0].toLowerCase()}.pdf`;
                fs.writeFileSync(ruta, Buffer.from(doc.output('arraybuffer')));
                console.log(`   >> escrito ${ruta}`);
            }
            const paginas = (doc.internal as unknown as { getNumberOfPages: () => number }).getNumberOfPages();
            peor = Math.max(peor, paginas); total++;
            if (omitido.length) conAviso++;
            const marca = paginas > 2 ? '  <-- SE PASA' : '';
            const corte = omitido.length ? `  RECORTA: ${omitido.join(', ')}` : '';
            console.log(`   ${paginas}p · ${String(v.length).padStart(2)} vit (${String(v.filter(anormal).length).padStart(2)} fuera) · ${String(p.medications.length).padStart(2)} meds · ${p.fallIncidents.length} caid · ${p.dailyLogs.length} alert · ${p.name.trim()}${marca}${corte}`);
        }
    }
    console.log(`\nRESULTADO: ${total} dossiers · maximo ${peor} paginas · ${peor <= 2 ? 'TOPE RESPETADO' : 'TOPE ROTO'}`);
    console.log(`Con aviso de recorte al pie: ${conAviso} de ${total}. Ninguno recorta en silencio.`);
}
main().finally(() => prisma.$disconnect());
