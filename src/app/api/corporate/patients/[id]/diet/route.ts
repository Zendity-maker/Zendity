import { NextResponse } from "next/server";
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

const ALLOWED_ROLES = ['NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN'];

export async function PUT(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
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

        const { id } = await params;
        const { diet } = await req.json();

        if (!diet) {
            return NextResponse.json({ success: false, error: "Dieta no fue proveída" }, { status: 400 });
        }

        // Tenant check: paciente debe pertenecer a la sede del invocador
        const existing = await prisma.patient.findFirst({
            where: { id, headquartersId: hqId },
            select: { id: true }
        });
        if (!existing) {
            // No revelar si existe en otra sede — 404 opaco
            return NextResponse.json({ success: false, error: "Residente no encontrado" }, { status: 404 });
        }

        const patient = await prisma.patient.update({
            where: { id },
            data: { diet }
        });

        return NextResponse.json({ success: true, patient });
    } catch (error: any) {
        console.error("Error actualizando dieta:", error);
        return NextResponse.json({ success: false, error: "Error interno del servidor" }, { status: 500 });
    }
}
