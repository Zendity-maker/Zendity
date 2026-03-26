import { NextResponse } from "next/server";
import { prisma } from '@/lib/prisma';



// Obtener los Relevos de Guardia
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const headquartersId = searchParams.get("headquartersId");

        if (!headquartersId) {
            return NextResponse.json({ error: "headquartersId es requerido" }, { status: 400 });
        }

        const handovers = await prisma.shiftHandover.findMany({
            where: { headquartersId },
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
        const body = await request.json();
        const { action, handoverId, headquartersId, shiftType, outgoingNurseId, incomingNurseId, notes } = body;

        // Acción: Enfermera Entrante (Acepta el Turno)
        if (action === "ACCEPT_HANDOVER") {
            if (!handoverId) return NextResponse.json({ error: "handoverId requerido" }, { status: 400 });

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
            if (!headquartersId || !shiftType || !outgoingNurseId || !incomingNurseId || !notes || !notes.length) {
                return NextResponse.json({ error: "Faltan datos requeridos para efectuar el Relevo." }, { status: 400 });
            }

            const newHandover = await prisma.shiftHandover.create({
                data: {
                    headquartersId,
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
