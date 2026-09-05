/**
 * REGISTRO DE UNA VISITA EN EL KIOSCO DE RECEPCIÓN
 * ───────────────────────────────────────────────
 * Escribe la entrada del visitante en la bitácora del hogar.
 *
 * Tenía cuatro problemas, todos en el mismo sitio:
 *
 * 1. NINGUNA AUTENTICACIÓN. Público en internet, como el buscador.
 *
 * 2. LA SEDE SALÍA DEL CUERPO DE LA PETICIÓN. Llegaba un `patientId`, se
 *    buscaba el residente y de ahí se tomaba su `headquartersId`. Es
 *    exactamente lo que CLAUDE.md prohíbe: cualquiera podía escribir visitas
 *    en cualquier sede. Ahora la sede sale del dispositivo y el residente
 *    tiene que pertenecer a ella.
 *
 * 3. LA HORA LA PONÍA EL VISITANTE. `new Date(timestamp || Date.now())` con el
 *    `timestamp` llegando desde la tablet. En un registro que se firma, quien
 *    firma no puede fijar la hora. Ahora es del servidor y punto.
 *
 * 4. FALLABA EN SILENCIO. El `catch` final devolvía `success: true` —"nunca
 *    bloquear el kiosco"— y el `create` iba dentro de su propio try que solo
 *    logueaba. Si algo reventaba, la tablet decía "registrado" y en la base no
 *    quedaba nada. No bloquear el kiosco es razonable para las notificaciones;
 *    para el asiento de la bitácora es mentir. Ahora el asiento manda: si no
 *    se escribe, el kiosco se entera. Lo accesorio —nota en el expediente y
 *    aviso a supervisión— sigue siendo best-effort.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireKioskDevice, touchKioskDevice } from '@/lib/external-kiosk-auth';
import { cuidadorasDeResidente } from '@/lib/cuidadora-a-cargo';
import { evaluarAcceso, resumenParaPersonal } from '@/lib/visitantes-autorizados';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    const device = await requireKioskDevice(req);
    if (device instanceof NextResponse) return device;

    const hqId = device.headquartersId;

    try {
        const body = await req.json();
        const visitorName = String(body.visitorName ?? '').trim();
        const residentName = String(body.residentName ?? '').trim();
        const visitorRelation = String(body.visitorRelation ?? '').trim() || null;
        const signatureData: string | null = body.signatureData ?? null;
        const incomingPatientId: string | null = body.patientId ?? null;

        if (!visitorName || !residentName) {
            return NextResponse.json({ success: false, error: 'Falta el nombre del visitante o del residente' }, { status: 400 });
        }

        // El residente se busca SIEMPRE dentro de la sede del dispositivo. Aun
        // con un id explícito: un id de otra sede no encuentra fila, no da 403
        // —no se confirma que exista.
        const patient = incomingPatientId
            ? await prisma.patient.findFirst({
                where: { id: incomingPatientId, headquartersId: hqId, status: 'ACTIVE' },
                select: { id: true, name: true },
            })
            : await prisma.patient.findFirst({
                where: { name: { contains: residentName, mode: 'insensitive' }, headquartersId: hqId, status: 'ACTIVE' },
                select: { id: true, name: true },
            });

        if (!patient) {
            return NextResponse.json({ success: false, error: 'Residente no encontrado en esta sede' }, { status: 404 });
        }

        // Hora del servidor. La tablet ya no la propone.
        const visitedAt = new Date();

        /**
         * Acceso restringido: lista negra siempre, lista blanca solo en modo
         * estricto. Se evalúa ANTES de dar por buena la visita.
         *
         * El intento se registra igual —con `retenida`— porque para un
         * residente con restricción, "esta persona se presentó el martes" es
         * justo lo que hay que poder mirar después. Si no se guardara, la única
         * huella sería un aviso que alguien leyó y se fue.
         */
        const acceso = await evaluarAcceso(hqId, patient.id, visitorName);

        // Esto SÍ bloquea: es el asiento de la bitácora. Si falla, que se sepa.
        const visit = await prisma.familyVisit.create({
            data: {
                visitorName,
                residentName: patient.name,
                visitorRelation,
                patientId: patient.id,
                headquartersId: hqId,
                signatureData: signatureData ? signatureData.substring(0, 50000) : null,
                visitedAt,
                retenida: acceso.retener,
                notified: false,
            },
            select: { id: true, visitedAt: true },
        });

        touchKioskDevice(device.id);

        // A partir de aquí, accesorio: si falla, la visita ya quedó registrada
        // y eso es lo que importa.
        const dateStr = visitedAt.toLocaleDateString('es-PR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const timeStr = visitedAt.toLocaleTimeString('es-PR', { hour: '2-digit', minute: '2-digit' });

        // Lo de aquí abajo describe una visita que OCURRIÓ. Si la persona
        // quedó esperando en recepción, todavía no ocurrió: escribir "visitó a
        // X" en el expediente sería falso, y mandar "X tiene visita" a la vez
        // que "hay alguien esperando asistencia" son dos avisos que se
        // contradicen en la misma pantalla.
        if (!acceso.retener) {
        prisma.familyVisitNote.create({
            data: {
                patientId: patient.id,
                headquartersId: hqId,
                visitorName,
                visitedAt,
                notes: `Visita registrada en recepción: ${visitorName} visitó a ${patient.name} el ${dateStr} a las ${timeStr}.`,
            },
        }).catch(e => console.error('FamilyVisitNote:', e));

        /**
         * A quién le llega el aviso.
         *
         * Supervisión ya lo recibía. Faltaba LA CUIDADORA DEL RESIDENTE, que
         * es quien puede hacer algo con la noticia: avisarle, arreglarle el
         * cuarto, acompañarlo a la sala.
         *
         * La tablet de cuido YA sondea `/api/notifications/unread?type=FAMILY_VISIT`
         * cada 30 s y saca un toast — la entrega estaba construida entera; lo
         * único que faltaba era crearle la fila. El aviso puede tardar hasta
         * medio minuto en salir, que es el tiempo que el visitante tarda en
         * firmar y caminar.
         *
         * Si no se resuelve una cuidadora, el aviso NO desaparece: supervisión
         * lo recibe igual. Baja de precisión, no de existencia.
         */
        Promise.all([
            prisma.user.findMany({
                where: { headquartersId: hqId, role: { in: ['SUPERVISOR', 'DIRECTOR', 'ADMIN'] }, isActive: true, isDeleted: false },
                select: { id: true },
            }).then(us => us.map(u => u.id)),
            cuidadorasDeResidente(hqId, patient.id)
                .then(cs => cs.map(c => c.userId))
                .catch(e => { console.error('Cuidadora a cargo:', e); return [] as string[]; }),
        ]).then(([supervision, cuidadoras]) => {
            // Un mismo usuario puede caer en las dos listas (una supervisora que
            // cubre color). Un solo aviso.
            const destinatarios = [...new Set([...supervision, ...cuidadoras])];
            return Promise.all(destinatarios.map(userId =>
                prisma.notification.create({
                    data: {
                        userId,
                        type: 'FAMILY_VISIT',
                        // Nada clínico: quién viene y a quién. La cuidadora ya
                        // sabe quiénes son sus residentes.
                        title: `${patient.name} tiene visita`,
                        message: `${visitorName} se registró en recepción para visitar a ${patient.name} el ${dateStr} a las ${timeStr}.`,
                        isRead: false,
                    },
                }).catch(() => null),
            ));
        }).catch(e => console.error('Notificación de visita:', e));
        }

        if (acceso.retener) {
            /**
             * EL AVISO NO LLEVA VEREDICTO.
             *
             * "No autorizado a visitar a Fulano" es un juicio que la tablet
             * puede equivocar —un nombre escrito distinto, un yerno nuevo que
             * nadie añadió a la lista— y quien camine hasta recepción llegaría
             * con un prejuicio sobre alguien que puede estar perfectamente
             * bien. El título dice que hay una visita esperando; el detalle,
             * sin sentencia, va en el cuerpo, y el motivo completo vive en el
             * perfil del residente.
             *
             * TIPO `FAMILY_VISIT` a propósito, no uno nuevo: la tablet de cuido
             * sondea ÚNICAMENTE ese tipo. Un tipo propio sería invisible ahí
             * —construido y sin llegar a nadie— hasta añadirlo al sondeo.
             */
            const supervision = await prisma.user.findMany({
                where: { headquartersId: hqId, role: { in: ['SUPERVISOR', 'DIRECTOR', 'ADMIN'] }, isActive: true, isDeleted: false },
                select: { id: true },
            });
            const cuidadoras = await cuidadorasDeResidente(hqId, patient.id).catch(() => []);
            const destinatarios = [...new Set([...supervision.map(u => u.id), ...cuidadoras.map(c => c.userId)])];

            await Promise.all(destinatarios.map(userId =>
                prisma.notification.create({
                    data: {
                        userId,
                        type: 'FAMILY_VISIT',
                        title: `Visita esperando asistencia — ${patient.name}`,
                        message: `${resumenParaPersonal(acceso, visitorName)} Está esperando en recepción. El detalle está en el perfil del residente, en Acceso de visitas.`,
                        isRead: false,
                    },
                }).catch(() => null),
            ));

            // La tablet solo sabe que hay que esperar. Nada de por qué.
            return NextResponse.json({
                success: true,
                retenida: true,
                visit,
                patient: patient.name,
                mensaje: 'Por favor espere un momento. Ya avisamos al personal de recepción.',
            });
        }

        return NextResponse.json({
            success: true,
            retenida: false,
            visit,
            patient: patient.name,
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
