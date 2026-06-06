import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const token = searchParams.get('token');
        if (!token) return NextResponse.json({ valid: false });

        // Token válido + no expirado = gate suficiente. Antes exigíamos
        // isRegistered=false, lo que bloqueaba el flujo de reset. El token
        // mismo es uno-y-usado (activate lo anula al consumir), así que un
        // familiar ya registrado puede recibir un enlace de reset y crear
        // PIN nuevo sin que su PIN viejo deje de funcionar mientras tanto.
        const fm = await prisma.familyMember.findFirst({
            where: {
                inviteToken: token,
                inviteExpiry: { gt: new Date() },
            },
            select: { id: true, name: true, email: true, isRegistered: true, patient: { select: { name: true } } }
        });

        if (!fm) return NextResponse.json({ valid: false });
        return NextResponse.json({ valid: true, familyMember: fm, isReset: fm.isRegistered });
    } catch {
        return NextResponse.json({ valid: false });
    }
}
