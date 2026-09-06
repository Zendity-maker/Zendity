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
 * QUIÉN PUEDE — Y AHORA DEPENDE DEL TIPO (06-sep-2026). Ver src/lib/upp.ts.
 * Antes esto solo sabía escribir CURACIONES y solo enfermería/dirección podían.
 * Pero en el hogar pasan tres cosas distintas sobre la misma herida:
 *
 *   CURACION        el tratamiento del plan del home care — enfermería/dirección
 *   CAMBIO_APOSITO  la cuidadora limpia y tapa hasta que venga la enfermera
 *   VALORACION      alguien con criterio la mira y dice cómo va
 *
 * A la cuidadora NO se le pregunta qué aplicó: no aplica tratamiento, limpia y
 * tapa. Preguntárselo la obligaría a inventarse una respuesta y el expediente
 * se llenaría de tratamientos que nadie indicó. Se le pregunta POR QUÉ.
 *
 * Y su registro NO reinicia el reloj de la curación. Si lo reiniciara,
 * Enfermería se callaría porque alguien cambió una gasa — que es exactamente la
 * forma de que una úlcera estadio 4 pase 77 días sin que nadie la trate.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/api-auth';
import { notifyRoles } from '@/lib/notifications';
import { TIPOS_UPP, puedeRegistrar, avisoAEnfermeria, etiquetaDeMotivo, etiquetaDeCierre, MOTIVOS_CAMBIO, MOTIVOS_CIERRE, ESTADOS_UPP, type TipoRegistroUpp } from '@/lib/upp';

export const dynamic = 'force-dynamic';

/**
 * DOS FORMAS DE CERRAR, Y NO SIGNIFICAN LO MISMO.
 *
 *   RESOLVED              la herida sanó
 *   CERRADA_SIN_RESOLVER  dejó de seguirse sin sanar — el residente falleció,
 *                         salió del hogar o pasó a manos del hospital
 *
 * Wilfredo Matos falleció y sus dos úlceras llevaban 85 días abiertas, porque
 * la única forma de cerrarlas era declararlas sanadas. Eso es escribir en un
 * expediente clínico que una herida sanó cuando lo que pasó es que el residente
 * murió. Se dejaron abiertas, y el conteo de Enfermería mintió tres meses.
 *
 * `resolvedAt` SOLO se sella cuando sanó de verdad. El cierre sin resolver vive
 * en `status`, y su motivo queda en el UlcerLog del cierre.
 */
