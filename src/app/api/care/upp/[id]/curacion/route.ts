/**
 * CURACIÓN DE UNA ÚLCERA — Y SU CIERRE
 * ────────────────────────────────────
 * POST añade una curación a una úlcera que ya existe, y de paso permite
 * corregir el estadio o darla por resuelta.
 *
 * POR QUÉ NO EXISTÍA Y POR QUÉ HACE FALTA. `/api/care/upp` solo tenía GET y un
 * POST que CREA una úlcera nueva con su nota inicial. No había forma —ninguna—
 * de añadir una segunda nota, de cambiar el estadio ni de cerrarla.
 *
 * El resultado, medido en Cupey el 05-sep-2026: cuatro úlceras registradas, las
 * cuatro en estado ACTIVE, cada una con EXACTAMENTE UNA curación, la del día en
 * que se declaró.
 *
 *     Luz M. Ríos     Sacra, estadio 4    77 días    1 nota: "Vac System"
 *     Carmen Vélez    Piernas, estadio 1  60 días    1 nota
 *     Wilfredo Matos  Sacra, estadio 1    84 días    1 nota: "tratamiento pendiente"
 *     Wilfredo Matos  Codo/oreja/costado  84 días    1 nota: "tratamiento pendiente"
 *
 * Wilfredo falleció. Sus dos úlceras siguen abiertas porque nada podía cerrarlas.
 *
 * Eso NO quiere decir que no se estén curando: quiere decir que el sistema no lo
 * recogía. La pantalla enseñaba un historial de curaciones al que era imposible
 * añadir nada — prometía y no entregaba.
 *
 * QUIÉN PUEDE. Mismos roles que declarar una úlcera, y por la misma razón que
 * quedó escrita el 24-ago-2026: una supervisora observa y reporta la piel como
 * cualquier cuidadora, pero la clasificación formal es de enfermería o dirección.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { notifyRoles } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

const PUEDEN_CURAR = ['NURSE', 'DIRECTOR', 'ADMIN'];

/** Estados que puede tomar una úlcera. RESOLVED sella `resolvedAt`. */
const ESTADOS = ['ACTIVE', 'HEALING', 'RESOLVED'];

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
    const auth = await requireRole(PUEDEN_CURAR);
    if (auth instanceof NextResponse) return auth;

    try {
        const { id } = await ctx.params;
        const body = await req.json().catch(() => ({}));
        const treatmentApplied = String(body.treatmentApplied ?? '').trim();
        const notes = String(body.notes ?? '').trim();
        const woundSize = String(body.woundSize ?? '').trim();
        const photoUrl = typeof body.photoUrl === 'string' ? body.photoUrl : null;
        const nuevoEstadio = body.stage != null ? Number(body.stage) : null;
        const nuevoEstado = body.status ? String(body.status).trim() : null;

        if (!treatmentApplied) {
            return NextResponse.json({ success: false, error: 'Falta qué se aplicó' }, { status: 400 });
        }
        if (nuevoEstadio !== null && !(Number.isInteger(nuevoEstadio) && nuevoEstadio >= 1 && nuevoEstadio <= 4)) {
            return NextResponse.json({ success: false, error: 'El estadio va de 1 a 4' }, { status: 400 });
        }
        if (nuevoEstado !== null && !ESTADOS.includes(nuevoEstado)) {
            return NextResponse.json({ success: false, error: 'Estado no válido' }, { status: 400 });
        }

        // Ownership por id — la úlcera tiene que ser de un residente de esta sede.
        const ulcera = await prisma.pressureUlcer.findFirst({
            where: { id, patient: { headquartersId: auth.headquartersId } },
            select: {
                id: true, stage: true, status: true, bodyLocation: true, resolvedAt: true,
                patient: { select: { id: true, name: true } },
            },
        });
        if (!ulcera) {
            return NextResponse.json({ success: false, error: 'Úlcera no encontrada' }, { status: 404 });
        }
        if (ulcera.resolvedAt) {
            return NextResponse.json({ success: false, error: 'Esta úlcera ya está cerrada.' }, { status: 409 });
        }

        const empeora = nuevoEstadio !== null && nuevoEstadio > ulcera.stage;

        const [log] = await prisma.$transaction(async (tx) => {
            const l = await tx.ulcerLog.create({
                data: {
                    ulcerId: id,
                    nurseId: auth.id,
                    treatmentApplied: treatmentApplied.slice(0, 500),
                    // `notes` es obligatorio en el modelo. Si no se escribe nada,
                    // se guarda lo aplicado en vez de un string vacío que
                    // después nadie sabe leer.
                    notes: (notes || treatmentApplied).slice(0, 2000),
                    woundSize: woundSize.slice(0, 60) || null,
                    photoUrl: photoUrl,
                    hasPhoto: !!photoUrl,
                },
                select: { id: true, createdAt: true },
            });

            const cambios: Record<string, unknown> = {};
            if (nuevoEstadio !== null && nuevoEstadio !== ulcera.stage) cambios.stage = nuevoEstadio;
            if (nuevoEstado && nuevoEstado !== ulcera.status) {
                cambios.status = nuevoEstado;
                // Cerrar sella la fecha. Reabrir la borra: una úlcera que
                // vuelve a abrirse no puede conservar la fecha en que sanó.
                cambios.resolvedAt = nuevoEstado === 'RESOLVED' ? new Date() : null;
            }
            if (Object.keys(cambios).length > 0) {
                await tx.pressureUlcer.update({ where: { id }, data: cambios });
            }
            return [l];
        });

        /**
         * Una úlcera que sube de estadio es deterioro, y eso no espera al
         * resumen del turno. Estadio 3 y 4 son lesión profunda.
         */
        if (empeora) {
            notifyRoles(auth.headquartersId, ['NURSE', 'SUPERVISOR', 'DIRECTOR'], {
                type: 'TRIAGE',
                title: `UPP empeoró — ${ulcera.patient.name.trim()}`,
                message: `${ulcera.bodyLocation}: pasó de estadio ${ulcera.stage} a ${nuevoEstadio}. `
                    + `Registrado por ${auth.name ?? 'personal'}. Aplicado: ${treatmentApplied.slice(0, 120)}`,
                link: '/care/nursing',
            }, auth.id).catch(e => console.error('Aviso de UPP que empeora:', e));
        }

        return NextResponse.json({
            success: true,
            logId: log.id,
            mensaje: nuevoEstado === 'RESOLVED'
                ? 'Úlcera cerrada.'
                : empeora ? 'Curación registrada. Se avisó del deterioro.' : 'Curación registrada.',
        });
    } catch (error) {
        console.error('Curación UPP:', error);
        return NextResponse.json({ success: false, error: 'No se pudo registrar' }, { status: 500 });
    }
}
