import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !['DIRECTOR', 'ADMIN', 'NURSE', 'SUPERVISOR'].includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
        }

        const lifePlans = await prisma.lifePlan.findMany({
            where: {
                patient: {
                    status: { notIn: ['DISCHARGED', 'DECEASED'] },
                    // Tenant — solo PAIs de residentes de tu sede (antes: todas las sedes).
                    headquartersId: (session.user as any).headquartersId,
                }
            },
            include: {
                // Solo lo que la lista usa. `patient: true` mandaba el expediente
                // completo al navegador en cada carga.
                patient: { select: { id: true, name: true, roomNumber: true, status: true } },
                signedBy: { select: { name: true, role: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        // ── RESUMEN: cuantos PAI estan al dia y cuantos faltan ──────────────
        // Se cuenta por RESIDENTE, no por plan: un residente sin ningun plan no
        // aparece en la lista de arriba y era justo el que no se veia. Un plan
        // solo esta "al dia" cuando ademas la familia recibio su copia — aprobar
        // sin enviar es media tarea, y esa mitad es la que se pierde de vista.
        const hqId = (session.user as any).headquartersId;
        const activos = await prisma.patient.findMany({
            where: { headquartersId: hqId, status: 'ACTIVE' },
            select: {
                lifePlans: {
                    orderBy: { createdAt: 'desc' },
                    select: { status: true, emailSentAt: true, nextReview: true },
                },
            },
        });

        const ahora = new Date();
        const resumen = { total: activos.length, alDia: 0, sinEnviar: 0, vencidos: 0, borrador: 0, sinPlan: 0 };
        for (const p of activos) {
            const aprobado = p.lifePlans.find(pl => pl.status === 'APPROVED');
            if (!p.lifePlans.length)   { resumen.sinPlan++;   continue; }
            if (!aprobado)             { resumen.borrador++;  continue; }
            if (!aprobado.emailSentAt) { resumen.sinEnviar++; continue; }
            if (aprobado.nextReview && aprobado.nextReview < ahora) { resumen.vencidos++; continue; }
            resumen.alDia++;
        }

        return NextResponse.json({ success: true, lifePlans, resumen });
    } catch (error) {
        console.error("Error fetching Life Plans:", error);
        return NextResponse.json({ success: false, error: "Error de lectura PAI" }, { status: 500 });
    }
}
