import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const MULTI_HQ_ROLES = ['DIRECTOR', 'ADMIN'];

async function requireMultiHqRole() {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return { error: NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 }) };
    }
    const role = (session.user as any).role;
    if (!MULTI_HQ_ROLES.includes(role)) {
        return { error: NextResponse.json({ success: false, error: 'Rol no autorizado' }, { status: 403 }) };
    }
    return { session, role };
}

/**
 * GET /api/corporate/headquarters
 * Lista todas las sedes con datos básicos + CRM + conteos.
 * Auth: DIRECTOR, ADMIN
 */
export async function GET(_req: NextRequest) {
    try {
        const auth = await requireMultiHqRole();
        if ('error' in auth) return auth.error;

        const headquarters = await prisma.headquarters.findMany({
            orderBy: { name: 'asc' },
            select: {
                id: true,
                name: true,
                capacity: true,
                isActive: true,
                licenseActive: true,
                licenseExpiry: true,
                ownerName: true,
                ownerEmail: true,
                ownerPhone: true,
                taxId: true,
                subscriptionPlan: true,
                subscriptionStatus: true,
                _count: {
                    select: {
                        patients: { where: { status: 'ACTIVE' } } as any,
                        users: { where: { isActive: true, isDeleted: false } } as any,
                    },
                },
            },
        });

        return NextResponse.json({ success: true, headquarters });
    } catch (error: any) {
        console.error('[corporate/headquarters GET]', error);
        return NextResponse.json({ success: false, error: error.message || 'Error' }, { status: 500 });
    }
}

/**
 * POST /api/corporate/headquarters
 * Crear nueva sede.
 * Body: { name, capacity, licenseExpiry, ownerName?, ownerEmail?, ownerPhone?, taxId?, subscriptionPlan? }
 * Auth: DIRECTOR, ADMIN
 */
export async function POST(req: NextRequest) {
    try {
        const auth = await requireMultiHqRole();
        if ('error' in auth) return auth.error;

        const body = await req.json();

        if (!body.name || !body.capacity || !body.licenseExpiry) {
            return NextResponse.json(
                { success: false, error: 'Faltan campos obligatorios: nombre, capacidad, vencimiento de licencia' },
                { status: 400 }
            );
        }

        const capacityInt = parseInt(String(body.capacity), 10);
        if (isNaN(capacityInt) || capacityInt < 1) {
            return NextResponse.json({ success: false, error: 'Capacidad inválida' }, { status: 400 });
        }

        const expiryDate = new Date(body.licenseExpiry);
        if (isNaN(expiryDate.getTime())) {
            return NextResponse.json({ success: false, error: 'Fecha de licencia inválida' }, { status: 400 });
        }

        const VALID_PLANS = ['LITE', 'PRO', 'ENTERPRISE', 'BASIC', 'PROFESSIONAL'];
        const plan = body.subscriptionPlan && VALID_PLANS.includes(body.subscriptionPlan)
            ? body.subscriptionPlan
            : 'PRO';

        const hq = await prisma.headquarters.create({
            data: {
                name: String(body.name).trim(),
                capacity: capacityInt,
                licenseExpiry: expiryDate,
                licenseActive: true,
                isActive: true,
                ownerName: body.ownerName || null,
                ownerEmail: body.ownerEmail || null,
                ownerPhone: body.ownerPhone || null,
                taxId: body.taxId || null,
                subscriptionPlan: plan,
                subscriptionStatus: 'ACTIVE',
            },
        });

        return NextResponse.json({ success: true, headquarters: hq });
    } catch (error: any) {
        console.error('[corporate/headquarters POST]', error);
        return NextResponse.json({ success: false, error: error.message || 'Error' }, { status: 500 });
    }
}

/**
 * PATCH /api/corporate/headquarters
 * Editar sede existente.
 * Body: { id, ...campos }
 * Auth: DIRECTOR, ADMIN
 */
export async function PATCH(req: NextRequest) {
    try {
        const auth = await requireMultiHqRole();
        if ('error' in auth) return auth.error;

        const body = await req.json();
        if (!body.id) {
            return NextResponse.json({ success: false, error: 'Falta id de sede' }, { status: 400 });
        }

        const existing = await prisma.headquarters.findUnique({ where: { id: body.id } });
        if (!existing) {
            return NextResponse.json({ success: false, error: 'Sede no encontrada' }, { status: 404 });
        }

        const data: any = {};

        if (typeof body.name === 'string' && body.name.trim().length > 0) {
            data.name = body.name.trim();
        }
        if (body.capacity !== undefined) {
            const c = parseInt(String(body.capacity), 10);
            if (isNaN(c) || c < 1) {
                return NextResponse.json({ success: false, error: 'Capacidad inválida' }, { status: 400 });
            }
            data.capacity = c;
        }
        if (body.licenseExpiry) {
            const d = new Date(body.licenseExpiry);
            if (isNaN(d.getTime())) {
                return NextResponse.json({ success: false, error: 'Fecha de licencia inválida' }, { status: 400 });
            }
            data.licenseExpiry = d;
        }
        if (typeof body.licenseActive === 'boolean') data.licenseActive = body.licenseActive;
        if (typeof body.isActive === 'boolean') data.isActive = body.isActive;
        if (body.ownerName !== undefined) data.ownerName = body.ownerName || null;
        if (body.ownerEmail !== undefined) data.ownerEmail = body.ownerEmail || null;
        if (body.ownerPhone !== undefined) data.ownerPhone = body.ownerPhone || null;
        if (body.taxId !== undefined) data.taxId = body.taxId || null;
        if (body.subscriptionPlan) {
            const VALID_PLANS = ['LITE', 'PRO', 'ENTERPRISE', 'BASIC', 'PROFESSIONAL'];
            if (VALID_PLANS.includes(body.subscriptionPlan)) {
                data.subscriptionPlan = body.subscriptionPlan;
            }
        }

        const updated = await prisma.headquarters.update({
            where: { id: body.id },
            data,
        });

        return NextResponse.json({ success: true, headquarters: updated });
    } catch (error: any) {
        console.error('[corporate/headquarters PATCH]', error);
        return NextResponse.json({ success: false, error: error.message || 'Error' }, { status: 500 });
    }
}
