import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { avisoFamiliaSinPHI } from '@/lib/family-email';
import { marcaSede } from '@/lib/marca-sede';
import sgMail from '@sendgrid/mail';

if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

/**
 * MISMA LISTA, LITERAL, QUE EL HUB — ver el `ALLOWED_ROLES` de
 * src/app/api/corporate/family-messages/route.ts (sin número de línea: ese
 * fichero se mueve).
 *
 * Son la misma tabla y las mismas 23 conversaciones; tener dos puertas con
 * dos cerraduras distintas es cómo se cuela gente por la de atrás. Hasta el
 * 16-sep-2026 esta ruta solo comprobaba "no seas FAMILY": pasaban 22 de los 22
 * usuarios activos —las 12 cuidadoras, cocina, mantenimiento, las 2
 * trabajadoras sociales, el INVERSIONISTA y el SUPER_ADMIN— y todos leían las
 * 105 conversaciones íntegras y podían escribir en ellas firmando como STAFF.
 * Con esta lista pasan 4.
 *
 * requireRole (y no un check inline) porque ahí vive el corte por facturación
 * suspendida y porque mira también los secondaryRoles: la enfermería del hogar
 * la hace Celia como DIRECTOR con NURSE secundario.
 */
const ALLOWED_ROLES = ['DIRECTOR', 'ADMIN', 'SUPERVISOR', 'NURSE', 'COORDINATOR'];

/** Bandeja del portal familiar. `recipientType` es nullable en el schema. */
const bandejaDe = (m: { recipientType: string | null }) => m.recipientType ?? 'ADMINISTRATION';

/**
 * CUÁNTAS PREGUNTAS DE LA FAMILIA SIGUEN SIN CONTESTAR EN ESTE HILO.
 *
 * El badge de la "Sala de Enfermería" contaba mensajes con `isRead: false`, y
 * abrir el hilo en la pantalla de inicio dispara un PATCH al hub que marca el
 * hilo entero como leído. Resultado medido el 16-sep-2026: el badge vale 0 en
 * los 23 hilos —está apagado siempre— mientras 4 familias esperan respuesta,
 * la primera desde hace 54 días. Un contador que no puede moverse no es un
 * contador.
 *
 * Leer no es contestar. Pendiente = el último mensaje de la familia no tiene
 * una respuesta del equipo posterior EN SU MISMA BANDEJA (quien preguntó por
 * Administración no ve lo que se le conteste por Enfermería), y SYSTEM no
 * cuenta como respuesta: esos avisos salen a todas las familias a la vez y no
 * responden a nadie.
 *
 * Misma definición que `estadoDeEspera` del hub. Está repetida a propósito y
 * no debería seguir así: su sitio es src/lib, que no se toca en esta tanda.
 */
function sinResponder(mensajesAsc: { senderType: string; recipientType: string | null; createdAt: Date }[]): number {
    const desc = [...mensajesAsc].reverse();
    const ultimoDeFamilia = desc.find(m => m.senderType === 'FAMILY');
    if (!ultimoDeFamilia) return 0;

    const bandeja = bandejaDe(ultimoDeFamilia);
    const ultimaRespuesta = desc.find(m => m.senderType === 'STAFF' && bandejaDe(m) === bandeja);
    if (ultimaRespuesta && ultimaRespuesta.createdAt > ultimoDeFamilia.createdAt) return 0;

    return mensajesAsc.filter(m =>
        m.senderType === 'FAMILY' &&
        bandejaDe(m) === bandeja &&
        (!ultimaRespuesta || m.createdAt > ultimaRespuesta.createdAt)
    ).length;
}

