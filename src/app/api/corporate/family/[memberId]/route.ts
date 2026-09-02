import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * DELETE /api/corporate/family/[memberId]
 * Elimina un FamilyMember. Solo DIRECTOR y ADMIN.
 * Valida que FamilyMember.headquartersId === session.user.headquartersId.
 */
export async function DELETE(
    _req: Request,
    { params }: { params: Promise<{ memberId: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });

        const role = (session.user as any).role;
        if (!['DIRECTOR', 'ADMIN'].includes(role)) {
            return NextResponse.json({ success: false, error: 'Solo DIRECTOR o ADMIN pueden eliminar familiares' }, { status: 403 });
        }

        const hqId = (session.user as any).headquartersId;
        const { memberId } = await params;

        const member = await prisma.familyMember.findUnique({
            where: { id: memberId },
            select: { id: true, headquartersId: true },
        });
        if (!member) return NextResponse.json({ success: false, error: 'Familiar no encontrado' }, { status: 404 });
        if (member.headquartersId !== hqId) {
            return NextResponse.json({ success: false, error: 'Familiar no pertenece a tu sede' }, { status: 403 });
        }

        await prisma.familyMember.delete({ where: { id: memberId } });
        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error('[Family DELETE]', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

/**
 * PUT /api/corporate/family/[memberId]
 * Edita un FamilyMember. Solo DIRECTOR, ADMIN, SUPERVISOR.
 * NO permite cambiar email (es el identificador único).
 * Valida que FamilyMember.headquartersId === session.user.headquartersId.
 */
export async function PUT(
    req: Request,
    { params }: { params: Promise<{ memberId: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });

        const role = (session.user as any).role;
        if (!['DIRECTOR', 'ADMIN', 'SUPERVISOR'].includes(role)) {
            return NextResponse.json({ success: false, error: 'Solo DIRECTOR, ADMIN o SUPERVISOR pueden editar familiares' }, { status: 403 });
        }

        const hqId = (session.user as any).headquartersId;
        const { memberId } = await params;
        const body = await req.json();
        const { name, phone, accessLevel, relationship, isPrimary } = body;

        const member = await prisma.familyMember.findUnique({
            where: { id: memberId },
            select: { id: true, headquartersId: true, patientId: true },
        });
        if (!member) return NextResponse.json({ success: false, error: 'Familiar no encontrado' }, { status: 404 });
        if (member.headquartersId !== hqId) {
            return NextResponse.json({ success: false, error: 'Familiar no pertenece a tu sede' }, { status: 403 });
        }

        const updateData: any = {};
        if (name !== undefined) updateData.name = name;
        if (phone !== undefined) updateData.phone = phone || null;
        if (accessLevel !== undefined) updateData.accessLevel = accessLevel || 'Full';
        if (relationship !== undefined) updateData.relationship = relationship || null;

        // FAMILIAR PRINCIPAL — hasta hoy solo se podia marcar en el asistente de
        // admision, o sea unicamente al ingresar al residente. Para alguien ya
        // admitido no habia forma de cambiarlo: por eso solo 4 de 19 residentes
        // con contacto lo tenian. El correo del PAI aprobado sale UNICAMENTE al
        // principal, asi que aprobar el plan de los demas lo dejaba en silencio.
        //
        // Es unico por residente: marcar uno desmarca a los demas y sincroniza
        // Patient.primaryFamilyMemberId, que es el campo que lee el envio.
        if (isPrimary === true) {
            const [, , updated] = await prisma.$transaction([
                prisma.familyMember.updateMany({
                    where: { patientId: member.patientId, id: { not: memberId }, isPrimary: true },
                    data: { isPrimary: false },
                }),
                prisma.patient.update({
                    where: { id: member.patientId },
                    data: { primaryFamilyMemberId: memberId },
                }),
                prisma.familyMember.update({
                    where: { id: memberId },
                    data: { ...updateData, isPrimary: true },
                }),
            ]);
            return NextResponse.json({ success: true, member: updated });
        }

        const updated = await prisma.familyMember.update({
            where: { id: memberId },
            data: updateData,
        });
        return NextResponse.json({ success: true, member: updated });
    } catch (err: any) {
        console.error('[Family PUT]', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
