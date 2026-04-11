import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const ALLOWED_ROLES_CREATE = ['SOCIAL_WORKER', 'DIRECTOR', 'ADMIN'];
const ALLOWED_ROLES_DELETE = ['SOCIAL_WORKER', 'DIRECTOR'];

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !ALLOWED_ROLES_CREATE.includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const { patientId, content, category } = await req.json();

        if (!patientId || !content) {
            return NextResponse.json({ success: false, error: 'patientId y content requeridos' }, { status: 400 });
        }

        const note = await prisma.socialWorkNote.create({
            data: {
                patientId,
                headquartersId: (session.user as any).headquartersId,
                createdById: session.user.id,
                content,
                category: category || 'GENERAL',
            },
            include: { createdBy: { select: { id: true, name: true, role: true } } },
        });

        return NextResponse.json({ success: true, note });
    } catch (error) {
        console.error('Social Notes POST Error:', error);
        return NextResponse.json({ success: false, error: 'Error creando nota' }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !ALLOWED_ROLES_DELETE.includes((session.user as any).role)) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const { noteId } = await req.json();
        if (!noteId) {
            return NextResponse.json({ success: false, error: 'noteId requerido' }, { status: 400 });
        }

        const note = await prisma.socialWorkNote.findUnique({ where: { id: noteId } });
        if (!note) {
            return NextResponse.json({ success: false, error: 'Nota no encontrada' }, { status: 404 });
        }

        // Solo el creador o DIRECTOR puede eliminar
        const userRole = (session.user as any).role;
        if (note.createdById !== session.user.id && userRole !== 'DIRECTOR') {
            return NextResponse.json({ success: false, error: 'Solo el autor o Director puede eliminar' }, { status: 403 });
        }

        await prisma.socialWorkNote.delete({ where: { id: noteId } });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Social Notes DELETE Error:', error);
        return NextResponse.json({ success: false, error: 'Error eliminando nota' }, { status: 500 });
    }
}
