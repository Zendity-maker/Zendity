/**
 * AUTORIZACIÓN DE UNA VISITA FUERA DE HORARIO
 * ──────────────────────────────────────────
 * El horario de Vivid es martes a domingo de 10 a 6. Fuera de eso NO se
 * bloquea —una emergencia no espera al martes, y un kiosco que le cierra la
 * puerta a un hijo que llega de madrugada porque su madre empeoró sería peor
 * que no tener kiosco— pero no entra nadie sin que un miembro del personal lo
 * autorice con su PIN, y su nombre queda en el asiento.
 *
 * Devuelve un identificador de la persona que autoriza, para que el registro
 * de la visita lo guarde. El PIN NUNCA viaja de vuelta ni se guarda en ningún
 * sitio: se valida y se descarta.
 *
 * Se acepta hash bcrypt o texto plano, igual que `src/lib/auth.ts` — hay PINs
 * antiguos sin migrar y romperlos aquí dejaría a esas personas sin poder
 * autorizar nada.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireKioskDevice } from '@/lib/external-kiosk-auth';
import bcrypt from 'bcryptjs';
import type { Role } from '@prisma/client';

export const dynamic = 'force-dynamic';

/** Quién puede dejar entrar a alguien fuera de horario. */
const PUEDEN_AUTORIZAR: Role[] = ['SUPERVISOR', 'DIRECTOR', 'ADMIN', 'NURSE'];

export async function POST(req: Request) {
    const device = await requireKioskDevice(req);
    if (device instanceof NextResponse) return device;

    try {
        const { pin } = await req.json();
        const limpio = String(pin ?? '').trim();
        if (!limpio) {
            return NextResponse.json({ success: false, error: 'Falta el PIN' }, { status: 400 });
        }

        // Solo personal ACTIVO de ESTA sede con rol que pueda autorizar.
        const candidatos = await prisma.user.findMany({
            where: {
                headquartersId: device.headquartersId,
                isActive: true,
                isDeleted: false,
                role: { in: PUEDEN_AUTORIZAR },
                pinCode: { not: null },
            },
            select: { id: true, name: true, role: true, pinCode: true },
        });

        let quien: { id: string; name: string | null; role: string } | null = null;
        for (const u of candidatos) {
            const ok = u.pinCode!.startsWith('$2')
                ? await bcrypt.compare(limpio, u.pinCode!)
                : u.pinCode === limpio;
            if (ok) { quien = { id: u.id, name: u.name, role: u.role }; break; }
        }

        if (!quien) {
            // Mensaje único: no se dice si el PIN no existe o si esa persona no
            // puede autorizar. Distinguirlo convertiría el kiosco del lobby en
            // un probador de PINs válidos.
            return NextResponse.json(
                { success: false, error: 'PIN no reconocido. Pida ayuda a supervisión o dirección.' },
                { status: 401 },
            );
        }

        return NextResponse.json({
            success: true,
            autorizadaPorId: quien.id,
            autorizadaPor: quien.name,
        });
    } catch (error) {
        console.error('Reception autorizar error:', error);
        return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 });
    }
}
