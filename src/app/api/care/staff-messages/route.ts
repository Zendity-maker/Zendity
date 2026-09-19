import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { notifyRoles, notifyUser } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

// Quién es "el personal del hogar" para este tablón: lee, escribe directos y
// recibe la campana de un anuncio. 5 de los 9 anuncios de la sede nombran a un
// residente con su situación ("ARTEMIA TIENE UN PUNTO DE PRESIÓN", la vuelta de
// Carmen Vélez), así que la lista es la del personal con acceso clínico, no la
// de todo el que puede entrar a Zéndity.
// SOCIAL_WORKER se añadió el 16-sep-2026: Zoelly Resto y Meritza Figueroa son
// personal de la sede, firman evaluaciones sobre esos mismos residentes y
// llevan leyendo el tablón desde el principio. Cerrarlo por rol sin nombrarlas
// les quitaba una pantalla que usan, sin avisarles.
const ALLOWED_ROLES = ['DIRECTOR', 'ADMIN', 'SUPERVISOR', 'NURSE', 'CAREGIVER', 'KITCHEN', 'MAINTENANCE', 'SOCIAL_WORKER'];
const BROADCAST_ROLES = ['DIRECTOR', 'ADMIN', 'SUPERVISOR'];

/**
 * GET — Inbox del usuario autenticado.
 * Devuelve: directos al user + broadcasts de su sede.
 *
 * Exige ALLOWED_ROLES, la misma lista que gobierna quién puede escribir y a
 * quién notifica el POST. Antes solo bloqueaba FAMILY, y con eso los 9 anuncios
 * completos los leía cualquiera con sesión. Medido el 16-sep-2026 sobre los 24
 * usuarios activos, quedan fuera tres cuentas que hasta hoy leían el tablón sin
 * recibir jamás una notificación de anuncio (0 de las 158 de la campana):
 * INVESTOR (CG, que no es personal del hogar), SUPER_ADMIN (admin@zendity.com,
 * la cuenta del proveedor) y HR_MANAGER (LizMelanie Trinidad — el rol existe
 * para gestionar personal SIN acceso clínico, y estos anuncios lo tienen).
 * Ojo: ese HR_MANAGER está ACTIVO en producción hoy, así que el corte se nota.
 * requireRole mira primary Y secondary, así que un doble rol (ej. FAMILY con
 * secondary CAREGIVER) sigue entrando por su rol de staff.
 */
