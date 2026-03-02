import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { format, startOfDay, endOfDay } from 'date-fns';

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const hqId = (session.user as any).headquartersId;
        const todayStart = startOfDay(new Date());
        const todayEnd = endOfDay(new Date());

        // 1. Obtener todos los pacientes de la HQ que tengan medicación activa
        const patients = await prisma.patient.findMany({
            where: { headquartersId: hqId },
            include: {
                medications: {
                    where: { isActive: true },
                    include: {
                        medication: true,
                        // Traer solo las administraciones de HOY para ver si ya se le dio el fármaco
                        administrations: {
                            where: {
                                administeredAt: {
                                    gte: todayStart,
                                    lte: todayEnd
                                }
                            },
                            orderBy: { administeredAt: 'desc' },
                            take: 1
                        }
                    }
                }
            }
        });

        // 2. Mapear al modelo DTO que espera el Frontend eMAR
        const payload = patients.map((p: any) => {
            return {
                id: p.id,
                name: p.name,
                room: p.roomNumber || 'Piso General',
                medications: p.medications.map((pm: any) => {
                    const latestAdmin = pm.administrations[0];
                    return {
                        id: pm.id,
                        name: pm.medication.name,
                        dosage: pm.medication.dosage,
                        route: pm.medication.route,
                        time: pm.frequency === 'PRN' ? 'PRN' : pm.scheduleTimes, // Tratamiento simple inicial
                        instructions: pm.instructions || 'Dosis Estándar',
                        status: latestAdmin ? latestAdmin.status : 'PENDING' // ADMINISTERED, REFUSED, OMITTED
                    };
                })
            };
        });

        // Filtrar pacientes que no tienen medicaciones para no ensuciar el dashboard
        const activePayload = payload.filter((p: any) => p.medications.length > 0);

        return NextResponse.json({ success: true, patients: activePayload });

    } catch (error) {
        console.error('Error fetching eMAR Roster:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const body = await req.json();
        const { patientMedicationId, status, notes, scheduledFor } = body;
        const nurseId = session.user.id;

        // Validaciones Cero-Error
        if (!patientMedicationId || !status) {
            return NextResponse.json({ error: 'Faltan parámetros biométricos' }, { status: 400 });
        }

        // Crear el registro inmutable en PostgreSQL
        const adminLog = await prisma.medicationAdministration.create({
            data: {
                patientMedicationId,
                administeredById: nurseId,
                status: status, // ADMINISTERED | REFUSED | OMITTED
                notes: notes || null,
                scheduledFor: scheduledFor || null
            }
        });

        return NextResponse.json({ success: true, adminLog });

    } catch (error) {
        console.error('Error saving Medication Admin:', error);
        return NextResponse.json({ error: 'Database Write Error' }, { status: 500 });
    }
}
