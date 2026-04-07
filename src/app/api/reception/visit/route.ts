import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
    try {
        const { residentName, visitorName, visitorRelation, signatureData } = await req.json();

        if (!visitorName) {
            return NextResponse.json({ error: 'visitorName es requerido' }, { status: 400 });
        }

        // Buscar el residente por nombre (búsqueda parcial, case-insensitive)
        const patient = await prisma.patient.findFirst({
            where: {
                name: { contains: (residentName || '').trim(), mode: 'insensitive' },
                status: 'ACTIVE'
            }
        }).catch(() => null);

        // Crear el registro de visita — robusto: no bloquea al visitante si falla
        let visit = null;
        try {
            visit = await prisma.familyVisit.create({
                data: {
                    visitorName: visitorName.trim(),
                    residentName: residentName?.trim() || null,
                    patientId: patient?.id || null,
                    headquartersId: patient?.headquartersId || 'b5d13d84-0a57-42fe-a1ed-bff887ed0c09',
                    visitorRelation: visitorRelation?.trim() || null,
                    signatureData: signatureData ? signatureData.substring(0, 50000) : null,
                    notified: false
                }
            });
        } catch (e) {
            console.error('FamilyVisit create error:', e);
            // Continuar aunque falle el registro — no bloquear al visitante
        }

        // Crear notificaciones internas si el registro fue exitoso
        if (visit && patient) {
            const supervisors = await prisma.user.findMany({
                where: {
                    headquartersId: patient.headquartersId,
                    role: { in: ['DIRECTOR', 'ADMIN', 'SUPERVISOR'] },
                    isActive: true
                },
                select: { id: true }
            }).catch(() => []);

            if (supervisors.length > 0) {
                await prisma.notification.createMany({
                    data: supervisors.map(s => ({
                        userId: s.id,
                        type: 'VISIT_CHECKIN',
                        title: `Visita registrada — ${patient.name}`,
                        message: `${visitorName}${visitorRelation ? ` (${visitorRelation})` : ''} se registró en recepción para visitar a ${patient.name}.`,
                    }))
                }).catch(() => null);
            }
        }

        return NextResponse.json({ success: true, visit, patient: patient?.name || null });

    } catch (error) {
        console.error('Error en reception/visit:', error);
        // Siempre devolver success para no bloquear al visitante en el kiosco
        return NextResponse.json({ success: true, visit: null, patient: null });
    }
}