// REVISAR BANDEJA CENTRALIZADA (B2B Staff)
export async function GET(req: Request) {
    try {
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;

        const headquarterId = auth.headquartersId;

        /**
         * SIN FILTRO POR ESTADO, A PROPÓSITO — el comentario anterior decía
         * "residentes activos" y la consulta nunca lo filtró.
         *
         * El hub (corporate/family-messages) sí exige `status: 'ACTIVE'` en su
         * `patient.findMany`; aquí no. De los 23 hilos vivos al 16-sep-2026, 2 son de residentes
         * fallecidos y 1 de uno en salida temporal: a esas familias se les
         * sigue contestando —el papeleo y las condolencias van por el mismo
         * hilo— y una pregunta que desaparece de la bandeja es una pregunta que
         * nadie vuelve a ver. Es la misma razón por la que el POST tampoco
         * filtra.
         */
        const dbMessages = await prisma.familyMessage.findMany({
            where: {
                patient: { headquartersId: headquarterId }
            },
            /**
             * SOLO LOS CUATRO CAMPOS QUE LA PANTALLA PINTA.
             *
             * Antes era `patient: true`, el expediente ENTERO, y además viajaba
             * repetido dentro de cada mensaje (ver el `unshift` de abajo).
             * Medido el 13-sep-2026: 97 mensajes de 17 residentes que se
             * llevaban por delante `ssnLastFour` en 12, la póliza del seguro en
             * 16, y la cuota mensual y la fecha de nacimiento en los 17.
             */
            include: {
                /**
                 * `status` VA EN EL SELECT PORQUE LA PANTALLA TIENE QUE DECIRLO.
                 *
                 * Los hilos de residentes fallecidos o en salida temporal se
                 * quedan en la bandeja a propósito —ver el comentario de
                 * arriba— pero hasta ahora salían exactamente igual que los
                 * demás. Medido el 22-sep-2026: el hilo de Fernando González
                 * Delgado pedía respuesta sin que nada dijera que había
                 * fallecido. Quien abre esa conversación tiene derecho a
                 * saberlo ANTES de escribir.
                 */
                patient: { select: { id: true, name: true, roomNumber: true, colorGroup: true, status: true } },
            },
            orderBy: { createdAt: 'desc' },
            /**
             * TOPE. Esta consulta traía la tabla entera de la sede y la
             * pantalla de inicio la pide cada 30 s: 105 mensajes hoy, pero
             * nada la frenaba mañana.
             *
             * Al llegar al tope se pierde la cola más vieja —y un hilo cuyos
             * mensajes sean TODOS viejos deja de aparecer en la bandeja—, así
             * que 500 no es un número cómodo sino el margen de años que hay a
             * este ritmo. Si se acerca, el arreglo no es subirlo: es paginar
             * por hilo, como hace el hub con su `take: 50` por residente.
             */
            take: 500
        });

        // Filtrar residentes que actualmente tienen mensajes
        type ThreadMap = {
            [key: string]: {
                patient: { id: string; name: string; room: string | null; zone: string };
                messages: any[];
                unreadCount: number;
            };
        };

        const patientConversationsMap = dbMessages.reduce((acc: ThreadMap, msg) => {
            if (!acc[msg.patientId]) {
                acc[msg.patientId] = {
                    patient: {
                        id: msg.patient.id,
                        name: msg.patient.name,
                        room: msg.patient.roomNumber,
                        zone: msg.patient.colorGroup
                    },
                    messages: [],
                    unreadCount: 0
                };
            }
            // El residente ya va en la cabecera del hilo; dentro de cada mensaje
            // sobra. Iba repetido tantas veces como mensajes tuviera el hilo.
            const { patient: _residente, ...mensaje } = msg;
            acc[msg.patientId].messages.unshift(mensaje);
            return acc;
        }, {} as ThreadMap);

        // `unreadCount` conserva el nombre porque es el que pinta el badge de la
        // pantalla de inicio, pero ya no cuenta "sin abrir": cuenta sin contestar.
        const activeThreads = Object.values(patientConversationsMap)
            .map(hilo => ({ ...hilo, unreadCount: sinResponder(hilo.messages) }))
            .sort((a, b) => b.unreadCount - a.unreadCount);

        return NextResponse.json({ success: true, threads: activeThreads });
    } catch (error) {
        console.error("Care Messages GET Error:", error);
        return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
    }
}

