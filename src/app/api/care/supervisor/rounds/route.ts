import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// FASE 41: Clinical Supervisor Rounds (Rondas)
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { hqId, supervisorId, area, isClean, isSafe, notes } = body;

        if (!hqId || !supervisorId || !area) {
            return NextResponse.json({ success: false, error: 'Faltan parámetros de área clínica' }, { status: 400 });
        }

        // Usaremos el Action Hub existente o un HQ Event genérico para trazar las Rondas,
        // ya que evita engrosar la base de datos con una tabla efímera extra.
        // Simularemos la inserción como un HQ Dashboard Note por ahora o Evento de Seguridad.

        const round = await prisma.headquartersEvent.create({
            data: {
                headquartersId: hqId,
                title: `Ronda de Supervisor: ${area}`,
                description: `Auditoría: ${isClean ? 'Limpio ' : 'Sucio '} | Segurida: ${isSafe ? 'Seguro ' : 'Caídas '} \nNotas: ${notes || 'N/A'}`,
                type: 'OTHER', // For now, mapping INFRASTRUCTURE/ROUNDS to OTHER if it doesn't exist in the enum, or we can use OTHER. Let's stick to OTHER.
                startTime: new Date(),
                endTime: new Date(),
                status: 'RESOLVED', // Rounds are instantly resolved since they are audits.
            }
        });

        return NextResponse.json({ success: true, message: 'Ronda Clínica completada con éxito', round });
    } catch (error) {
        console.error("Error guardando la ronda del supervisor:", error);
        return NextResponse.json({ success: false, error: "Error en servidor" }, { status: 500 });
    }
}
