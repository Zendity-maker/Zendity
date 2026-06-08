import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { withPhiAccessLog } from '@/lib/phi-audit';
import { logError } from '@/lib/logger';

const SW_ALLOWED = ['SOCIAL_WORKER', 'DIRECTOR', 'ADMIN'];

async function postHandler(req: Request) {
    try {
        const auth = await requireRole(SW_ALLOWED);
        if (auth instanceof NextResponse) return auth;

        const { patientId, content, category } = await req.json();
        if (!patientId || !content) {
            return NextResponse.json({ success: false, error: 'patientId y content requeridos' }, { status: 400 });
        }

        // Tenant-scope: el patient DEBE pertenecer a la HQ del invoker.
        // Si no pertenece (o no existe), retornamos 404 — el caller nunca
        // sabe si fue cross-tenant o not-found, lo cual es deseable.
        const patient = await prisma.patient.findFirst({
            where: { id: patientId, headquartersId: auth.headquartersId },
            select: { id: true },
        });
        if (!patient) {
            return NextResponse.json({ success: false, error: 'Residente no encontrado' }, { status: 404 });
        }

        const note = await prisma.socialWorkNote.create({
            data: {
                patientId,
                headquartersId: auth.headquartersId,
                createdById: auth.id,
                content,
                category: category || 'GENERAL',
            },
            include: { createdBy: { select: { id: true, name: true, role: true } } },
        });

        return NextResponse.json({ success: true, note });
    } catch (error) {
        logError('social.notes.post', error);
        return NextResponse.json({ success: false, error: 'Error creando nota' }, { status: 500 });
    }
}

async function deleteHandler(req: Request) {
    try {
        const auth = await requireRole(SW_ALLOWED);
        if (auth instanceof NextResponse) return auth;

        const { noteId } = await req.json();
        if (!noteId) {
            return NextResponse.json({ success: false, error: 'noteId requerido' }, { status: 400 });
        }

        // Tenant-scope: cargar la nota CON filtro hqId. Si no es de la HQ
        // del invoker, no existe para él → 404. Cierra el vector de
        // cross-tenant DELETE por enumeración de noteIds.
        const note = await prisma.socialWorkNote.findFirst({
            where: { id: noteId, headquartersId: auth.headquartersId },
            select: { id: true, createdById: true },
        });
        if (!note) {
            return NextResponse.json({ success: false, error: 'Nota no encontrada' }, { status: 404 });
        }

        // Solo el creador o DIRECTOR/ADMIN pueden eliminar.
        if (note.createdById !== auth.id && auth.role !== 'DIRECTOR' && auth.role !== 'ADMIN') {
            return NextResponse.json({ success: false, error: 'Solo el autor o Director/Admin puede eliminar' }, { status: 403 });
        }

        await prisma.socialWorkNote.delete({ where: { id: noteId } });

        return NextResponse.json({ success: true });
    } catch (error) {
        logError('social.notes.delete', error);
        return NextResponse.json({ success: false, error: 'Error eliminando nota' }, { status: 500 });
    }
}

// PHI audit (HIPAA Pilar 1). El wrapper captura actor + IP + UA + path +
// success. patientId del wrapper queda null aquí (viene del body para POST
// y del lookup para DELETE) — el forensic join se hace via resourceType +
// timestamp + userId contra la tabla SocialWorkNote.
export const POST = withPhiAccessLog(postHandler, { resourceType: 'SocialWorkNote' });
export const DELETE = withPhiAccessLog(deleteHandler, { resourceType: 'SocialWorkNote' });
