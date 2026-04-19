import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSuperAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

const ALLOWED_FIELDS = new Set([
    'stage',
    'notes',
    'nextFollowUp',
    'lastContactAt',
    'planInterest',
    'estimatedBeds',
    'assignedToId',
    'priority',
    'phone',
    'email',
    'contactName',
]);

/**
 * PATCH /api/admin/prospects/[id] — actualizar campos del pipeline.
 * Solo SUPER_ADMIN. Whitelist de campos para blindar contra mass-assignment.
 */
export async function PATCH(req: Request, context: any) {
    const guard = await requireSuperAdmin();
    if (!guard.ok) return guard.response;

    try {
        const { id } = await context.params;
        if (!id) return NextResponse.json({ success: false, error: 'id requerido' }, { status: 400 });

        const body = await req.json();
        const data: Record<string, any> = {};

        for (const [key, val] of Object.entries(body)) {
            if (!ALLOWED_FIELDS.has(key)) continue;
            if (key === 'nextFollowUp' || key === 'lastContactAt') {
                data[key] = val ? new Date(val as string) : null;
            } else if (key === 'estimatedBeds') {
                data[key] = val == null || val === '' ? null : Number(val);
            } else {
                data[key] = val === '' ? null : val;
            }
        }

        // Si cambia stage a CONTACTADO o posterior, auto-setea lastContactAt
        if (data.stage && data.stage !== 'PROSPECTO' && data.lastContactAt === undefined) {
            data.lastContactAt = new Date();
        }

        const updated = await prisma.saaSProspect.update({
            where: { id },
            data,
            include: { assignedTo: { select: { id: true, name: true, email: true } } },
        });

        return NextResponse.json({ success: true, prospect: updated });
    } catch (e: any) {
        console.error('[/api/admin/prospects/[id] PATCH]', e);
        if (e.code === 'P2025') {
            return NextResponse.json({ success: false, error: 'Prospecto no encontrado' }, { status: 404 });
        }
        return NextResponse.json({ success: false, error: 'Error actualizando prospecto' }, { status: 500 });
    }
}

/**
 * DELETE /api/admin/prospects/[id] — eliminar prospecto perdido/duplicado.
 */
export async function DELETE(_req: Request, context: any) {
    const guard = await requireSuperAdmin();
    if (!guard.ok) return guard.response;

    try {
        const { id } = await context.params;
        if (!id) return NextResponse.json({ success: false, error: 'id requerido' }, { status: 400 });
        await prisma.saaSProspect.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (e: any) {
        if (e.code === 'P2025') {
            return NextResponse.json({ success: false, error: 'Prospecto no encontrado' }, { status: 404 });
        }
        return NextResponse.json({ success: false, error: 'Error eliminando prospecto' }, { status: 500 });
    }
}
