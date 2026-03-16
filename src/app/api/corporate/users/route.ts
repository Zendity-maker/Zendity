import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const hqId = searchParams.get('headquartersId');
        const rolesParam = searchParams.get('role'); // e.g. "NURSE,CAREGIVER"

        let rolesFilter: any = undefined;
        if (rolesParam) {
            rolesFilter = { in: rolesParam.split(',') };
        }

        const users = await prisma.user.findMany({
            where: {
                ...(hqId && { headquartersId: hqId }),
                ...(rolesFilter && { role: rolesFilter }),
                isActive: true
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
