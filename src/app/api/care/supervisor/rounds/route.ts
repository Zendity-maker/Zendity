import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

// FASE 41: Clinical Supervisor Rounds (Rondas)
export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !['DIRECTOR', 'ADMIN', 'NURSE', 'SUPERVISOR'].includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }

        const body = await req.json();
        const { hqId, supervisorId, area, isClean, isSafe, notes } = body;

        if (!hqId || !supervisorId || !area) {
            return NextResponse.json({ success: false, error: 'Faltan parámetros de área clínica' }, { status: 400 });
        }

        // Usaremos el Action Hub existente o un HQ Event genérico para trazar las Rondas,
        // ya que evita engrosar la base de datos con una tabla efímera extra.
        const round = await prisma.headquartersEvent.create({
            data: {
                headquartersId: hqId,
                title: `Ronda de Supervisor: ${area}`,
                description: `Auditoría: ${isClean ? 'Limpio ' : 'Sucio '} | Segurida: ${isSafe ? 'Seguro ' : 'Caídas '} \nNotas: ${notes || 'N/A'}`,
                type: 'INFRASTRUCTURE',
                targetPopulation: 'STAFF',
                assignedToId: supervisorId,
                startTime: new Date(),
                endTime: new Date(),
                status: 'RESOLVED',
            }
        });

        return NextResponse.json({ success: true, message: 'Ronda Clínica completada con éxito', round });
    } catch (error) {
        console.error("Error guardando la ronda del supervisor:", error);
        return NextResponse.json({ success: false, error: "Error en servidor" }, { status: 500 });
    }
}
