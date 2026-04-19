import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
    try {
        const { residentName, visitorName, visitorRelation, signatureData, timestamp, patientId: incomingPatientId } = await req.json();

        if (!residentName || !visitorName) {
            return NextResponse.json({ success: false, error: 'Datos incompletos' }, { status: 400 });
        }

        const visitedAt = new Date(timestamp || Date.now());

        // 1. Usar patientId directo si viene del frontend (búsqueda previa), si no buscar por nombre
        let patient = null;
        if (incomingPatientId) {
            patient = await prisma.patient.findUnique({
                where: { id: incomingPatientId },
                include: { headquarters: { select: { id: true, name: true } } }
            });
        } else {
            patient = await prisma.patient.findFirst({
                where: {
                    name: { contains: residentName, mode: 'insensitive' },
                    status: 'ACTIVE'
                },
                include: { headquarters: { select: { id: true, name: true } } }
            });
        }

        if (!patient?.headquartersId) {
            return NextResponse.json(
                { success: false, error: 'Residente no encontrado' },
                { status: 404 }
            );
        }
        const hqId = patient.headquartersId;

        // 2. Guardar visita en FamilyVisit
        let visit = null;
        try {
            visit = await prisma.familyVisit.create({
                data: {
                    visitorName,
                    residentName: patient?.name || residentName,
                    visitorRelation: visitorRelation?.trim() || null,
                    patientId: patient?.id || null,
                    headquartersId: hqId,
                    signatureData: signatureData ? signatureData.substring(0, 50000) : null,
                    visitedAt,
                    notified: false
                }
            });
        } catch (e) {
            console.error('FamilyVisit create error:', e);
        }

        // 3. Registrar nota en el perfil del residente (FamilyVisitNote)
        if (patient?.id) {
            try {
                const dateStr = visitedAt.toLocaleDateString('es-PR', {
                    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                });
                const timeStr = visitedAt.toLocaleTimeString('es-PR', {
                    hour: '2-digit', minute: '2-digit'
                });
                await prisma.familyVisitNote.create({
                    data: {
                        patientId: patient.id,
                        headquartersId: hqId,
                        visitorName,
                        visitedAt,
                        notes: `Visita registrada en recepción: ${visitorName} visitó a ${patient.name} el ${dateStr} a las ${timeStr}.`
                    }
                }).catch(() => null);
            } catch (e) {
                console.error('FamilyVisitNote error:', e);
            }
        }

        // 4. Notificar a supervisores y directores activos en la sede
        try {
            const supervisors = await prisma.user.findMany({
                where: {
                    headquartersId: hqId,
                    role: { in: ['SUPERVISOR', 'DIRECTOR', 'ADMIN'] },
                    isActive: true,
                    isDeleted: false
                },
                select: { id: true }
            });

            const hour = visitedAt.toLocaleTimeString('es-PR', { hour: '2-digit', minute: '2-digit' });
            const dateStr = visitedAt.toLocaleDateString('es-PR', { weekday: 'long', month: 'long', day: 'numeric' });

            await Promise.all(supervisors.map(sup =>
                prisma.notification.create({
                    data: {
                        userId: sup.id,
                        type: 'FAMILY_VISIT',
                        title: `Visita familiar — ${patient?.name || residentName}`,
                        message: `${visitorName} se registró en recepción para visitar a ${patient?.name || residentName} el ${dateStr} a las ${hour}.`,
                        isRead: false
                    }
                }).catch(() => null)
            ));
        } catch (e) {
            console.error('Notification error:', e);
        }

        return NextResponse.json({
            success: true,
            visit,
            patient: patient?.name || null,
            hqName: patient?.headquarters?.name || 'Vivid Senior Living Cupey'
        });

    } catch (error) {
        console.error('Reception visit error:', error);
        return NextResponse.json({ success: true }); // Nunca bloquear el kiosco
    }
}
