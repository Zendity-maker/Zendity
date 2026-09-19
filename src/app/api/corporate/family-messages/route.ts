import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { avisoFamiliaSinPHI } from '@/lib/family-email';
import { marcaSede } from '@/lib/marca-sede';
import sgMail from '@sendgrid/mail';

if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

// Hub compartido de comunicación familiar — COORDINATOR + DIR/ADMIN/SUP/NURSE.
// Sprint Coordinador (jun-2026): COORDINATOR añadido. requireRole en lugar de
// check inline para soportar dual-rol via secondaryRoles consistente.
//
// MISMA LISTA, LITERAL, QUE LA RUTA GEMELA `api/care/messages`: son la misma
// tabla y las mismas conversaciones. Dos puertas con dos cerraduras distintas
// es cómo se cuela gente por la de atrás.
const ALLOWED_ROLES = ['DIRECTOR', 'ADMIN', 'SUPERVISOR', 'NURSE', 'COORDINATOR'];

/** Bandeja del portal familiar. `recipientType` es nullable en el schema. */
const bandejaDe = (m: { recipientType: string | null }) => m.recipientType ?? 'ADMINISTRATION';

/**
 * ¿ESTE HILO ESTÁ ESPERANDO RESPUESTA?
 *
 * Hasta el 16-sep-2026 la lista se ordenaba por `unreadCount`, y `unreadCount`
 * era cero en TODAS las conversaciones —el PATCH marcaba el hilo entero con
 * solo seleccionarlo—, así que el desempate no se activaba nunca y el orden no
 * significaba nada. Lo que de verdad importa no es si alguien abrió el hilo,
 * sino si alguien escribió y nadie le contestó.
 *
 * Pendiente = el último mensaje de la familia NO tiene una respuesta del
 * equipo posterior EN SU MISMA BANDEJA. La bandeja importa: la familia de
 * Oscar preguntó por Administración y lo último que le llegó fue un update de
 * Enfermería, que ella ve en la otra pestaña. Contarlo como "ya contestado"
 * es lo que dejó su pregunta del 09-jul sin respuesta 69 días.
 *
 * Y SYSTEM tampoco contesta: los avisos generales del hogar salen así, van a
 * todas las familias a la vez y no responden a nadie en particular.
 *
 * `esperandoDesde` es el PRIMER mensaje sin responder, no el último: lo que se
 * quiere saber es cuánto lleva esperando esa familia, no cuándo insistió por
 * última vez.
 */
function estadoDeEspera(mensajesDesc: { senderType: string; recipientType: string | null; createdAt: Date }[]) {
    const ultimoDeFamilia = mensajesDesc.find(m => m.senderType === 'FAMILY');
    if (!ultimoDeFamilia) {
        return { pendiente: false, esperandoDesde: null as Date | null, sinResponder: 0, bandejaPendiente: null as string | null };
    }

    const bandeja = bandejaDe(ultimoDeFamilia);
    const ultimaRespuesta = mensajesDesc.find(m => m.senderType === 'STAFF' && bandejaDe(m) === bandeja);

    if (ultimaRespuesta && ultimaRespuesta.createdAt > ultimoDeFamilia.createdAt) {
        return { pendiente: false, esperandoDesde: null as Date | null, sinResponder: 0, bandejaPendiente: null as string | null };
    }

    const sinResponder = mensajesDesc.filter(m =>
        m.senderType === 'FAMILY' &&
        bandejaDe(m) === bandeja &&
        (!ultimaRespuesta || m.createdAt > ultimaRespuesta.createdAt)
    );

    // Empate exacto al milisegundo entre la pregunta y la respuesta: el filtro
    // de arriba (`> ultimaRespuesta.createdAt`) descarta el propio mensaje de
    // la familia y la lista queda vacía, así que `[length - 1]` sería
    // `undefined` y leerle `.createdAt` tumbaría el GET ENTERO con un 500 —
    // las 20 conversaciones, no solo ese hilo. Hoy hay 0 empates en los 105
    // mensajes, pero el precio de equivocarse es la pantalla en blanco. Un
    // empate se cuenta como contestado, igual que en la ruta gemela.
    if (sinResponder.length === 0) {
        return { pendiente: false, esperandoDesde: null as Date | null, sinResponder: 0, bandejaPendiente: null as string | null };
    }

    return {
        pendiente: true,
        esperandoDesde: sinResponder[sinResponder.length - 1].createdAt,
        sinResponder: sinResponder.length,
        bandejaPendiente: bandeja,
    };
}

