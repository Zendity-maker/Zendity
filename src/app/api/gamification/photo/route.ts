import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { applyScoreEvent } from '@/lib/score-event';
import { requireRole } from '@/lib/api-auth';

const ALLOWED_ROLES = ['CAREGIVER', 'NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN'];

export async function POST(req: Request) {
    try {
        const auth = await requireRole(ALLOWED_ROLES);
        if (auth instanceof NextResponse) return auth;

        const body = await req.json();
        const { targetId, isStaff, base64Image } = body;
        // HIPAA — el autor sale de la sesión (antes authorId del body).
        const authorId = auth.id;

        if (!targetId || !base64Image) {
            return NextResponse.json({ success: false, error: 'Target ID y Base64 Image son requeridos.' }, { status: 400 });
        }

        // Determinar qué modelo Prisma editar (User o Patient) + tenant check
        if (isStaff) {
            const target = await prisma.user.findUnique({ where: { id: targetId }, select: { headquartersId: true } });
            if (!target || target.headquartersId !== auth.headquartersId) {
                return NextResponse.json({ success: false, error: 'Objetivo fuera de tu sede' }, { status: 403 });
            }
            // Actualizar la propia foto del usuario Staff
            await prisma.user.update({
                where: { id: targetId },
                data: { photoUrl: base64Image }
            });
        } else {
            const target = await prisma.patient.findUnique({ where: { id: targetId }, select: { headquartersId: true } });
            if (!target || target.headquartersId !== auth.headquartersId) {
                return NextResponse.json({ success: false, error: 'Residente fuera de tu sede' }, { status: 403 });
            }
            // Actualizar la foto del Residente
            await prisma.patient.update({
                where: { id: targetId },
                data: { photoUrl: base64Image }
            });
        }

        // Aplicar la lógica de Gamificación: Recompensar al autor (sesión)
        const photoUser = await prisma.user.findUnique({ where: { id: authorId }, select: { headquartersId: true, complianceScore: true } });
        const evt = await applyScoreEvent(authorId, photoUser?.headquartersId ?? auth.headquartersId, 3,
            'Foto de residente subida', 'PHOTO');

        return NextResponse.json({
            success: true,
            message: 'Imagen clarificada mediante Zendi AI y guardada en el perfil.',
            newScore: evt?.scoreAfter ?? (photoUser?.complianceScore ?? null)
        });

    } catch (error) {
        console.error("API Gamification Photo Error:", error);
        return NextResponse.json({ success: false, error: 'Fallo al procesar imagen en el servidor.' }, { status: 500 });
    }
}
