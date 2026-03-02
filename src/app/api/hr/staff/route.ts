import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const hqId = searchParams.get('hqId');

        if (!hqId) {
            return NextResponse.json({ success: false, error: "Dominio de Sede (HQ) Requerido" }, { status: 400 });
        }

        const staff = await prisma.user.findMany({
            where: { headquartersId: hqId },
            orderBy: [{ role: 'asc' }, { name: 'asc' }]
        });

        return NextResponse.json({ success: true, staff });
    } catch (error) {
        console.error("Error fetching staff:", error);
        return NextResponse.json({ success: false, error: "Fallo leyendo directorio de empleados" }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const body = await req.json();
        const { userId, newRole, isBlocked, blockReason } = body;

        if (!userId) {
            return NextResponse.json({ success: false, error: "ID de Empleado Requerido" }, { status: 400 });
        }

        // Determinar qué estamos actualizando
        let updateData: any = {};
        if (newRole) updateData.role = newRole;
        if (typeof isBlocked === 'boolean') {
            updateData.isShiftBlocked = isBlocked;
            updateData.blockReason = isBlocked ? (blockReason || "Bloqueo Administrativo") : null;
        }

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: updateData
        });

        return NextResponse.json({ success: true, user: updatedUser });
    } catch (error) {
        console.error("Error updating staff:", error);
        return NextResponse.json({ success: false, error: "Fallo actualizando perfil del empleado" }, { status: 500 });
    }
}