const ESTADOS: string[] = [...ESTADOS_UPP];

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
    const auth = await getSessionUser();
    if (!auth) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });

    try {
        const { id } = await ctx.params;
        const body = await req.json().catch(() => ({}));

        // El TIPO decide todo lo demás: quién puede, qué se pide y qué reloj se
        // mueve. Sin tipo explícito se asume CURACION, que es lo que este
        // endpoint escribía antes de sep-2026.
        const tipo = (String(body.tipo ?? 'CURACION').trim() || 'CURACION') as TipoRegistroUpp;
        if (!(tipo in TIPOS_UPP)) {
            return NextResponse.json({ success: false, error: 'Tipo de registro no válido' }, { status: 400 });
        }
        const def = TIPOS_UPP[tipo];

        // Rol primario O secundario: en Cupey la enfermería la hace una DIRECTOR
        // con NURSE secundario, así que mirar solo el primario no alcanza.
        if (!puedeRegistrar(tipo, [auth.role, ...auth.secondaryRoles])) {
            return NextResponse.json({ success: false, error: `Tu rol no puede registrar: ${def.etiqueta}` }, { status: 403 });
        }

        const treatmentApplied = String(body.treatmentApplied ?? '').trim();
        const motivo = String(body.motivo ?? '').trim();
        const notes = String(body.notes ?? '').trim();
        const woundSize = String(body.woundSize ?? '').trim();
        const photoUrl = typeof body.photoUrl === 'string' ? body.photoUrl : null;
        const nuevoEstadio = def.puedeCambiarEstadio && body.stage != null ? Number(body.stage) : null;
        const nuevoEstado = def.puedeCambiarEstadio && body.status ? String(body.status).trim() : null;

        // Cerrar es un acto en sí mismo: no se le pide a nadie que invente una
        // curación para poder cerrar la úlcera de alguien que se murió.
        const cerrandoSinResolver = nuevoEstado === 'CERRADA_SIN_RESOLVER';
        const cerrando = cerrandoSinResolver || nuevoEstado === 'RESOLVED';
        const motivoCierre = String(body.motivoCierre ?? '').trim();

        if (cerrandoSinResolver && !MOTIVOS_CIERRE.some(m => m.codigo === motivoCierre)) {
            return NextResponse.json({ success: false, error: 'Falta por qué se cierra sin resolver' }, { status: 400 });
        }
        if (cerrandoSinResolver && motivoCierre === 'OTRO' && !notes) {
            return NextResponse.json({ success: false, error: 'Escribe la razón del cierre' }, { status: 400 });
        }
        if (!cerrando && def.pideTratamiento && !treatmentApplied) {
            return NextResponse.json({ success: false, error: 'Falta qué se aplicó' }, { status: 400 });
        }
        if (def.pideMotivo && !MOTIVOS_CAMBIO.some(m => m.codigo === motivo)) {
            return NextResponse.json({ success: false, error: 'Falta por qué se cambió el apósito' }, { status: 400 });
        }
        // "Otra cosa" sin escribir cuál no es un motivo: es un hueco con etiqueta.
        if (motivo === 'OTRO' && !notes) {
            return NextResponse.json({ success: false, error: 'Escribe qué pasó' }, { status: 400 });
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
                    // El cierre es su propio tipo de registro: la fila dice
                    // "cerrada porque falleció", no "curación sin tratamiento".
                    tipo: cerrando ? 'CIERRE' : tipo,
                    motivo: cerrandoSinResolver ? motivoCierre : def.pideMotivo ? motivo : null,
                    treatmentApplied: !cerrando && def.pideTratamiento ? treatmentApplied.slice(0, 500) : null,
                    // `notes` es obligatorio en el modelo. Si no se escribe nada,
                    // se guarda lo que dé sentido a la fila —lo aplicado, o el
                    // motivo— en vez de un string vacío que nadie sabe leer.
                    notes: (
                        notes
                        || (cerrandoSinResolver ? etiquetaDeCierre(motivoCierre) : '')
                        || (nuevoEstado === 'RESOLVED' ? 'La úlcera sanó.' : '')
                        || treatmentApplied
                        || etiquetaDeMotivo(motivo)
                    ).slice(0, 2000),
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
                // `resolvedAt` significa SANÓ. Un cierre sin resolver no lo
                // sella: si lo hiciera, dentro de un año nadie sabría si la
                // herida cerró o el residente se fue.
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
                    + `Registrado por ${auth.name ?? 'personal'}.`
                    + (treatmentApplied ? ` Aplicado: ${treatmentApplied.slice(0, 120)}` : ''),
                link: '/care/nursing',
            }, auth.id).catch(e => console.error('Aviso de UPP que empeora:', e));
        }

        /**
         * EL PISO VE, LA ENFERMERA DECIDE.
         *
         * Contaminación fecal sobre un estadio 3 o 4, o tres cambios en 24
         * horas, no esperan a la próxima visita: a ese ritmo el plan no está
         * aguantando y eso lo juzga enfermería, no la cuidadora que va por el
         * tercero. El aviso NO bloquea el registro — se anota y se sigue.
         */
        let avisado: string | null = null;
        if (tipo === 'CAMBIO_APOSITO') {
            const desde = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const cambiosHoy = await prisma.ulcerLog.count({
                where: { ulcerId: id, tipo: 'CAMBIO_APOSITO', createdAt: { gte: desde } },
            });
            avisado = avisoAEnfermeria(motivo, ulcera.stage, cambiosHoy);
            if (avisado) {
                notifyRoles(auth.headquartersId, ['NURSE', 'DIRECTOR'], {
                    type: 'TRIAGE',
                    title: `Apósito — ${ulcera.patient.name.trim()}`,
                    message: `${ulcera.bodyLocation} (estadio ${ulcera.stage}): ${avisado} `
                        + `Último cambio por ${auth.name ?? 'personal'}: ${etiquetaDeMotivo(motivo).toLowerCase()}.`,
                    link: '/care/nursing',
                }, auth.id).catch(e => console.error('Aviso de apósito:', e));
            }
        }

        const base = tipo === 'CAMBIO_APOSITO'
            ? 'Cambio de apósito registrado. La curación sigue pendiente de la enfermera.'
            : tipo === 'VALORACION' ? 'Valoración registrada.' : 'Curación registrada.';

        return NextResponse.json({
            success: true,
            logId: log.id,
            mensaje: cerrandoSinResolver
                ? `Úlcera cerrada sin resolver — ${etiquetaDeCierre(motivoCierre).toLowerCase()}.`
                : nuevoEstado === 'RESOLVED'
                ? 'Úlcera cerrada: sanó.'
                : empeora ? `${base} Se avisó del deterioro.`
                : avisado ? `${base} Se avisó a enfermería.` : base,
        });
    } catch (error) {
        console.error('Curación UPP:', error);
        return NextResponse.json({ success: false, error: 'No se pudo registrar' }, { status: 500 });
    }
}
