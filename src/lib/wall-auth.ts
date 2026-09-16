import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * QUIÉN PUEDE ABRIR LA PARED.
 *
 * Dos caminos, y el segundo es el que importa:
 *
 *   1. Una sesión de personal — para mirarla desde un navegador cualquiera.
 *   2. Un TOKEN DE DISPOSITIVO — para el televisor que se queda encendido.
 *
 * POR QUÉ HACÍA FALTA EL SEGUNDO. La pared se autenticaba con la sesión de
 * quien la abriera, y la sesión es un JWT de OCHO HORAS (src/lib/auth.ts:199)
 * sin renovación: `SessionProvider` se monta sin `refetchInterval`, y un kiosco
 * nunca cambia de foco, así que nada refresca el token.
 *
 * Lo que eso producía, medido: a las ocho horas la API devuelve 401, la pantalla
 * entera se sustituye por "Error de Conexión" y reintenta cada minuto para
 * siempre. Si alguien recarga, `/wall` no está entre las rutas públicas, así que
 * sale el FORMULARIO DE LOGIN a pantalla completa mirando al pasillo.
 *
 * Y además la pared se quedaba abierta con la cuenta de una persona: de los 22
 * usuarios activos solo cuatro podían sostenerla, y cualquiera que pasara por
 * delante de esa pantalla tenía la sesión de un DIRECTOR en la mano.
 *
 * El token de dispositivo resuelve las tres cosas: no caduca, no es la cuenta de
 * nadie, y da un identificador con el que auditar quién leyó qué.
 */
export interface QuienMira {
    headquartersId: string;
    /** Cómo entró: para el registro de acceso a expedientes. */
    via: 'SESION' | 'DISPOSITIVO';
    /** Nombre de la persona o etiqueta del aparato. */
    quien: string;
    /** Id de usuario cuando es sesión; null cuando es un aparato. */
    userId: string | null;
}

const ROLES_QUE_MIRAN = ['CAREGIVER', 'NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN'];

export async function requireWallViewer(req: Request): Promise<QuienMira | NextResponse> {
    // 1. El televisor. Se comprueba primero: es el caso normal en el edificio.
    const token = req.headers.get('x-device-token');
    if (token) {
        const device = await prisma.externalKioskDevice.findUnique({
            where: { deviceToken: token },
            select: { id: true, headquartersId: true, label: true, isActive: true, revokedAt: true, purpose: true },
        });
        if (!device || !device.isActive || device.revokedAt) {
            return NextResponse.json(
                { success: false, error: 'Pantalla revocada. Contacta al administrador.' },
                { status: 401 },
            );
        }
        if (device.purpose !== 'WALL') {
            return NextResponse.json(
                { success: false, error: 'Este dispositivo no es una pantalla de pared.' },
                { status: 403 },
            );
        }
        // Huella de vida: permite saber desde el panel si la pared sigue encendida.
        prisma.externalKioskDevice
            .update({ where: { id: device.id }, data: { lastSeenAt: new Date() } })
            .catch(() => { /* no bloquea la pared por no poder sellar la hora */ });

        return {
            headquartersId: device.headquartersId,
            via: 'DISPOSITIVO',
            quien: device.label,
            userId: null,
        };
    }

    // 2. Una persona con sesión.
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }
    const rol = (session.user as any).role;
    if (!ROLES_QUE_MIRAN.includes(rol)) {
        return NextResponse.json({ success: false, error: 'Rol no autorizado' }, { status: 403 });
    }
    return {
        headquartersId: (session.user as any).headquartersId,
        via: 'SESION',
        quien: (session.user as any).name ?? 'Personal',
        userId: (session.user as any).id ?? null,
    };
}