// GET — Lista de conversaciones agrupadas por paciente, filtradas por HQ
export async function GET(req: Request) {
    try {
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;
        const hqId = auth.headquartersId;

        // Obtener todos los pacientes de esta sede con sus mensajes familiares
        const patients = await prisma.patient.findMany({
            where: { headquartersId: hqId, status: 'ACTIVE' },
            select: {
                id: true,
                name: true,
                roomNumber: true,
                familyMessages: {
                    orderBy: { createdAt: 'desc' },
                    take: 50
                }
            }
        });

        // Resolver nombres de senders (staff y familiares) en una sola pasada
        const allMessages = patients.flatMap(p => p.familyMessages);
        const staffIds   = [...new Set(allMessages.filter(m => m.senderType === 'STAFF').map(m => m.senderId))];
        const familyIds  = [...new Set(allMessages.filter(m => m.senderType === 'FAMILY').map(m => m.senderId))];

        const [staffUsers, familyMembersData] = await Promise.all([
            staffIds.length  > 0 ? prisma.user.findMany({ where: { id: { in: staffIds  } }, select: { id: true, name: true } }) : [],
            familyIds.length > 0 ? prisma.familyMember.findMany({ where: { id: { in: familyIds } }, select: { id: true, name: true } }) : [],
        ]);

        const staffMap  = new Map((staffUsers        as { id: string; name: string }[]).map(u => [u.id, u.name]));
        const familyMap = new Map((familyMembersData as { id: string; name: string }[]).map(f => [f.id, f.name]));

        const attachNames = (msgs: any[]) => msgs.map(m => ({
            ...m,
            senderName: m.senderType === 'STAFF'
                ? (staffMap.get(m.senderId) || 'Personal')
                : (familyMap.get(m.senderId) || 'Familiar'),
        }));

        // Filtrar solo pacientes con mensajes y construir conversaciones
        const conversations = patients
            .filter(p => p.familyMessages.length > 0)
            .map(p => {
                const unreadCount = p.familyMessages.filter(m => !m.isRead && m.senderType === 'FAMILY').length;
                const rawMessages = [...p.familyMessages].reverse(); // asc
                const messages    = attachNames(rawMessages);
                const lastMessage = attachNames([p.familyMessages[0]])[0]; // ya ordenado desc
                const espera      = estadoDeEspera(p.familyMessages);
                return {
                    patientId: p.id,
                    patientName: p.name,
                    roomNumber: p.roomNumber,
                    unreadCount,
                    pendiente: espera.pendiente,
                    esperandoDesde: espera.esperandoDesde,
                    mensajesSinResponder: espera.sinResponder,
                    bandejaPendiente: espera.bandejaPendiente,
                    lastMessage,
                    messages,
                };
            })
            .sort((a, b) => {
                // Primero lo que le debemos a una familia, y dentro de eso el
                // que lleva más tiempo esperando. El resto, por actividad.
                if (a.pendiente !== b.pendiente) return a.pendiente ? -1 : 1;
                if (a.pendiente && b.pendiente) {
                    return new Date(a.esperandoDesde!).getTime() - new Date(b.esperandoDesde!).getTime();
                }
                return new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime();
            });

        return NextResponse.json({ success: true, conversations });
    } catch (error: any) {
        console.error("[corporate/family-messages GET] Error:", error);
        return NextResponse.json({ success: false, error: "Error al cargar mensajes." }, { status: 500 });
    }
}

