import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';



export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { targetId, isStaff, base64Image, authorId } = body;

        if (!targetId || !base64Image || !authorId) {
            return NextResponse.json({ success: false, error: 'Target ID, Author ID, y Base64 Image son requeridos.' }, { status: 400 });
        }

        // Determinar qué modelo Prisma editar (User o Patient)
        if (isStaff) {
            // Actualizar la propia foto del usuario Staff
            await prisma.user.update({
                where: { id: targetId },
                data: { photoUrl: base64Image }
            });
        } else {
            // Actualizar la foto del Residente
            await prisma.patient.update({
                where: { id: targetId },
                data: { photoUrl: base64Image }
            });
        }

        // Aplicar la lógica de Gamificación: Recompensar al autor de la foto (el Cuidador o Enfermero)
        const updatedAuthor = await prisma.user.update({
            where: { id: authorId },
            data: { complianceScore: { increment: 3 } }
        });

        return NextResponse.json({
            success: true,
            message: 'Imagen clarificada mediante Zendi AI y guardada en el perfil.',
            newScore: updatedAuthor.complianceScore
        });

    } catch (error) {
        console.error("API Gamification Photo Error:", error);
        return NextResponse.json({ success: false, error: 'Fallo al procesar imagen en el servidor.' }, { status: 500 });
    }
}
