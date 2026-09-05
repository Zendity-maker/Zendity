/**
 * REGISTRO DE UNA VISITA EN EL KIOSCO DE RECEPCIÓN
 * ───────────────────────────────────────────────
 * Recepción es LA PUERTA: por aquí entra todo el mundo. Lo que un proveedor
 * externo hace adentro —qué residentes atiende, qué servicio, avisar a las
 * familias— sigue siendo del kiosco de servicios externos.
 *
 *   FAMILIAR          residente, parentesco, firma. Avisa a su cuidadora.
 *   TOUR              teléfono, correo, de quién se está averiguando.
 *   OFICIAL           entidad y motivo.
 *   SERVICIO_EXTERNO  profesión, entidad, a qué residentes viene.
 *
 * Historial de lo que estaba roto aquí, para que no vuelva:
 *   · No pedía NINGUNA credencial. Público en internet.
 *   · La sede salía del cuerpo de la petición vía `patientId`.
 *   · La hora la ponía la tablet del visitante.
 *   · El `catch` final devolvía `success: true` con la base vacía.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireKioskDevice, touchKioskDevice } from '@/lib/external-kiosk-auth';
import { cuidadorasDeResidente } from '@/lib/cuidadora-a-cargo';
import { evaluarAcceso, resumenParaPersonal } from '@/lib/visitantes-autorizados';
import { estadoHorarioDeSede } from '@/lib/horario-visitas';

export const dynamic = 'force-dynamic';

const TIPOS = ['FAMILIAR', 'TOUR', 'OFICIAL', 'SERVICIO_EXTERNO'];
/** Los tipos que nombran a un residente. */
const CON_RESIDENTE = ['FAMILIAR', 'SERVICIO_EXTERNO'];

