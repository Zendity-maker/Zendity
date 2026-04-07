import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
    try {
        const { token, pin } = await req.json();
        if (!token || !pin) return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });

        const fm = await prisma.familyMember.findFirst({
            where: { inviteToken: token, inviteExpiry: { gt: new Date() }, isRegistered: false }
        });

        if (!fm) return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 400 });
        if (!fm.email) return NextResponse.json({ error: 'Email no disponible' }, { status: 400 });

        // Establecer passcode y marcar como registrado
        await prisma.familyMember.update({
            where: { id: fm.id },
            data: {
                passcode: pin,
                isRegistered: true,
                inviteToken: null,
                inviteExpiry: null
            }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Activate error:', error);
        return NextResponse.json({ error: 'Error activando acceso' }, { status: 500 });
    }
}