// PATCH — Marcar como leído el hilo de un residente. ACTO EXPLÍCITO.
//
// Antes bastaba con hacer clic en la conversación en la lista: la pantalla
// mandaba este PATCH al SELECCIONAR, antes de que nadie bajara a leer nada.
// Eso no medía lectura, medía que algo se había abierto — y como se abría todo,
// `isRead` quedó en true en los 105 mensajes de la base y `unreadCount` en cero
// en las 23 conversaciones. Un campo que no puede ser falso no informa de nada.
//
// Por eso ahora hace falta declarar la intención: `accion: 'MARCAR_LEIDO'`.
// Quien no la manda no marca nada. La semántica sigue siendo de EQUIPO (si una
// enfermera marcó leído, el equipo lo vio), igual que al responder.
export async function PATCH(req: Request) {
    try {
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;
        const hqId = auth.headquartersId;

        const body = await req.json().catch(() => ({}));
        const patientId = (body.patientId || '').toString();
        if (!patientId) {
            return NextResponse.json({ success: false, error: 'patientId requerido' }, { status: 400 });
        }

        if (body.accion !== 'MARCAR_LEIDO') {
            return NextResponse.json(
                { success: false, error: 'Marcar leído es un acto explícito: falta accion: "MARCAR_LEIDO". Abrir o seleccionar un hilo ya no lo marca.' },
                { status: 400 }
            );
        }

        // Ownership: el hilo debe ser de un residente de la sede del invocador.
        const result = await prisma.familyMessage.updateMany({
            where: {
                patientId,
                patient: { headquartersId: hqId },
                senderType: 'FAMILY',
                isRead: false,
            },
            data: { isRead: true },
        });

        return NextResponse.json({ success: true, marked: result.count });
    } catch (error: any) {
        console.error("[corporate/family-messages PATCH] Error:", error);
        return NextResponse.json({ success: false, error: "Error al marcar leído." }, { status: 500 });
    }
}

