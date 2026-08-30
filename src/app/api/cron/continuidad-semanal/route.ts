import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateContinuityPDF } from '@/lib/continuity-pdf';
import sgMail from '@sendgrid/mail';

export const dynamic = 'force-dynamic';

/**
 * Paquete de Continuidad — envío semanal a cada sede.
 *
 * POR QUÉ EXISTE. El paquete se generaba solo bajo demanda, y solo lo podía
 * sacar SUPER_ADMIN. Eso deja un agujero que la caída del 29-ago-2026 dejó a la
 * vista: **un paquete de continuidad que necesita el sistema arriba no es un
 * paquete de continuidad.** El día del huracán no hay quien lo descargue.
 *
 * La única defensa real es que ya esté impreso antes de hacer falta. Pero un
 * papel impreso caduca: el censo cambia, la medicación cambia, aparece una
 * alergia nueva. Un MAR de hace tres meses es PEOR que no tener ninguno,
 * porque quien lo lee se fía de él.
 *
 * Por eso llega solo, cada semana: la copia impresa se reemplaza y la vieja se
 * destruye. Nadie tiene que acordarse de generarlo, que es justo lo que no
 * ocurre cuando hace falta.
 *
 * Va a dirección y enfermería de cada sede activa. Lleva PHI —es el punto— y
 * por eso queda en el audit log igual que la descarga manual.
 *
 * Cron sugerido: lunes 6:00 AM AST → "0 10 * * 1" en UTC.
 */
export async function GET(req: Request) {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
        return NextResponse.json({ error: 'CRON_SECRET no configurado' }, { status: 500 });
    }
    if (req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Firma CRON inválida' }, { status: 401 });
    }

    try {
        const sedes = await prisma.headquarters.findMany({
            where: { isActive: true },
            select: { id: true, name: true },
        });

        const remitente = process.env.SENDGRID_FROM_EMAIL;
        const resultados: any[] = [];

        for (const sede of sedes) {
            // Mismo criterio que la descarga manual: los hospitalizados vuelven
            // y su medicación sigue vigente.
            const patients = await prisma.patient.findMany({
                where: { headquartersId: sede.id, status: { in: ['ACTIVE', 'TEMPORARY_LEAVE'] } },
                select: {
                    name: true, roomNumber: true, diet: true,
                    needsDialysis: true, requiresPosturalChanges: true, nortonRisk: true,
                    careModality: true, hospiceProvider: true,
                    intakeData: { select: { allergies: true } },
                    // Mismo select que la descarga manual: la dosis vive en el
                    // catalogo Medication, no en PatientMedication.
                    medications: {
                        where: { isActive: true, status: 'ACTIVE' },
                        select: {
                            frequency: true, scheduleTimes: true, instructions: true,
                            medication: { select: { name: true, dosage: true } },
                        },
                    },
                },
                orderBy: [{ roomNumber: 'asc' }, { name: 'asc' }],
            });

            if (patients.length === 0) { resultados.push({ sede: sede.name, saltada: 'sin residentes' }); continue; }

            const destinatarios = await prisma.user.findMany({
                where: {
                    headquartersId: sede.id, isActive: true, isDeleted: false,
                    role: { in: ['DIRECTOR', 'ADMIN', 'NURSE'] as any },
                },
                select: { email: true },
            });
            const emails = destinatarios.map(d => d.email).filter(e => e && e.includes('@'));
            if (emails.length === 0) { resultados.push({ sede: sede.name, saltada: 'sin destinatarios' }); continue; }

            const pdf = generateContinuityPDF({
                hqName: sede.name,
                generatedAt: new Date(),
                residents: patients.map(p => ({
                    name: p.name.trim(),
                    roomNumber: p.roomNumber,
                    allergies: p.intakeData?.allergies ?? null,
                    diet: p.diet ?? null,
                    meds: p.medications.map(m => ({
                        name: m.medication?.name ?? 'Medicamento',
                        dosage: m.medication?.dosage ?? '',
                        times: horarios(m.scheduleTimes),
                        instructions: m.instructions,
                    })),
                    alerts: [
                        p.needsDialysis ? 'Diálisis periódica' : null,
                        p.requiresPosturalChanges ? 'Rotación postural c/2h' : null,
                        p.nortonRisk ? 'Riesgo Norton' : null,
                        p.careModality !== 'NONE'
                            ? `${p.careModality === 'HOSPICE' ? 'Hospicio' : 'Paliativo'}${p.hospiceProvider ? ` — ${p.hospiceProvider}` : ''}`
                            : null,
                    ].filter((a): a is string => !!a),
                })),
            });

            if (!process.env.SENDGRID_API_KEY || !remitente) {
                resultados.push({ sede: sede.name, saltada: 'SendGrid no configurado', residentes: patients.length });
                continue;
            }

            await sgMail.send({
                to: emails,
                from: remitente,
                isMultiple: true,
                subject: `Paquete de continuidad — ${sede.name} — semana del ${new Date().toLocaleDateString('es-PR', { day: '2-digit', month: 'long', timeZone: 'America/Puerto_Rico' })}`,
                html: `<meta charset="utf-8"><div style="background:#ffffff;color:#12211D;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;line-height:1.65;padding:28px;max-width:560px;margin:0 auto;">
<p style="margin:0 0 16px;font-size:18px;font-weight:800;color:#12211D;">Paquete de continuidad de esta semana</p>
<p style="margin:0 0 16px;font-size:15px;color:#12211D;">Adjunto va el paquete con el que ${sede.name} puede operar en papel si Zéndity no está disponible: censo, ficha y MAR de cada residente, y las hojas de registro.</p>
<div style="background:#FAF0E2;border-left:4px solid #B0731E;padding:14px 16px;margin:0 0 16px;">
<p style="margin:0;font-size:14px;color:#5C4210;"><strong>Imprímelo y reemplaza el del sitio de siempre.</strong> Destruye el de la semana pasada — un MAR viejo es peor que no tener ninguno, porque quien lo lee se fía de él.</p>
</div>
<p style="margin:0 0 16px;font-size:14px;color:#66766F;">Las hojas en blanco —turno, vitales, incidente— no caducan. Esas se fotocopian y se quedan.</p>
<p style="margin:0;font-size:13px;color:#66766F;">${patients.length} residentes · generado automáticamente cada lunes.</p>
</div>`,
                attachments: [{
                    content: Buffer.from(pdf).toString('base64'),
                    filename: `continuidad-${sede.name.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.pdf`,
                    type: 'application/pdf',
                    disposition: 'attachment',
                }],
            });

            resultados.push({ sede: sede.name, enviado: emails.length, residentes: patients.length });
        }

        return NextResponse.json({ success: true, sedes: resultados });
    } catch (e: any) {
        console.error('[cron/continuidad-semanal]', e);
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}

/** scheduleTimes puede venir como JSON `["08:00"]` o CSV `"08:00, 14:00"`. */
function horarios(raw: string | null): string[] {
    if (!raw) return [];
    try {
        const j = JSON.parse(raw);
        if (Array.isArray(j)) return j.map(String);
    } catch { /* cae al CSV */ }
    return raw.split(',').map(s => s.trim()).filter(Boolean);
}
