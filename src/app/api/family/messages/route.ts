import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from '@/lib/prisma';
import { notifyRoles } from '@/lib/notifications';

/**
 * Historial que ve la familia en su conversación.
 *
 * Estaba en 7 días "para evitar sobrecarga". Medido el 16-sep-2026: con esa
 * ventana una familia veía 8 de los 105 mensajes de su hilo — su propia
 * conversación le quedaba oculta, y las respuestas del hogar de hace dos
 * semanas simplemente no existían para ella. 90 días cubre el ciclo de
 * facturación, el trimestre de citas y cualquier hilo abierto, y son ~105
 * filas por sede: no hay sobrecarga que evitar.
 */
const DIAS_DE_HISTORIAL = 90;

/**
 * Tope de filas del hilo. La ventana de 90 días ya acota, pero un hilo no puede
 * crecer sin límite sólo porque una familia escriba mucho: el más largo de la
 * base tiene 38 mensajes en 90 días (16-sep-2026), así que 200 deja margen de
 * sobra y sigue siendo una respuesta que cabe en un móvil.
 *
 * Se leen los 200 MÁS RECIENTES (orden descendente) y se le da la vuelta antes
 * de responder: con `orderBy: 'asc'` un `take` recortaría por el otro extremo y
 * escondería justo lo último, que es lo que la familia abre a ver.
 */
const MAX_MENSAJES = 200;

/**
 * La pantalla de la familia ya no parte la conversación en "Administración" y
 * "Enfermería".
 *
 * Medido el 16-sep-2026: las dos pestañas partían en dos los 5 hilos que hay,
 * así que la familia tenía que adivinar en cuál estaba la respuesta. Del lado
 * de Enfermería los 21 mensajes del hogar salieron todos del flujo de Zendi
 * —el update que Zendi redacta y una persona aprueba en
 * `care/zendi/nursing-updates`, nunca de alguien escribiendo en esa pestaña— y
 * la familia le contestó 5 veces sin que esa pestaña fuera nunca un canal
 * propio.
 *
 * El campo se sigue escribiendo porque el hub del hogar lo lee: etiqueta el
 * mensaje ("Para Enfermería" / "Para Administración") y espeja el bucket del
 * último mensaje de la familia al responder. Lo que desaparece es que lo elija
 * la familia.
 */
const RECIPIENT_POR_DEFECTO = 'ADMINISTRATION';

/** Ventana de deduplicación del envío de la familia — ver PATRÓN en CLAUDE.md. */
const MINUTOS_ANTI_DUPLICADO = 2;

/**
 * Nombre visible cuando el mensaje lo escribió el sistema. Los dos remitentes
 * que existen: `SYSTEM` (concierge y citas — las 10 filas SYSTEM de la base al
 * 16-sep-2026) y `ZENDI_AI` (`specialists/appointments`). Sin esto la pantalla
 * los pintaba como "Personal", que es exactamente lo que no son.
 */
function nombreDeSistema(senderId: string): string {
    return senderId === 'ZENDI_AI' ? 'Zendi' : 'Aviso automático';
}

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || (session.user as any).role !== "FAMILY") {
            return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
        }

        // Recuperar el FamilyMember por email para obtener patientId real
        const familyMember = await prisma.familyMember.findUnique({
            where: { email: session.user?.email as string }
        });

        if (!familyMember || !familyMember.patientId) {
            return NextResponse.json({ success: false, error: "Cuenta de familiar no vinculada." }, { status: 404 });
        }

        const desde = new Date(Date.now() - DIAS_DE_HISTORIAL * 24 * 60 * 60 * 1000);

        const recientes = await prisma.familyMessage.findMany({
            where: {
                patientId: familyMember.patientId,
                createdAt: { gte: desde }
            },
            orderBy: { createdAt: 'desc' },
            take: MAX_MENSAJES
        });
        const messages = recientes.reverse();

        // Resolver nombres de staff para que el familiar vea quién respondió
        const staffIds = [...new Set(
            messages.filter(m => m.senderType === 'STAFF').map(m => m.senderId)
        )];
        const staffUsers = staffIds.length > 0
            ? await prisma.user.findMany({ where: { id: { in: staffIds } }, select: { id: true, name: true } })
            : [];
        const staffMap = new Map(staffUsers.map(u => [u.id, u.name]));

        const messagesWithNames = messages.map(m => ({
            ...m,
            senderName: m.senderType === 'FAMILY'
                ? familyMember.name
                : m.senderType === 'SYSTEM'
                    ? nombreDeSistema(m.senderId)
                    : (staffMap.get(m.senderId) || 'Personal'),
        }));

        // Este GET NO escribe. Antes marcaba leído todo lo que acababa de listar,
        // y como la pantalla hace poll cada 10 segundos, "leído" sólo significaba
        // que la pestaña estaba abierta: por eso "sin leer" era 0 en toda la base.
        // Marcar visto es ahora un acto explícito de la pantalla → PATCH.
        return NextResponse.json({ success: true, messages: messagesWithNames });
    } catch (e) {
        console.error("[FamilyMessages GET] Error:", e);
        return NextResponse.json({ success: false, error: "Error al cargar mensajes" }, { status: 500 });
    }
}