export async function GET() {
    try {
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;

        const userId = auth.id;
        const hqId = auth.headquartersId;

        const messages = await prisma.staffMessage.findMany({
            where: {
                headquartersId: hqId,
                OR: [
                    { recipientId: userId },
                    { senderId: userId, type: 'DIRECT' },
                    { type: 'BROADCAST' },
                ],
            },
            include: {
                sender: { select: { id: true, name: true, role: true, image: true, photoUrl: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });

        // Solo directos. En un DIRECT el `isRead` de la fila tiene un dueño
        // único —el destinatario— y significa lo que dice. El de un BROADCAST
        // es un booleano compartido por los 17 destinatarios de la sede: no
        // puede contar el "sin leer" de nadie, ni para arriba ni para abajo.
        // Se quitó del conteo el 16-sep-2026 junto con la rama BROADCAST del
        // PATCH (ver su comentario): sin nadie que lo apague, ese sumando se
        // habría quedado clavado en 9 para todos y para siempre.
        // Quién vio qué anuncio se sigue señalando por persona en la campana,
        // con la fila de Notification que el POST crea para cada destinatario.
        const unreadCount = await prisma.staffMessage.count({
            where: { headquartersId: hqId, type: 'DIRECT', recipientId: userId, isRead: false },
        });

        return NextResponse.json({
            success: true,
            messages,
            unreadCount,
        });
    } catch (err: any) {
        console.error('[StaffMessages GET]', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

/**
 * POST — Enviar mensaje (DIRECT o BROADCAST)
 */
export async function POST(req: Request) {
    try {
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;

        const userId = auth.id;
        const senderName = auth.name || 'Staff';
        const hqId = auth.headquartersId;

        const { content, recipientId } = await req.json();
        if (!content || typeof content !== 'string' || !content.trim()) {
            return NextResponse.json({ success: false, error: 'Contenido requerido' }, { status: 400 });
        }

        const type = recipientId ? 'DIRECT' : 'BROADCAST';

        // Solo DIRECTOR/ADMIN/SUPERVISOR pueden hacer broadcast — chequeo doble rol
        const canBroadcast = BROADCAST_ROLES.includes(auth.role)
            || auth.secondaryRoles.some(r => BROADCAST_ROLES.includes(r));
        if (type === 'BROADCAST' && !canBroadcast) {
            return NextResponse.json({ success: false, error: 'Solo supervisores pueden enviar anuncios' }, { status: 403 });
        }

        // Validar que el recipient pertenece a la misma sede
        // (Los FAMILY usan modelo FamilyMember aparte — no aparecen en User)
        if (type === 'DIRECT') {
            const recipient = await prisma.user.findUnique({
                where: { id: recipientId },
                select: { headquartersId: true },
            });
            if (!recipient || recipient.headquartersId !== hqId) {
                return NextResponse.json({ success: false, error: 'Destinatario inválido' }, { status: 400 });
            }
        }

        // Guarda contra doble envío. Medido el 16-sep-2026 sobre las 24 filas de
        // la historia entera: TRES pares idénticos separados por 0.088s, 0.38s y
        // 1.37s — seis filas, un cuarto de la tabla, son un doble toque. Dos son
        // directos ("Buenas noches Carlos" ×2) y uno es un anuncio a toda la
        // sede, que además notificó dos veces a las 17 personas.
        // La ventana es de un minuto porque el único repetido legítimo de la
        // historia —el aviso de que venía Elsa— se escribió 26 horas después del
        // primero: entre 1.4s y 26h no hay duda posible.
        // Se devuelve ÉXITO con la fila que ya existe, no un error: quien pulsó
        // hizo lo correcto, y un error en rojo le hace pulsar otra vez.
        const hace1Min = new Date(Date.now() - 60 * 1000);
        const yaEnviado = await prisma.staffMessage.findFirst({
            where: {
                headquartersId: hqId,
                senderId: userId,
                type,
                recipientId: type === 'DIRECT' ? recipientId : null,
                content: content.trim(),
                createdAt: { gte: hace1Min },
            },
            include: {
                sender: { select: { id: true, name: true, role: true, image: true, photoUrl: true } },
            },
        });
        if (yaEnviado) {
            return NextResponse.json({ success: true, message: yaEnviado, duplicado: true });
        }

        const message = await prisma.staffMessage.create({
            data: {
                headquartersId: hqId,
                senderId: userId,
                content: content.trim(),
                type,
                recipientId: type === 'DIRECT' ? recipientId : null,
            },
            include: {
                sender: { select: { id: true, name: true, role: true, image: true, photoUrl: true } },
            },
        });

        // Notificación
        try {
            const preview = content.trim().substring(0, 80);
            if (type === 'DIRECT') {
                await notifyUser(recipientId, {
                    type: 'STAFF_MESSAGE',
                    title: `Mensaje de ${senderName}`,
                    message: preview,
                    link: '/care',
                });
            } else {
                // excludeUserId: el emisor no se notifica de su propio anuncio
                await notifyRoles(hqId, ALLOWED_ROLES, {
                    type: 'STAFF_MESSAGE',
                    title: `Anuncio de ${senderName}`,
                    message: preview,
                    link: '/care',
                }, userId);
            }
        } catch (e) { console.error('[notify STAFF_MESSAGE]', e); }

        return NextResponse.json({ success: true, message });
    } catch (err: any) {
        console.error('[StaffMessages POST]', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

/**
 * PATCH — Marcar como leídos mensajes DIRECT de los que uno es destinatario.
 * body: { messageIds: string[] }
 *
 * Los BROADCAST quedaron fuera a propósito (16-sep-2026). Un anuncio tiene UN
 * solo `isRead` en su fila y 17 destinatarios: los 9 anuncios de la sede son
 * 153 pares persona-anuncio representados por 9 booleanos. La primera persona
 * que abría la pestaña "Anuncios" los apagaba para las otras 16, que nunca
 * habían visto nada. El "leído" de un anuncio no se puede representar con un
 * booleano en la fila del mensaje: es un dato por persona, y no por mensaje.
 *
 * Dónde vive ese dato hoy: en Notification, una fila por destinatario con su
 * propio isRead, que es lo que se ve en la campana. Ese modelo
 * (prisma/schema.prisma:560-573) no guarda readAt ni referencia al mensaje,
 * así que sabe QUIÉN marcó leído pero no CUÁNDO ni DE QUÉ anuncio exacto.
 * Mientras siga así, esta ruta no puede responder "quién leyó el anuncio X" y
 * no debe fingir que sí.
 *
 * Exige ALLOWED_ROLES igual que el GET: quien no puede leer el tablón tampoco
 * tiene nada que marcar en él.
 */
export async function PATCH(req: Request) {
    try {
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;

        const userId = auth.id;
        const hqId = auth.headquartersId;

        const { messageIds } = await req.json();
        if (!Array.isArray(messageIds) || messageIds.length === 0) {
            return NextResponse.json({ success: false, error: 'messageIds requerido' }, { status: 400 });
        }

        // Solo el destinatario del directo. Los ids de anuncios que llegaran en
        // el body no casan con este WHERE y se ignoran en silencio: es lo
        // correcto, marcar un anuncio no es una operación que exista.
        const result = await prisma.staffMessage.updateMany({
            where: {
                id: { in: messageIds },
                headquartersId: hqId,
                type: 'DIRECT',
                recipientId: userId,
            },
            data: { isRead: true },
        });

        return NextResponse.json({ success: true, updated: result.count });
    } catch (err: any) {
        console.error('[StaffMessages PATCH]', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
