import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

const prisma = new PrismaClient();

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !['DIRECTOR', 'ADMIN', 'SUPERVISOR'].includes(session.user.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const resolvedParams = await params;
        const employeeId = resolvedParams.id;
        const body = await req.json();
        const { preferredShift, offDays } = body;

        // Verify employee belongs to HQ
        const employee = await prisma.user.findUnique({
            where: { id: employeeId }
        });

        if (!employee || employee.headquartersId !== session.user.headquartersId) {
            return NextResponse.json({ error: 'Empleado no encontrado o no pertenece a la sede' }, { status: 404 });
        }

        const updatedUser = await prisma.user.update({
            where: { id: employeeId },
            data: {
                preferredShift: preferredShift || null,
                offDays: offDays || []
            }
        });

        return NextResponse.json({ success: true, user: updatedUser });

    } catch (error) {
        console.error("Update Preferences Error:", error);
        return NextResponse.json({ error: "Fallo actualizando preferencias del empleado" }, { status: 500 });
    }
}