/**
 * PATCH — la familia confirma que vio estos mensajes.
 *
 * Existe para que el badge pueda apagarse sin que lo apague el listado: sólo
 * llega cuando la pantalla de mensajes está de verdad delante de la persona.
 * Acota siempre por el patientId de la sesión: un familiar no puede marcar
 * mensajes del residente de otro aunque mande sus ids.
 */
export async function PATCH(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || (session.user as any).role !== "FAMILY") {
            return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
        }

        const { messageIds } = await req.json();
        const ids: string[] = Array.isArray(messageIds)
            ? messageIds.filter((id: unknown): id is string => typeof id === 'string').slice(0, 200)
            : [];

        if (ids.length === 0) {
            return NextResponse.json({ success: true, marcados: 0 });
        }

        const familyMember = await prisma.familyMember.findUnique({
            where: { email: session.user?.email as string },
            select: { patientId: true },
        });

        if (!familyMember?.patientId) {
            return NextResponse.json({ success: false, error: "Cuenta de familiar no vinculada." }, { status: 404 });
        }

        const { count } = await prisma.familyMessage.updateMany({
            where: {
                id: { in: ids },
                patientId: familyMember.patientId,
                senderType: { in: ['STAFF', 'SYSTEM'] },
                isRead: false,
            },
            data: { isRead: true },
        });

        return NextResponse.json({ success: true, marcados: count });
    } catch (e) {
        console.error("[FamilyMessages PATCH] Error:", e);
        return NextResponse.json({ success: false, error: "Error al marcar como visto" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || (session.user as any).role !== "FAMILY") {
            return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
        }

        const { content } = await req.json();

        if (!content || !content.trim()) {
            return NextResponse.json({ success: false, error: "Mensaje vacío" }, { status: 400 });
        }

        const texto = content.trim();

        // Recuperar el FamilyMember por email para obtener patientId real
        const familyMember = await prisma.familyMember.findUnique({
            where: { email: session.user?.email as string }
        });

        if (!familyMember || !familyMember.patientId) {
            return NextResponse.json({ success: false, error: "Cuenta de familiar no vinculada." }, { status: 404 });
        }

        // Guarda contra doble envío: un toque repetido o un reintento porque el
        // móvil se vio lento dejaba dos veces el mismo mensaje en el hilo del
        // hogar. Se devuelve ÉXITO con el que ya existe — un error en rojo sólo
        // haría que la familia lo mandara otra vez.
        const yaEnviado = await prisma.familyMessage.findFirst({
            where: {
                patientId: familyMember.patientId,
                senderType: 'FAMILY',
                senderId: familyMember.id,
                content: texto,
                createdAt: { gte: new Date(Date.now() - MINUTOS_ANTI_DUPLICADO * 60 * 1000) },
            },
            orderBy: { createdAt: 'desc' },
        });

        if (yaEnviado) {
            return NextResponse.json({ success: true, message: yaEnviado, duplicado: true });
        }

        const newMessage = await prisma.familyMessage.create({
            data: {
                patientId: familyMember.patientId,
                senderType: 'FAMILY',
                senderId: familyMember.id,
                content: texto,
                recipientType: RECIPIENT_POR_DEFECTO
            }
        });

        // Notificar al equipo (no bloquea la respuesta)
        try {
            const patient = await prisma.patient.findUnique({
                where: { id: familyMember.patientId },
                select: { name: true, headquartersId: true }
            });

            if (patient) {
                const hqId = patient.headquartersId;
                const patientName = patient.name;
                const senderName = familyMember.name;

                // Antes los roles dependían del bucket que elegía la familia.
                // Ya no hay bucket que elegir, así que se avisa a la unión de los
                // dos: nadie que antes recibiera el aviso deja de recibirlo.
                // Sprint Coordinador (jun-2026): COORDINATOR es el primer
                // respondedor del hub de comunicación familiar.
                const roles = ['NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN', 'COORDINATOR'];

                await notifyRoles(hqId, roles as any[], {
                    type: 'FAMILY_VISIT',
                    title: `💬 Mensaje familiar — ${patientName}`,
                    message: `${senderName}: ${texto.slice(0, 80)}${texto.length > 80 ? '…' : ''}`,
                    link: '/corporate/family-messages'
                });
            }
        } catch (notifErr) {
            // No-fatal — notificación es best-effort
            console.error("[FamilyMessages POST] Notification error:", notifErr);
        }

        return NextResponse.json({ success: true, message: newMessage });
    } catch (e) {
        console.error("[FamilyMessages POST] Error:", e);
        return NextResponse.json({ success: false, error: "Error al enviar mensaje" }, { status: 500 });
    }
}
