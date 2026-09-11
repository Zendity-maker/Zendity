/**
 * EL CONTENIDO DE UN SOLO CURSO.
 *
 * Existe porque el catálogo mandaba los cursos ENTEROS. Medido el 11-sep-2026
 * contra producción: abrir Academy en la tableta descargaba **431 KB** para una
 * cuidadora, de los cuales 420 eran el markdown de veinte cursos que no va a
 * abrir. Sin el contenido, la misma pantalla son 11 KB.
 *
 * El texto de un curso hace falta en un solo momento —cuando alguien pulsa
 * "Comenzar"— y son 24 KB. Se pide entonces.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';

const ALLOWED_ROLES = [
    'DIRECTOR', 'ADMIN', 'SUPERVISOR', 'NURSE', 'CAREGIVER',
    'KITCHEN', 'MAINTENANCE', 'CLEANING', 'SOCIAL_WORKER', 'COORDINATOR',
] as const;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const auth = await requireRole([...ALLOWED_ROLES]);
        if (auth instanceof NextResponse) return auth;

        const { id } = await params;

        // El filtro por sede no es decorativo: sin él, alguien con el id de un
        // curso de otra sede se lo lleva. Los ids de los cursos sembrados son
        // predecibles (`<hqId>__CUIDADOR_101`), así que adivinarlos es trivial.
        const curso = await prisma.course.findFirst({
            where: { id, isActive: true, headquartersId: auth.headquartersId },
            select: { id: true, title: true, content: true },
        });

        if (!curso) {
            return NextResponse.json({ success: false, error: 'Curso no encontrado' }, { status: 404 });
        }
        return NextResponse.json({ success: true, curso });
    } catch (error) {
        console.error('academy.curso.get', error);
        return NextResponse.json({ success: false, error: 'Fallo leyendo el curso' }, { status: 500 });
    }
}
