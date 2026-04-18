import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

const ALLOWED_ROLES = ['DIRECTOR', 'ADMIN', 'SUPERVISOR'];

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }
        const invokerRole = (session.user as any).role;
        const hqId = (session.user as any).headquartersId;
        if (!ALLOWED_ROLES.includes(invokerRole)) {
            return NextResponse.json({ error: 'Rol no autorizado' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const rolesParam = searchParams.get('role'); // e.g. "NURSE,CAREGIVER"

        let rolesFilter: any = undefined;
        if (rolesParam) {
            rolesFilter = { in: rolesParam.split(',') };
        }

        // headquartersId SIEMPRE de session.user — nunca del query string
        const users = await prisma.user.findMany({
            where: {
                headquartersId: hqId,
                ...(rolesFilter && { role: rolesFilter }),
                isDeleted: false,
                isShiftBlocked: false
            },
            select: {
                id: true,
                name: true,
                role: true,
                preferredShift: true,
                offDays: true
            }
        });

        // Si por alguna razón la DB está vacía, devolvemos un array vacío,
        // pero NO devolvemos ids fantasmas ("u1") para evitar Foreign Key error en Prisma.
        return NextResponse.json(users);
    } catch (error) {
        console.error("GET Corporate Users Error:", error);
        return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
    }
}
