import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
    try {
        const { residentName, visitorName, visitorRelation, signatureData } = await req.json();

        if (!residentName || !visitorName) {
            return NextResponse.json({ error: 'residentName y visitorName son requeridos' }, { status: 400 });
        }

        // Buscar el residente por nombre (búsqueda parcial, case-insensitive)
        const patient = await prisma.patient.findFirst({
            where: {
                name: { contains: residentName.trim(), mode: 'insensitive' },
                status: 'ACTIVE'
            }
        });

        if (!patient) {
            return NextResponse.json({ error: `No se encontró un residente activo con el nombre "${residentName}". Por favor avise al personal.` }, { status: 404 });
        }

        // Crear el registro de visita
        const visit = await prisma.familyVisit.create({
            data: {
                headquartersId: patient.headquartersId,
                patientId: patient.id,
                visitorName: visitorName.trim(),
                visitorRelation: visitorRelation?.trim() || null,
                signatureData: signatureData || null,
            }
        });

        // Crear notificación interna para supervisores/directores de esa sede
        const supervisors = await prisma.user.findMany({
            where: {
                headquartersId: patient.headquartersId,
                role: { in: ['DIRECTOR', 'ADMIN', 'SUPERVISOR'] },
                isActive: true
            },
            select: { id: true }
        });

        if (supervisors.length > 0) {
            await prisma.notification.createMany({
                data: supervisors.map(s => ({
                    userId: s.id,
                    type: 'VISIT_CHECKIN',
                    title: `Visita registrada — ${patient.name}`,
                    message: `${visitorName}${visitorRelation ? ` (${visitorRelation})` : ''} se registró en recepción para visitar a ${patient.name}.`,
                }))
            });
        }

        return NextResponse.json({ success: true, visitId: visit.id });

    } catch (error) {
        console.error('Error registrando visita:', error);
        return NextResponse.json({ success: false, error: 'Error interno al registrar la visita.' }, { status: 500 });
    }
}
