import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { normalizePlan } from '@/lib/entitlements';
import { requireSuperAdmin } from '@/lib/admin-auth';
import { ENROLLED_PATIENT_STATUSES } from '@/lib/billable-residents';

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
                        // Matrícula, no ocupación del turno: incluye a los que
                        // están hospitalizados o de permiso.
                        patients: { where: { status: { in: ENROLLED_PATIENT_STATUSES } } } as any,
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
 *
 * Auth: SUPER_ADMIN ÚNICAMENTE (cambiado 17-ago-2026).
 *
 * Antes: DIRECTOR/ADMIN. Eso permitía que un operador cliente se
 * auto-provisionara sedes con `licenseActive: true` y el plan que eligiera —
 * saltándose a Zendity y a facturación. Crear una sede es una acción
 * COMERCIAL (vender una licencia), no operacional.
 *
 * El alta de sedes vive en /admin/sedes. Este endpoint conserva el POST solo
 * para no romper integraciones existentes, pero con el rol correcto.
 * DIRECTOR/ADMIN mantienen GET y PATCH sobre SUS sedes: renombrar, cambiar
 * capacidad o logo sí es operacional.
 */
export async function POST(req: NextRequest) {
    try {
        const guard = await requireSuperAdmin();
        if (!guard.ok) return guard.response;

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

        // Acepta nombres comerciales (Esencial/Profesional/Corporativo) o
        // códigos internos (LITE/PRO/ENTERPRISE). Cualquier otro valor → 400.
        const planInput = body.subscriptionPlan ?? 'PRO';
        const plan = normalizePlan(planInput);
        if (!plan) {
            return NextResponse.json({
                success: false,
                error: `Plan no reconocido: "${planInput}". Usa Esencial, Profesional o Corporativo.`
            }, { status: 400 });
        }

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

        // CAMPOS OPERACIONALES — el hogar administra los suyos.
        if (typeof body.name === 'string' && body.name.trim().length > 0) {
            data.name = body.name.trim();
        }
        if (body.ownerName !== undefined) data.ownerName = body.ownerName || null;
        if (body.ownerEmail !== undefined) data.ownerEmail = body.ownerEmail || null;
        if (body.ownerPhone !== undefined) data.ownerPhone = body.ownerPhone || null;
        if (body.taxId !== undefined) data.taxId = body.taxId || null;

        // CAMPOS COMERCIALES — solo Zendity (17-ago-2026).
        //
        // Antes este PATCH aceptaba capacity, licenseActive, licenseExpiry,
        // isActive y subscriptionPlan con rol DIRECTOR/ADMIN, y la UI de
        // /corporate/sedes los enviaba en cada guardado. Un director podía
        // extenderse la licencia, reactivarse tras una suspensión por falta de
        // pago —anulando el corte— o cambiarse de plan.
        //
        // `capacity` entra a esta lista porque desde el modelo de tarifa por
        // cama ES el input de facturación, y además refleja la licencia del
        // Departamento de la Familia: un dato regulatorio, no una preferencia.
        //
        // Todo esto se gestiona en /admin → Sedes, donde queda auditado.
        const comerciales = ['capacity', 'licenseActive', 'licenseExpiry', 'isActive', 'subscriptionPlan']
            .filter(k => body[k] !== undefined);
        if (comerciales.length > 0) {
            return NextResponse.json({
                success: false,
                error: `Estos datos los gestiona Zendity: ${comerciales.join(', ')}. Comunícate con nosotros para modificarlos.`,
            }, { status: 403 });
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
