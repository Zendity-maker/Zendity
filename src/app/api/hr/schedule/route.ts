import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const WRITE_ROLES = ['DIRECTOR', 'ADMIN', 'SUPERVISOR'];

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const hqId = searchParams.get('hqId');
    const weekStart = searchParams.get('weekStart');

    if (!hqId) return NextResponse.json({ success: false, error: 'hqId requerido' }, { status: 400 });

    try {
        const where: any = { headquartersId: hqId };
        if (weekStart) where.weekStartDate = new Date(weekStart);

        const schedules = await prisma.schedule.findMany({
            where,
            include: {
                shifts: {
                    include: {
                        user: { select: { id: true, name: true, role: true } },
                        colorAssignments: true
                    },
                    orderBy: [{ date: 'asc' }, { shiftType: 'asc' }]
                }
            },
            orderBy: { weekStartDate: 'desc' },
            take: 4
        });

        return NextResponse.json({ success: true, schedules });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ success: false, error: 'Error cargando horarios' }, { status: 500 });
    }
}

/**
 * POST — Crear o actualizar un Schedule de la semana.
 *
 * Contrato protegido:
 * - Si ya existe un DRAFT para esa semana y NO se envía overwrite=true:
 *   responde 409 con { existingDraftId, shiftCount } para que el cliente
 *   muestre un modal de confirmación antes de sobrescribir.
 * - Si se envía overwrite=true, se actualiza IN-PLACE (conserva el ID del
 *   Schedule, reemplaza solo los shifts). NO se hace delete+create.
 * - Nunca permite sobreescribir un PUBLISHED (debe hacerse /unpublish primero).
 */
export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });

        const invokerRole = (session.user as any).role;
        const invokerHqId = (session.user as any).headquartersId;
        if (!WRITE_ROLES.includes(invokerRole)) {
            return NextResponse.json({ success: false, error: 'Solo DIRECTOR, ADMIN o SUPERVISOR pueden editar horarios' }, { status: 403 });
        }

        const { hqId, weekStartDate, createdByUserId, shifts, overwrite } = await req.json();

        // Tenant check
        if (hqId !== invokerHqId) {
            return NextResponse.json({ success: false, error: 'Sede no coincide con tu sesión' }, { status: 403 });
        }

        const existing = await prisma.schedule.findFirst({
            where: { headquartersId: hqId, weekStartDate: new Date(weekStartDate) },
            include: { _count: { select: { shifts: true } } }
        });

        // Nunca sobreescribir un PUBLISHED desde aquí
        if (existing && existing.status === 'PUBLISHED') {
            return NextResponse.json({
                success: false,
                error: 'Ya existe un horario PUBLICADO para esa semana. Desbloquéalo primero con Editar horario publicado.',
                existingScheduleId: existing.id,
                status: 'PUBLISHED'
            }, { status: 409 });
        }

        // Si existe DRAFT y no se confirma sobrescritura, avisar
        if (existing && existing.status === 'DRAFT' && !overwrite) {
            return NextResponse.json({
                success: false,
                error: 'Ya existe un borrador para esa semana.',
                conflict: 'DRAFT_EXISTS',
                existingScheduleId: existing.id,
                shiftCount: existing._count.shifts,
                createdAt: existing.createdAt,
            }, { status: 409 });
        }

        // Si existe DRAFT y el cliente confirmó → actualización in-place (NO delete+create)
        if (existing && existing.status === 'DRAFT' && overwrite) {
            const updated = await prisma.$transaction(async (tx) => {
                await tx.scheduledShift.deleteMany({ where: { scheduleId: existing.id } });
                return tx.schedule.update({
                    where: { id: existing.id },
                    data: {
                        createdByUserId,
                        status: 'DRAFT',
                        shifts: {
                            create: shifts.map((s: any) => ({
                                userId: s.userId,
                                date: new Date(s.date),
                                shiftType: s.shiftType,
                                colorGroup: s.colorGroup || null,
                                notes: s.notes || null,
                                isManual: s.isManual || false,
                                customStartTime: s.customStartTime ? new Date(s.customStartTime) : null,
                                customEndTime: s.customEndTime ? new Date(s.customEndTime) : null,
                                customDescription: s.customDescription || null,
                            })),
                        },
                    },
                    include: { shifts: { include: { user: { select: { id: true, name: true, role: true } } } } }
                });
            });
            return NextResponse.json({ success: true, schedule: updated, overwritten: true });
        }

        // No existe nada para esa semana — crear nuevo
        const schedule = await prisma.schedule.create({
            data: {
                headquartersId: hqId,
                weekStartDate: new Date(weekStartDate),
                createdByUserId,
                status: 'DRAFT',
                shifts: {
                    create: shifts.map((s: any) => ({
                        userId: s.userId,
                        date: new Date(s.date),
                        shiftType: s.shiftType,
                        colorGroup: s.colorGroup || null,
                        notes: s.notes || null,
                        isManual: s.isManual || false,
                        customStartTime: s.customStartTime ? new Date(s.customStartTime) : null,
                        customEndTime: s.customEndTime ? new Date(s.customEndTime) : null,
                        customDescription: s.customDescription || null
                    }))
                }
            },
            include: { shifts: { include: { user: { select: { id: true, name: true, role: true } } } } }
        });

        return NextResponse.json({ success: true, schedule });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ success: false, error: 'Error creando horario' }, { status: 500 });
    }
}
