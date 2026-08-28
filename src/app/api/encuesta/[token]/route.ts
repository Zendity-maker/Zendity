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
                respondedAt: true, periodo: true,
                familyMember: { select: { name: true, patient: { select: { name: true } } } },
                headquarters: { select: { name: true } },
            },
        });
        if (!s) return NextResponse.json({ success: true, valido: false }, { status: 200 });

        return NextResponse.json({
            success: true,
            valido: true,
            yaRespondida: s.respondedAt !== null,
            familiar: s.familyMember.name.trim(),
            residente: s.familyMember.patient.name.trim(),
            sede: s.headquarters.name,
            periodo: s.periodo,
        });
    } catch (e: any) {
        console.error('[encuesta GET]', e);
        return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 });
    }
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
    try {
        const { token } = await params;
        const { cuidado, limpieza, salud, comentario } = await req.json();

        const valido = (n: any) => Number.isInteger(n) && n >= 1 && n <= 5;
        if (![cuidado, limpieza, salud].every(valido)) {
            return NextResponse.json(
                { success: false, error: 'Falta puntuar alguna de las tres preguntas.' },
                { status: 400 },
            );
        }

        const existente = await prisma.familySurvey.findUnique({
            where: { token },
            select: { id: true, respondedAt: true },
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

        await prisma.familySurvey.update({
            where: { id: existente.id },
            data: {
                ratingCare: cuidado,
                ratingClean: limpieza,
                ratingHealth: salud,
                // El texto es opcional pero es donde esta el valor: tres
                // estrellas dicen que algo va mal, solo el comentario dice que.
                comentario: (comentario || '').trim().slice(0, 2000) || null,
                respondedAt: new Date(),
            },
        });

        return NextResponse.json({ success: true });
    } catch (e: any) {
        console.error('[encuesta POST]', e);
        return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 });
    }
}