export async function POST(req: Request) {
    const device = await requireKioskDevice(req);
    if (device instanceof NextResponse) return device;

    const hqId = device.headquartersId;

    try {
        const body = await req.json();
        const tipo = String(body.tipo ?? 'FAMILIAR');
        const visitorName = String(body.visitorName ?? '').trim();

        if (!TIPOS.includes(tipo)) {
            return NextResponse.json({ success: false, error: `Tipo de visita no reconocido: ${tipo}` }, { status: 400 });
        }
        if (!visitorName) {
            return NextResponse.json({ success: false, error: 'Falta el nombre del visitante' }, { status: 400 });
        }

        /**
         * Fuera de horario: no se bloquea, se exige autorización.
         *
         * SOLO APLICA A LAS VISITAS A RESIDENTES. El horario de visitas regula
         * cuándo la familia y las amistades pueden entrar a ver a alguien; no
         * regula cuándo el hogar recibe servicios. Una enfermera de hospicio, una
         * terapista o un médico llegan cuando el residente los necesita, y un
         * inspector de agencia llega cuando le toca —a veces sin avisar, que es
         * justamente el punto de una inspección.
         *
         * Pedirle el PIN de una supervisora a la enfermera de hospicio de las
         * 2 de la madrugada convertiría una regla de cortesía en un obstáculo
         * clínico.
         *
         * El `autorizadaPorId` lo devuelve /api/reception/autorizar tras validar
         * el PIN de alguien del personal. Aquí se comprueba que ese id sea de
         * verdad de esta sede: sin eso, la tablet podría mandar cualquier id y
         * el asiento diría que autorizó alguien que no estaba.
         */
        const rigeElHorario = tipo === 'FAMILIAR';
        const horario = rigeElHorario
            ? await estadoHorarioDeSede(hqId)
            : { dentro: true, explicacion: '', horario: null as never };
        let autorizadaPorId: string | null = null;
        if (!horario.dentro) {
            const propuesto = String(body.autorizadaPorId ?? '').trim();
            if (!propuesto) {
                return NextResponse.json({
                    success: false, fueraDeHorario: true,
                    error: `${horario.explicacion} Un miembro del personal debe autorizar esta visita.`,
                }, { status: 403 });
            }
            const quien = await prisma.user.findFirst({
                where: { id: propuesto, headquartersId: hqId, isActive: true, isDeleted: false },
                select: { id: true },
            });
            if (!quien) {
                return NextResponse.json({ success: false, error: 'La autorización no es válida.' }, { status: 403 });
            }
            autorizadaPorId = quien.id;
        }

        // ── Residentes, solo para los tipos que los nombran ──────────────────
        let principal: { id: string; name: string } | null = null;
        let adicionales: { id: string; name: string }[] = [];

        if (CON_RESIDENTE.includes(tipo)) {
            const ids: string[] = Array.isArray(body.patientIds)
                ? body.patientIds.map(String).filter(Boolean)
                : (body.patientId ? [String(body.patientId)] : []);

            if (ids.length > 0) {
                // TODOS dentro de la sede del dispositivo. Un id de otra sede no
                // encuentra fila: no se confirma que exista.
                const encontrados = await prisma.patient.findMany({
                    where: { id: { in: ids }, headquartersId: hqId, status: 'ACTIVE' },
                    select: { id: true, name: true },
                });
                principal = encontrados[0] ?? null;
                adicionales = encontrados.slice(1);
            } else if (body.residentName) {
                principal = await prisma.patient.findFirst({
                    where: { name: { contains: String(body.residentName), mode: 'insensitive' }, headquartersId: hqId, status: 'ACTIVE' },
                    select: { id: true, name: true },
                });
            }

            if (!principal) {
                return NextResponse.json({ success: false, error: 'Residente no encontrado en esta sede' }, { status: 404 });
            }
        }

        /**
         * Acceso restringido.
         *
         * Con SERVICIO_EXTERNO solo corre la lista negra: una orden de
         * protección apunta a personas concretas y esas quedan fuera vengan a
         * lo que vengan, pero aplicar el modo estricto dejaría esperando a la
         * enfermera de hospicio en cada visita.
         */
        const acceso = principal
            ? await evaluarAcceso(hqId, principal.id, visitorName, tipo === 'SERVICIO_EXTERNO')
            : { retener: false as const };

        const visitedAt = new Date();

        // Esto SÍ bloquea: es el asiento de la bitácora. Si falla, que se sepa.
        const visit = await prisma.familyVisit.create({
            data: {
                tipo,
                visitorName,
                residentName: principal?.name ?? null,
                patientId: principal?.id ?? null,
                visitorRelation: String(body.visitorRelation ?? '').trim() || null,
                visitorPhone: String(body.visitorPhone ?? '').trim() || null,
                visitorEmail: String(body.visitorEmail ?? '').trim() || null,
                futuroResidente: String(body.futuroResidente ?? '').trim() || null,
                entidad: String(body.entidad ?? '').trim() || null,
                profesion: String(body.profesion ?? '').trim() || null,
                notes: String(body.motivo ?? '').trim() || null,
                headquartersId: hqId,
                signatureData: body.signatureData ? String(body.signatureData).substring(0, 50000) : null,
                visitedAt,
                fueraDeHorario: !horario.dentro,
                autorizadaPorId,
                retenida: acceso.retener,
                notified: false,
                ...(adicionales.length > 0
                    ? { pacientes: { create: adicionales.map(a => ({ patientId: a.id })) } }
                    : {}),
            },
            select: { id: true, visitedAt: true },
        });

        touchKioskDevice(device.id);

        const dateStr = visitedAt.toLocaleDateString('es-PR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const timeStr = visitedAt.toLocaleTimeString('es-PR', { hour: '2-digit', minute: '2-digit' });

        const supervision = await prisma.user.findMany({
            where: { headquartersId: hqId, role: { in: ['SUPERVISOR', 'DIRECTOR', 'ADMIN'] }, isActive: true, isDeleted: false },
            select: { id: true },
        });

        // ── Alguien esperando asistencia ────────────────────────────────────
        if (acceso.retener && principal) {
            /**
             * EL AVISO NO LLEVA VEREDICTO. "No autorizado" es un juicio que la
             * tablet puede equivocar —un nombre escrito distinto, un yerno que
             * nadie añadió— y quien camine hasta recepción llegaría con un
             * prejuicio sobre alguien que puede estar perfectamente bien.
             *
             * TIPO `FAMILY_VISIT` a propósito: la tablet de cuido sondea
             * ÚNICAMENTE ese tipo. Uno nuevo sería invisible ahí.
             */
            const cuidadoras = await cuidadorasDeResidente(hqId, principal.id).catch(() => []);
            const destinatarios = [...new Set([...supervision.map(u => u.id), ...cuidadoras.map(c => c.userId)])];
            await Promise.all(destinatarios.map(userId =>
                prisma.notification.create({
                    data: {
                        userId, type: 'FAMILY_VISIT',
                        title: `Visita esperando asistencia — ${principal!.name}`,
                        message: `${resumenParaPersonal(acceso, visitorName)} Está esperando en recepción. El detalle está en el perfil del residente, en Acceso de visitas.`,
                        isRead: false,
                    },
                }).catch(() => null),
            ));
            return NextResponse.json({
                success: true, retenida: true, visit,
                mensaje: 'Por favor espere un momento. Ya avisamos al personal de recepción.',
            });
        }

        // ── La visita sigue su curso ────────────────────────────────────────
        if (tipo === 'FAMILIAR' && principal) {
            prisma.familyVisitNote.create({
                data: {
                    patientId: principal.id, headquartersId: hqId, visitorName, visitedAt,
                    notes: `Visita registrada en recepción: ${visitorName} visitó a ${principal.name} el ${dateStr} a las ${timeStr}.`,
                },
            }).catch(e => console.error('FamilyVisitNote:', e));
        }

        const titulo = tipo === 'FAMILIAR' && principal
            ? `${principal.name} tiene visita`
            : tipo === 'TOUR' ? 'Recorrido en recepción'
            : tipo === 'OFICIAL' ? `Visita oficial — ${String(body.entidad ?? 'sin entidad')}`
            : `Servicio externo — ${String(body.entidad ?? 'sin entidad')}`;

        const cuerpo = tipo === 'FAMILIAR' && principal
            ? `${visitorName} se registró en recepción para visitar a ${principal.name} el ${dateStr} a las ${timeStr}.`
            : tipo === 'TOUR'
                ? `${visitorName} llegó para un recorrido${body.futuroResidente ? `, preguntando por ${body.futuroResidente}` : ''}. ${timeStr}.`
                : `${visitorName}${body.profesion ? ` (${body.profesion})` : ''} se registró en recepción a las ${timeStr}.`;

        // Solo el familiar avisa a la cuidadora del residente: es la única que
        // puede hacer algo con la noticia. Lo demás va a supervisión.
        const cuidadoras = tipo === 'FAMILIAR' && principal
            ? await cuidadorasDeResidente(hqId, principal.id).catch(() => [])
            : [];
        const destinatarios = [...new Set([...supervision.map(u => u.id), ...cuidadoras.map(c => c.userId)])];

        Promise.all(destinatarios.map(userId =>
            prisma.notification.create({
                data: { userId, type: 'FAMILY_VISIT', title: titulo, message: cuerpo, isRead: false },
            }).catch(() => null),
        )).catch(e => console.error('Notificación de visita:', e));

        return NextResponse.json({
            success: true,
            retenida: false,
            visit,
            tipo,
            patient: principal?.name ?? null,
            residentes: principal ? [principal.name, ...adicionales.map(a => a.name)] : [],
            fueraDeHorario: !horario.dentro,
            registradaA: visitedAt.toISOString(),
        });
    } catch (error) {
        console.error('Reception visit error:', error);
        return NextResponse.json(
            { success: false, error: 'No se pudo registrar la visita. Avisa al personal.' },
            { status: 500 },
        );
    }
}