// RESPONDER UN MENSAJE (B2B Staff)
export async function POST(req: Request) {
    try {
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;

        const hqId = auth.headquartersId;
        const { patientId, content } = await req.json();

        if (!content?.trim() || !patientId) {
            return NextResponse.json({ success: false, error: "Faltan datos: residente y contenido." }, { status: 400 });
        }

        /**
         * OWNERSHIP POR ID: el `patientId` viene del body, así que hay que
         * comprobar la sede ANTES de escribir. Sin esto, quien tuviera rol en
         * Mayagüez podía escribir en el hilo de un residente de Cupey. Medido
         * el 16-sep-2026: 0 cruces ocurridos — pero la puerta estaba abierta.
         *
         * No se distingue "no existe" de "es de otra sede": responder distinto
         * confirmaría a quien prueba uuids cuáles pertenecen a un residente
         * real de la otra sede.
         */
        const residente = await prisma.patient.findUnique({
            where: { id: patientId },
            select: { id: true, headquartersId: true }
        });

        if (!residente || residente.headquartersId !== hqId) {
            return NextResponse.json(
                { success: false, error: "Ese residente no pertenece a tu sede." },
                { status: 403 }
            );
        }

        /**
         * GUARDA CONTRA DOBLE ENVÍO — el mismo patrón que /api/care/vitals y
         * /api/care/incidents.
         *
         * Medido el 16-sep-2026: 0 pares idénticos en las 45 respuestas del
         * staff que hay escritas, así que esto no corrige nada del pasado. Se
         * pone porque el precio de un doble toque acaba de subir: desde hoy
         * cada respuesta MANDA CORREO a la familia. Dos filas iguales en el
         * hilo son ruido; dos correos seguidos por lo mismo, de noche, no.
         *
         * Ventana de 2 minutos —la de unos vitales, no la de un alta—: quien
         * contesta un chat escribe corto y seguido, y repetir el mismo texto
         * exacto al mismo residente antes de dos minutos es un reintento, no
         * una insistencia.
         *
         * Devuelve ÉXITO con la fila que ya existe: un error en rojo hace que
         * quien pulsó vuelva a pulsar, que es justo lo que produce el
         * duplicado.
         */
        const dosMinutosAtras = new Date(Date.now() - 2 * 60 * 1000);
        const yaEnviada = await prisma.familyMessage.findFirst({
            where: {
                patientId,
                senderType: 'STAFF',
                senderId: auth.id,
                content: content.trim(),
                createdAt: { gte: dosMinutosAtras }
            },
            orderBy: { createdAt: 'desc' }
        });

        if (yaEnviada) {
            return NextResponse.json({ success: true, duplicada: true, message: yaEnviada });
        }

        /**
         * LA RESPUESTA VUELVE POR LA PESTAÑA POR DONDE ENTRÓ LA PREGUNTA.
         *
         * `FamilyMessage.recipientType` tiene @default("ADMINISTRATION"), y
         * esta ruta nunca lo escribía: las 18 respuestas escritas a mano hasta
         * el 16-sep-2026 cayeron TODAS en Administración. La familia escribía a
         * Enfermería y la contestación le aparecía en la otra pestaña, así que
         * parecía que nadie le había contestado.
         *
         * Se hereda del último mensaje de la FAMILIA, que es quien eligió el
         * destinatario. Si el hilo no tiene ninguno (arrancó el hogar), se deja
         * que el default del schema decida.
         */
        const ultimoDeFamilia = await prisma.familyMessage.findFirst({
            where: { patientId, senderType: 'FAMILY' },
            orderBy: { createdAt: 'desc' },
            select: { recipientType: true }
        });

        // Marcar mensajes del hilo familiar como leídos, si los hay
        await prisma.familyMessage.updateMany({
            where: { patientId, senderType: 'FAMILY', isRead: false },
            data: { isRead: true }
        });

        // Escribir la respuesta oficial del equipo clínico
        const newMessage = await prisma.familyMessage.create({
            data: {
                patientId,
                senderType: 'STAFF',
                senderId: auth.id,
                content: content.trim(),
                recipientType: ultimoDeFamilia?.recipientType ?? undefined
            }
        });

        /**
         * AVISO A LA FAMILIA — lo que faltaba entero.
         *
         * Esta es la ruta que usa la pantalla de inicio para responder y no
         * tenía una sola línea de notificación: 18 respuestas en meses sin que
         * la familia se enterara por ningún canal. El portal solo lo enseña a
         * quien entra a mirar, y nadie entra a mirar si nadie le avisa.
         *
         * Solo correo. La notificación in-app es imposible hoy:
         * `Notification.userId` tiene FK a User y la familia es FamilyMember —
         * 0 de los 33 correos de familiares coinciden con un User. Eso pide un
         * modelo nuevo y no se hace aquí.
         *
         * NO se filtra por estado del residente: se responde a un hilo concreto
         * por id, y a la familia de quien falleció también hay que poder
         * contestarle.
         */
        try {
            const destinatarios = (await prisma.familyMember.findMany({
                where: { patientId, isRegistered: true },
                orderBy: { isPrimary: 'desc' },
                take: 3,
                select: { name: true, email: true }
            })).filter(fm => fm.email?.trim());

            if (destinatarios.length === 0) {
                // Esto NO es un "best-effort" silencioso. El silencio es justo lo
                // que escondió el fallo durante meses: la respuesta quedó escrita
                // y nadie al otro lado la va a ver.
                console.error(
                    `[care/messages POST] Respuesta ${newMessage.id} sin destinatario: el residente ${patientId} no tiene ningún FamilyMember registrado con correo. LA FAMILIA NO SE ENTERA.`
                );
            } else if (!process.env.SENDGRID_API_KEY) {
                console.error(
                    `[care/messages POST] Respuesta ${newMessage.id} sin enviar: falta SENDGRID_API_KEY. ${destinatarios.length} familiar(es) quedaron sin aviso.`
                );
            } else {
                const marca = await marcaSede(hqId);

                for (const fm of destinatarios) {
                    // Regla 7 (HIPAA): el cuerpo NO lleva el texto del mensaje, ni
                    // el nombre del residente, ni nada clínico. El correo avisa;
                    // el contenido vive en el portal, detrás de autenticación.
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
            console.error(`[care/messages POST] Falló el aviso de la respuesta ${newMessage.id}:`, errAviso);
        }

        return NextResponse.json({ success: true, message: newMessage });
    } catch (error) {
        console.error("Care Messages POST Error:", error);
        return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
    }
}
