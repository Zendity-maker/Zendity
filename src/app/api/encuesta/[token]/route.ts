import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET/POST /api/encuesta/[token] — PÚBLICO, sin sesión.
 *
 * La familia responde desde el enlace que le llegó por correo. Sin sesión
 * porque de 19 familiares solo 15 completaron su acceso al portal: exigir
 * login renuncia de entrada a cuatro respuestas.
 *
 * El token es la credencial y es de un solo uso efectivo: una vez respondida,
 * la encuesta no se puede volver a contestar.
 */
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
    try {
        const { token } = await params;
        const s = await prisma.familySurvey.findUnique({
            where: { token },
            select: {
                respondedAt: true, periodo: true, headquartersId: true,
                familyMember: { select: { name: true, patient: { select: { name: true } } } },
                headquarters: { select: { name: true } },
            },
        });
        if (!s) return NextResponse.json({ success: true, valido: false }, { status: 200 });

        // Las cuidadoras de la sede, para que la familia pueda destacar a
        // alguien por su nombre. Se manda solo nombre e id: nada mas de la
        // ficha del empleado sale a una pagina publica.
        const cuidadoras = await prisma.user.findMany({
            where: {
                headquartersId: s.headquartersId,
                isActive: true, isDeleted: false,
                role: { in: ['CAREGIVER', 'NURSE', 'SUPERVISOR'] },
            },
            select: { id: true, name: true },
            orderBy: { name: 'asc' },
        });

        return NextResponse.json({
            success: true,
            valido: true,
            yaRespondida: s.respondedAt !== null,
            familiar: s.familyMember.name.trim(),
            residente: s.familyMember.patient.name.trim(),
            sede: s.headquarters.name,
            periodo: s.periodo,
            cuidadoras: cuidadoras.map(c => ({ id: c.id, nombre: c.name.trim() })),
        });
    } catch (e: any) {
        console.error('[encuesta GET]', e);
        return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 });
    }
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
    try {
        const { token } = await params;
        const {
            cuidado, limpieza, salud, comentario,
            comentarioCuidado, comentarioLimpieza, comentarioSalud,
            cuidadorFavoritoId,
        } = await req.json();

        const valido = (n: any) => Number.isInteger(n) && n >= 1 && n <= 5;
        if (![cuidado, limpieza, salud].every(valido)) {
            return NextResponse.json(
                { success: false, error: 'Falta puntuar alguna de las tres preguntas.' },
                { status: 400 },
            );
        }

        const existente = await prisma.familySurvey.findUnique({
            where: { token },
            select: { id: true, respondedAt: true, headquartersId: true },
        });
        if (!existente) {
            return NextResponse.json({ success: false, error: 'Enlace no válido.' }, { status: 404 });
        }
        if (existente.respondedAt) {
            return NextResponse.json(
                { success: false, error: 'Esta encuesta ya fue respondida. Gracias.' },
                { status: 409 },
            );
        }

        // El favorito se valida contra la sede: un id cualquiera no puede
        // colarse desde una pagina publica.
        let favorito: string | null = null;
        if (cuidadorFavoritoId) {
            const c = await prisma.user.findFirst({
                where: {
                    id: cuidadorFavoritoId,
                    headquartersId: existente.headquartersId,
                    isActive: true,
                    role: { in: ['CAREGIVER', 'NURSE', 'SUPERVISOR'] },
                },
                select: { id: true },
            });
            favorito = c?.id ?? null;
        }

        const texto = (v: any) => (v || '').toString().trim().slice(0, 2000) || null;

        await prisma.familySurvey.update({
            where: { id: existente.id },
            data: {
                ratingCare: cuidado,
                ratingClean: limpieza,
                ratingHealth: salud,
                // El texto es opcional pero es donde esta el valor: tres
                // estrellas dicen que algo va mal, solo el comentario dice que.
                comentarioCuidado: texto(comentarioCuidado),
                comentarioLimpieza: texto(comentarioLimpieza),
                comentarioSalud: texto(comentarioSalud),
                comentario: texto(comentario),
                cuidadorFavoritoId: favorito,
                respondedAt: new Date(),
            },
        });

        return NextResponse.json({ success: true });
    } catch (e: any) {
        console.error('[encuesta POST]', e);
        return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 });
    }
}
