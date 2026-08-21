import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/api-auth';
import { CAMPANA_ACTIVA, CURSO_CAMPANA, diasRestantes, textoPlazo, FECHA_LIMITE_TEXTO } from '@/lib/campana-certificacion';

export const dynamic = 'force-dynamic';

/**
 * ¿A quien está mirando le falta el curso de la campaña?
 *
 * Lo consulta el aviso que vive en el marco de la app, así que responde para el
 * usuario de la sesión y nada más. Cuando ya lo aprobó, devuelve pendiente:false
 * y el aviso desaparece solo — nadie tiene que apagarlo a mano.
 */
export async function GET() {
    try {
        const auth = await requireSession();
        if (auth instanceof NextResponse) return auth;

        if (!CAMPANA_ACTIVA) return NextResponse.json({ success: true, pendiente: false });

        const curso = await prisma.course.findFirst({
            where: { headquartersId: auth.headquartersId, title: CURSO_CAMPANA, isActive: true },
            select: { id: true, title: true, durationMins: true },
        });
        if (!curso) return NextResponse.json({ success: true, pendiente: false });

        // Solo aplica a quien lo tiene asignado: el aviso no debe salirle a
        // quien nunca tuvo que tomarlo.
        const asignado = await prisma.academyAssignment.findFirst({
            where: { userId: auth.id, moduleCode: curso.id },
            select: { id: true },
        });
        if (!asignado) return NextResponse.json({ success: true, pendiente: false });

        const completado = await prisma.userCourse.findFirst({
            where: { employeeId: auth.id, courseId: curso.id, status: 'COMPLETED' },
            select: { id: true },
        });

        return NextResponse.json({
            success: true,
            pendiente: !completado,
            curso: { titulo: curso.title, minutos: curso.durationMins },
            dias: diasRestantes(),
            plazo: textoPlazo(),
            fechaLimite: FECHA_LIMITE_TEXTO,
        });
    } catch (error) {
        console.error('Error consultando certificación:', error);
        // El aviso es accesorio: si falla, la app sigue.
        return NextResponse.json({ success: true, pendiente: false });
    }
}
