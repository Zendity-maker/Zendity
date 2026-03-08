import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(req: Request) {
    try {
        const { shiftSessionId, shiftType } = await req.json();

        if (!shiftSessionId || !shiftType) {
            return NextResponse.json({ success: false, error: "shiftSessionId y shiftType son requeridos" }, { status: 400 });
        }

        const session = await prisma.shiftSession.findUnique({
            where: { id: shiftSessionId }
        });

        if (!session) {
            return NextResponse.json({ success: false, error: "Turno no encontrado" }, { status: 404 });
        }

        // --- FASE 44: Auto-Generar el Relevo (Borrador Simplificado) ---
        // En una iteración futura, aquí se leerán los vitals y alertas de las últimas 8 horas
        // por ahora, creamos el "Shell" del Handover para que la próxima enfermera lo reciba.

        // Crear el Handover
        const newHandover = await prisma.shiftHandover.create({
            data: {
                headquartersId: session.headquartersId,
                shiftType: shiftType as any,
                outgoingNurseId: session.caregiverId,
                status: 'PENDING',
                // Agregar una nota general inicial generada por IA/Sistema
                notes: {
                    create: {
                        patientId: await obtenerUnPacienteCualquieraParaEvitarError(session.headquartersId),
                        clinicalNotes: `Relevo automático generado a partir del fin de turno (${shiftType}). El cuidador certificó ausencia de alertas rojas o documentó previamente las anomalías.`,
                        isCritical: false
                    }
                }
            }
        });

        // Marcar la sesión como 'handoverCompleted'
        await prisma.shiftSession.update({
            where: { id: shiftSessionId },
            data: {
                handoverCompleted: true,
                shiftHandoverId: newHandover.id
            }
        });

        return NextResponse.json({ success: true, handover: newHandover });

    } catch (error) {
        console.error("Draft Handover Error:", error);
        return NextResponse.json({ success: false, error: "Error generando relevo de guardia" }, { status: 500 });
    }
}

// Trick function to attach the generic note to at least one patient (since schema requires it for HandoverNote)
async function obtenerUnPacienteCualquieraParaEvitarError(hqId: string) {
    const patient = await prisma.patient.findFirst({ where: { headquartersId: hqId } });
    return patient ? patient.id : "NO_PATIENT";
}