// POST — Staff responde a un familiar (por patientId)
export async function POST(req: Request) {
    try {
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;
        const staffUserId = auth.id;
        const hqId = auth.headquartersId;
        const { patientId, content } = await req.json();

        if (!patientId || !content?.trim()) {
            return NextResponse.json({ success: false, error: "Datos incompletos." }, { status: 400 });
        }

        // Verificar que el paciente pertenece a esta sede
        const patient = await prisma.patient.findUnique({
            where: { id: patientId },
            select: { id: true, name: true, headquartersId: true }
        });

        if (!patient || patient.headquartersId !== hqId) {
            return NextResponse.json({ success: false, error: "Paciente no encontrado." }, { status: 404 });
        }

        const texto = content.trim();

        /**
         * DOBLE ENVÍO: el mismo texto, del mismo autor, en el mismo hilo, en
         * menos de dos minutos, es un segundo clic o un reintento — no una
         * segunda respuesta. Se devuelve ÉXITO con la que ya está escrita (un
         * error en rojo solo invita a pulsar otra vez, que es lo que produce el
         * duplicado) y no se manda un segundo correo a la familia.
         */
        const yaEscrita = await prisma.familyMessage.findFirst({
            where: {
                patientId,
                senderType: 'STAFF',
                senderId: staffUserId,
                content: texto,
                createdAt: { gte: new Date(Date.now() - 2 * 60 * 1000) },
            },
            orderBy: { createdAt: 'desc' },
        });

        if (yaEscrita) {
            return NextResponse.json({ success: true, message: yaEscrita, duplicado: true });
        }

        /**
         * LA RESPUESTA VUELVE POR LA PESTAÑA POR DONDE ENTRÓ LA PREGUNTA.
         *
         * `FamilyMessage.recipientType` tiene @default("ADMINISTRATION") y esta
         * ruta nunca lo escribía: las respuestas escritas a mano caían todas en
         * Administración aunque la familia hubiera escrito a Enfermería, así
         * que le aparecían en la otra pestaña y parecía que nadie contestó.
         * Se hereda de quien eligió el destinatario: la familia. Si el hilo no
         * tiene ningún mensaje suyo, decide el default del schema.
         */
        const ultimoDeFamilia = await prisma.familyMessage.findFirst({
            where: { patientId, senderType: 'FAMILY' },
            orderBy: { createdAt: 'desc' },
            select: { recipientType: true }
        });

        // Marcar todos los mensajes del familiar como leídos al responder
        await prisma.familyMessage.updateMany({
            where: { patientId, senderType: 'FAMILY', isRead: false },
            data: { isRead: true }
        });

        // Crear respuesta del staff.
        // Sin `isRead`: nace sin leer, que es la verdad. Con `isRead: true` no
        // había una sola fila STAFF sin leer en toda la base (0 de 45 el
        // 16-sep-2026) y el badge del portal familiar no podía encenderse.
        const reply = await prisma.familyMessage.create({
            data: {
                patientId,
                senderType: 'STAFF',
                senderId: staffUserId,
                content: texto,
                recipientType: ultimoDeFamilia?.recipientType ?? undefined
            }
        });

        /**
         * AVISO A LA FAMILIA — por correo, que es el único canal que existe.
         *
         * Aquí antes se buscaba al familiar con `user.findFirst({ email })`
         * para escribirle una Notification. Eso no podía funcionar nunca: la
         * familia no es un User —no hay FAMILY en el enum Role, entra como
         * FamilyMember— y `Notification.userId` tiene FK a User. Medido el
         * 16-sep-2026: 0 de los 33 correos de familiares coinciden con alguno
         * de los 39 User. De 403 notificaciones de familia, 286 son "la familia
         * escribió" y CERO "el equipo respondió". El fallo se lo tragaba un
         * catch marcado best-effort. La notificación in-app pide un modelo
         * nuevo y no se hace aquí.
         *
         * NO se filtra por estado del residente: se responde a un hilo concreto
         * por id, y a la familia de quien falleció también hay que contestarle.
         */
        try {
            const destinatarios = (await prisma.familyMember.findMany({
                where: { patientId, isRegistered: true },
                orderBy: { isPrimary: 'desc' },
                take: 3,
                select: { name: true, email: true }
            })).filter(fm => fm.email?.trim());

            if (destinatarios.length === 0) {
                // El silencio es justo lo que escondió el fallo durante meses:
                // la respuesta queda escrita y nadie al otro lado la ve.
                console.error(
                    `[corporate/family-messages POST] Respuesta ${reply.id} sin destinatario: el residente ${patientId} no tiene ningún FamilyMember registrado con correo. LA FAMILIA NO SE ENTERA.`
                );
            } else if (!process.env.SENDGRID_API_KEY) {
                console.error(
                    `[corporate/family-messages POST] Respuesta ${reply.id} sin enviar: falta SENDGRID_API_KEY. ${destinatarios.length} familiar(es) quedaron sin aviso.`
                );
            } else {
                const marca = await marcaSede(hqId);

                for (const fm of destinatarios) {
                    // Regla 7 (HIPAA): el cuerpo NO lleva el texto del mensaje,
                    // ni el nombre del residente, ni nada clínico. El correo
                    // avisa; el contenido vive en el portal, tras autenticación.
                    const aviso = avisoFamiliaSinPHI({
                        familyName: fm.name,
                        hqName: marca.nombre,
                        titulo: 'Nuevo mensaje del equipo',
                        detalle: 'El equipo del hogar le respondió en el portal familiar.',
                        ruta: '/family/messages',
                        marca: { primary: marca.primary, bg: marca.bg, logoUrl: marca.logoUrl },
                    });

                    await sgMail.send({
                        to: fm.email,
                        from: marca.remitente,
                        subject: aviso.subject,
                        html: aviso.html,
                        text: aviso.text,
                    });
                }
            }
        } catch (errAviso) {
            // La respuesta YA quedó guardada: un fallo de correo no la tumba.
            console.error(`[corporate/family-messages POST] Falló el aviso de la respuesta ${reply.id}:`, errAviso);
        }

        return NextResponse.json({ success: true, message: reply });
    } catch (error: any) {
        console.error("[corporate/family-messages POST] Error:", error);
        return NextResponse.json({ success: false, error: "Error al enviar respuesta." }, { status: 500 });
    }
}
