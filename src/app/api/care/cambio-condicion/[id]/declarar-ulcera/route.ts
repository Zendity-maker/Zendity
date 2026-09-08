/**
 * DE "EL PISO VIO ALGO EN LA PIEL" A UNA ÚLCERA CON FICHA
 * ──────────────────────────────────────────────────────
 * El eslabón que faltaba, y el hueco más caro que ha tenido este módulo.
 *
 * MEDIDO EN CUPEY EL 06-SEP-2026: el módulo de UPP enseñaba DOS úlceras. Once
 * residentes más tenían úlceras escritas en notas de turno y ninguna ficha.
 * Entre ellos, uno que se fue al hospital —"[TRASLADO HOSPITALARIO] Motivo:
 * Curación d úlcera"— por una úlcera que el sistema no sabía que existía. Y
 * otra cuya nota dice "la úlcera no mejora debido a la incontinencia fecal",
 * que es exactamente el caso para el que existe la escalada de enfermería.
 *
 * POR QUÉ PASABA. El botón "Alerta Piel / UPP" de la tableta escribía una nota
 * de texto libre y nada más. No creaba ficha, no avisaba al módulo, no llegaba
 * a ninguna pantalla de enfermería. Se usó cuatro veces y las cuatro se
 * perdieron. Es el mismo patrón de las caídas fuera del módulo: el canal que la
 * gente USA no es el que el sistema MIRA.
 *
 * POR QUÉ DECLARAR Y CERRAR VAN JUNTOS. Si fueran dos pasos —cerrar el cambio
 * aquí, declarar la úlcera allá— alguien haría el primero y se iría. Ya pasó:
 * un cambio de piel cerrado con "actualicé el expediente" deja la nota resuelta
 * y la úlcera sin existir. Una transacción, un gesto, o las dos cosas o ninguna.
 *
 * LA CUIDADORA NO CLASIFICA. Ella reporta lo que ve; el estadio y la
 * localización los pone quien puede hacerlo. Por eso este endpoint es de
 * enfermería y dirección, y la nota original viaja entera a la ficha para que
 * quien clasifica lea lo que vio el piso, no un resumen.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { notifyRoles, notifyUser } from '@/lib/notifications';
import { PUEDEN_REVISAR_CAMBIO, respuestaParaQuienReporto } from '@/lib/cambios-de-condicion';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
    const auth = await requireRole(PUEDEN_REVISAR_CAMBIO);
    if (auth instanceof NextResponse) return auth;

    try {
        const { id } = await ctx.params;
        const body = await req.json().catch(() => ({}));
        const bodyLocation = String(body.bodyLocation ?? '').trim();
        const stage = Number(body.stage);
        const respuesta = String(body.respuesta ?? '').trim();
        const planTratamiento = String(body.planTratamiento ?? '').trim();
        const planEstablecidoPor = String(body.planEstablecidoPor ?? '').trim();

        if (!bodyLocation) {
            return NextResponse.json({ success: false, error: 'Falta dónde está la úlcera' }, { status: 400 });
        }
        if (!Number.isInteger(stage) || stage < 1 || stage > 4) {
            return NextResponse.json({ success: false, error: 'El estadio va de 1 a 4' }, { status: 400 });
        }

        const cambio = await prisma.cambioDeCondicion.findFirst({
            where: { id, headquartersId: auth.headquartersId },
            select: {
                id: true, revisadoAt: true, area: true, descripcion: true,
                reportadoPorId: true, reportadoAt: true,
                patient: { select: { id: true, name: true } },
            },
        });
        if (!cambio) return NextResponse.json({ success: false, error: 'No encontrado' }, { status: 404 });
        if (cambio.revisadoAt) return NextResponse.json({ success: false, error: 'Ya fue revisado.' }, { status: 409 });

        const fechaReporte = cambio.reportadoAt.toLocaleDateString('es-PR', {
            day: '2-digit', month: 'long', year: 'numeric', timeZone: 'America/Puerto_Rico',
        });

        const ulcera = await prisma.$transaction(async (tx) => {
            const u = await tx.pressureUlcer.create({
                data: {
                    patientId: cambio.patient.id,
                    stage,
                    bodyLocation: bodyLocation.slice(0, 120),
                    status: 'ACTIVE',
                    // La úlcera se identificó CUANDO EL PISO LA VIO, no cuando
                    // enfermería llegó a la cola. Poner la fecha de hoy borraría
                    // los días que lleva y arrancaría los relojes en cero.
                    identifiedAt: cambio.reportadoAt,
                    planTratamiento: planTratamiento ? planTratamiento.slice(0, 4000) : null,
                    planEstablecidoPor: planEstablecidoPor ? planEstablecidoPor.slice(0, 120) : null,
                    planActualizadoAt: planTratamiento ? new Date() : null,
                },
            });

            // La nota original entera, no un resumen: es lo que vio quien estaba
            // delante, y es lo único de primera mano que va a quedar.
            await tx.ulcerLog.create({
                data: {
                    ulcerId: u.id,
                    nurseId: auth.id,
                    tipo: 'VALORACION',
                    treatmentApplied: null,
                    notes: `Declarada desde un cambio de condición reportado por el piso el ${fechaReporte}. `
                        + `Lo que se reportó: "${cambio.descripcion.trim()}"`
                        + (respuesta ? `\n\nValoración de enfermería: ${respuesta}` : ''),
                },
            });

            await tx.cambioDeCondicion.update({
                where: { id },
                data: {
                    revisadoAt: new Date(),
                    revisadoPorId: auth.id,
                    resultado: 'ULCERA_DECLARADA',
                    respuesta: (respuesta || `Se declaró úlcera estadio ${stage} en ${bodyLocation}.`).slice(0, 2000),
                },
            });

            await tx.triageTicket.create({
                data: {
                    headquartersId: auth.headquartersId,
                    patientId: cambio.patient.id,
                    originType: 'DAILY_LOG',
                    originReferenceId: u.id,
                    priority: stage >= 3 ? 'CRITICAL' : 'HIGH',
                    status: 'OPEN',
                    description: `[UPP Estadio ${stage}] ${bodyLocation} — ${cambio.patient.name.trim()}. `
                        + `Declarada desde reporte del piso del ${fechaReporte}.`,
                },
            });

            return u;
        });

        // Quien lo reportó merece saber que su aviso sirvió para algo. Es la
        // diferencia entre reportar y gritar al vacío.
        notifyUser(cambio.reportadoPorId, {
            type: 'TRIAGE',
            title: 'Lo que reportaste es una úlcera',
            message: `${cambio.patient.name.trim()}: estadio ${stage} en ${bodyLocation}. `
                + respuestaParaQuienReporto('ULCERA_DECLARADA')
                + (respuesta ? ` — ${respuesta.slice(0, 160)}` : ''),
            link: '/care/nursing',
        }).catch(e => console.error('[declarar-ulcera] aviso al piso:', e));

        notifyRoles(auth.headquartersId, ['NURSE', 'SUPERVISOR', 'DIRECTOR'], {
            type: 'TRIAGE',
            title: 'Nueva UPP declarada',
            message: `${cambio.patient.name.trim()} — estadio ${stage} en ${bodyLocation}, desde un reporte del piso.`,
            link: '/care/nursing',
        }, auth.id).catch(e => console.error('[declarar-ulcera] aviso:', e));

        return NextResponse.json({
            success: true,
            ulceraId: ulcera.id,
            mensaje: `Úlcera declarada: estadio ${stage} en ${bodyLocation}.`,
        });
    } catch (error) {
        console.error('[declarar-ulcera]', error);
        const msg = (error as Error)?.message ?? 'error desconocido';
        return NextResponse.json({ success: false, error: `No se pudo declarar: ${msg.slice(0, 180)}` }, { status: 500 });
    }
}
