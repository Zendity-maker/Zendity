import { NextResponse } from "next/server";
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

const ALLOWED_ROLES = ['NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN'];

// Obtener los Relevos de Guardia (filtrados por la sede del invocador)
export async function GET() {
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

        const handovers = await prisma.shiftHandover.findMany({
            where: { headquartersId: hqId },
            include: {
                outgoingNurse: { select: { name: true, role: true } },
                incomingNurse: { select: { name: true, role: true } },
                notes: {
                    include: {
                        patient: { select: { name: true, roomNumber: true } }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json(handovers);
    } catch (error) {
        console.error("GET Handover Error:", error);
        return NextResponse.json({ error: "Failed to fetch handovers" }, { status: 500 });
    }
}

// Crear un Relevo o Aceptar uno Existente
export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }
        const invokerId = (session.user as any).id;
        const invokerRole = (session.user as any).role;
        const hqId = (session.user as any).headquartersId;
        if (!ALLOWED_ROLES.includes(invokerRole)) {
            return NextResponse.json({ error: 'Rol no autorizado' }, { status: 403 });
        }

        const body = await request.json();
        const { action, handoverId, shiftType, outgoingNurseId, incomingNurseId, notes } = body;

        // Acción: Enfermera Entrante (Acepta el Turno)
        if (action === "ACCEPT_HANDOVER") {
            if (!handoverId) return NextResponse.json({ error: "handoverId requerido" }, { status: 400 });

            // Tenant check: handover debe pertenecer a la sede del invocador
            const existing = await prisma.shiftHandover.findFirst({
                where: { id: handoverId, headquartersId: hqId },
                select: { id: true }
            });
            if (!existing) {
                return NextResponse.json({ error: 'Relevo no encontrado' }, { status: 404 });
            }

            const accepted = await prisma.shiftHandover.update({
                where: { id: handoverId },
                data: {
                    status: 'ACCEPTED',
                    acceptedAt: new Date()
                }
            });
            return NextResponse.json(accepted);
        }

        // Acción: Enfermera Saliente (Entrega el Turno)
        if (action === "CREATE_HANDOVER") {
            if (!shiftType || !outgoingNurseId || !incomingNurseId || !notes || !notes.length) {
                return NextResponse.json({ error: "Faltan datos requeridos para efectuar el Relevo." }, { status: 400 });
            }

            // hqId SIEMPRE de session — nunca del body
            // outgoingNurseId debe coincidir con el invocador (o ser admitido por ADMIN/DIRECTOR)
            if (outgoingNurseId !== invokerId && !['ADMIN', 'DIRECTOR', 'SUPERVISOR'].includes(invokerRole)) {
                return NextResponse.json({ error: 'Solo puedes entregar tu propio turno' }, { status: 403 });
            }

            // Verificar que ambas enfermeras y los pacientes pertenezcan a la sede
            const [outgoing, incoming] = await Promise.all([
                prisma.user.findFirst({ where: { id: outgoingNurseId, headquartersId: hqId }, select: { id: true } }),
                prisma.user.findFirst({ where: { id: incomingNurseId, headquartersId: hqId }, select: { id: true } }),
            ]);
            if (!outgoing || !incoming) {
                return NextResponse.json({ error: 'Enfermera no encontrada en tu sede' }, { status: 404 });
            }
            const patientIds = notes.map((n: any) => n.patientId).filter(Boolean);
            if (patientIds.length > 0) {
                const validPatients = await prisma.patient.findMany({
                    where: { id: { in: patientIds }, headquartersId: hqId },
                    select: { id: true }
                });
                if (validPatients.length !== patientIds.length) {
                    return NextResponse.json({ error: 'Residente no encontrado' }, { status: 404 });
                }
            }

            const newHandover = await prisma.shiftHandover.create({
                data: {
                    headquartersId: hqId,
                    shiftType,
                    outgoingNurseId,
                    incomingNurseId,
                    status: 'PENDING',
                    notes: {
                        create: notes.map((n: any) => ({
                            patientId: n.patientId,
                            clinicalNotes: n.clinicalNotes,
                            isCritical: n.isCritical
                        }))
                    }
                }
            });
            return NextResponse.json(newHandover);
        }

        return NextResponse.json({ error: "Acción no reconocida" }, { status: 400 });

    } catch (error) {
        console.error("POST Handover Error:", error);
        return NextResponse.json({ error: "Failed to process handover" }, { status: 500 });
    }
}
