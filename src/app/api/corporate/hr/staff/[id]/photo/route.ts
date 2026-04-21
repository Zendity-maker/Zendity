import { NextResponse } from "next/server";
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

const ALLOWED_ROLES = ['SUPERVISOR', 'DIRECTOR', 'ADMIN'];

export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }
        if (!ALLOWED_ROLES.includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: 'Rol no autorizado' }, { status: 403 });
        }
        const invokerHqId = (session.user as any).headquartersId;

        const resolvedParams = await params;
        const staffId = resolvedParams.id;

        // Tenant check
        const staffCheck = await prisma.user.findUnique({
            where: { id: staffId },
            select: { headquartersId: true },
        });
        if (!staffCheck || staffCheck.headquartersId !== invokerHqId) {
            return NextResponse.json({ success: false, error: 'Empleado fuera de tu sede' }, { status: 403 });
        }

        const { photoUrl } = await req.json();

        if (!photoUrl) {
            return NextResponse.json({ success: false, error: "Falta photoUrl" }, { status: 400 });
        }

        const updatedStaff = await prisma.user.update({
            where: { id: staffId },
            data: { photoUrl }
        });

        return NextResponse.json({
            success: true,
            photoUrl: updatedStaff.photoUrl
        });
    } catch (e: any) {
        console.error("Staff Photo Upload Error:", e);
        return NextResponse.json({ success: false, error: "Error interno subiendo la fotografía del empleado." }, { status: 500 });
    }
}
