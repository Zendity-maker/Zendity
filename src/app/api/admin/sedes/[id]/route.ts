import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { requireSuperAdmin } from '@/lib/admin-auth';
import { normalizePlan, calculateMonthlyFee, BED_PRICE } from '@/lib/entitlements';
import { logAudit } from '@/lib/audit';
import { logError } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/admin/sedes/[id]
 *
 * Ciclo de vida COMERCIAL de una sede. Zendity Corp abre y cierra; el hogar
 * opera adentro. Aquí no se toca nada clínico.
 *
 * Acciones:
 *   SUSPEND        — corta el acceso por facturación (licenseActive=false).
 *   REACTIVATE     — restablece tras regularizar el pago.
 *   RENEW_LICENSE  — extiende el vencimiento N meses.
 *   CHANGE_CAPACITY— camas autorizadas por la licencia del Departamento de
 *       la Familia. Es el input de la tarifa ($12.49/cama), así que cambiarlo
 *       cambia lo que el hogar paga: se sincroniza el contrato SaaS.
 *   CHANGE_PLAN    — vestigio del modelo de planes. Se conserva por
 *       compatibilidad pero ya no altera precio ni acceso: Zendity es un solo
 *       producto completo.
 *   CLOSE          — cierra la sede (fin de contrato).
 *   RESET_DIRECTOR_PIN — el único caso de usuarios que es de Zendity: el
 *       titular no puede entrar a su propio sistema y solo Zendity lo destraba.
 *       El staff del hogar lo gestiona el Director desde /hr/staff.
 *
 * El enforcement de la suspensión vive en requireSession/requireRole
 * (api-auth.ts), que devuelve 402 a toda la API del hogar.
 *
 * Auth: SUPER_ADMIN.
 */

// RENAME y ASSIGN_OWNER agregadas el 03-sep-2026. El super admin solo tenia
// acciones comerciales: no habia forma de corregir el nombre de una sede desde
// aqui, y la unica pantalla que lo permitia era la del director. Mayaguez se
// creo como "Vivis Senior Living  Mayaguez" —con s y doble espacio— y no habia
// donde arreglarlo.
const ACTIONS = ['SUSPEND', 'REACTIVATE', 'RENEW_LICENSE', 'CHANGE_CAPACITY', 'CHANGE_PLAN', 'CLOSE', 'RESET_DIRECTOR_PIN', 'RENAME', 'ASSIGN_OWNER'] as const;
type Action = typeof ACTIONS[number];

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const guard = await requireSuperAdmin();
        if (!guard.ok) return guard.response;
        const invokerId = (guard.session.user as any).id as string;

        const { id } = await params;
        const body = await req.json().catch(() => ({}));
        const action = body.action as Action;

        if (!ACTIONS.includes(action)) {
            return NextResponse.json({ success: false, error: `action inválida. Válidas: ${ACTIONS.join(', ')}` }, { status: 400 });
        }

        const hq = await prisma.headquarters.findUnique({
            where: { id },
            select: {
                id: true, name: true, isActive: true, licenseActive: true,
                licenseExpiry: true, subscriptionPlan: true, subscriptionStatus: true,
                capacity: true,
            },
        });
        if (!hq) return NextResponse.json({ success: false, error: 'Sede no encontrada' }, { status: 404 });

        const before = { ...hq };
        let data: Record<string, unknown> = {};
        let resumen = '';

        switch (action) {
            case 'SUSPEND': {
                if (!hq.licenseActive) {
                    return NextResponse.json({ success: false, error: 'La sede ya está suspendida' }, { status: 409 });
                }
                data = { licenseActive: false, subscriptionStatus: 'SUSPENDED' };
                resumen = 'Suspendida por facturación';
                break;
            }
            case 'REACTIVATE': {
                // Reactivar con la licencia vencida dejaría la sede suspendida
                // igual (entitlements mira licenseExpiry): se exige renovar.
                if (hq.licenseExpiry && hq.licenseExpiry < new Date()) {
                    return NextResponse.json({
                        success: false,
                        error: 'La licencia está vencida. Usa RENEW_LICENSE antes de reactivar.',
                    }, { status: 409 });
                }
                data = { licenseActive: true, isActive: true, subscriptionStatus: 'ACTIVE' };
                resumen = 'Reactivada';
                break;
            }
            case 'RENEW_LICENSE': {
                const months = Number(body.months);
                if (!Number.isFinite(months) || months < 1 || months > 60) {
                    return NextResponse.json({ success: false, error: 'months debe estar entre 1 y 60' }, { status: 400 });
                }
                // Se extiende desde HOY si ya venció, o desde el vencimiento
                // vigente si aún corre — para no regalar ni quitar tiempo.
                const base = hq.licenseExpiry && hq.licenseExpiry > new Date() ? hq.licenseExpiry : new Date();
                const next = new Date(base);
                next.setMonth(next.getMonth() + months);
                data = { licenseExpiry: next, licenseActive: true, subscriptionStatus: 'ACTIVE' };
                resumen = `Licencia renovada ${months} mes(es) → ${next.toISOString().slice(0, 10)}`;
                break;
            }
            case 'CHANGE_CAPACITY': {
                const capacity = Number(body.capacity);
                if (!Number.isInteger(capacity) || capacity < 1 || capacity > 500) {
                    return NextResponse.json({ success: false, error: 'capacity debe ser un entero entre 1 y 500' }, { status: 400 });
                }
                data = { capacity };
                const despues = calculateMonthlyFee(capacity);
                // Se admite recibir la MISMA capacidad: el caso frecuente no es
                // cambiarla sino alinear un contrato viejo (Cupey: 50 camas
                // autorizadas con contrato por 35). El resumen distingue ambos
                // para que la auditoría no diga "50 → 50".
                const contratoPrevio = await prisma.saaSContract.findUnique({
                    where: { headquartersId: id },
                    select: { beds: true, monthlyAmount: true },
                });
                resumen = capacity !== hq.capacity
                    ? `Capacidad ${hq.capacity} → ${capacity} camas ($${calculateMonthlyFee(hq.capacity)} → $${despues}/mes)`
                    : `Contrato alineado a ${capacity} camas ($${contratoPrevio?.monthlyAmount ?? 0} → $${despues}/mes)`;

                // El contrato SaaS es la fuente de la facturación: dejarlo con
                // la capacidad vieja haría que el hogar pague por camas que ya
                // no tiene autorizadas (o al revés).
                await prisma.saaSContract.updateMany({
                    where: { headquartersId: id },
                    data: { beds: capacity, pricePerBed: BED_PRICE, monthlyAmount: despues },
                });
                break;
            }
            case 'CHANGE_PLAN': {
                const plan = normalizePlan(body.plan);
                if (!plan) {
                    return NextResponse.json({ success: false, error: `Plan no reconocido: "${body.plan}". Usa Esencial, Profesional o Corporativo.` }, { status: 400 });
                }
                data = { subscriptionPlan: plan };
                resumen = `Plan ${hq.subscriptionPlan} → ${plan}`;
                break;
            }
            case 'CLOSE': {
                data = { isActive: false, licenseActive: false, subscriptionStatus: 'CANCELED' };
                resumen = 'Sede cerrada (fin de contrato)';
                break;
            }
            case 'RENAME': {
                const nuevo = String(body.name ?? '').replace(/\s+/g, ' ').trim();
                if (nuevo.length < 3) {
                    return NextResponse.json({ success: false, error: 'El nombre debe tener al menos 3 caracteres' }, { status: 400 });
                }
                // Se normalizan los espacios repetidos: "Vivid  Mayaguez" quedaria
                // con doble espacio invisible en pantalla y en cada correo.
                data = { name: nuevo };
                resumen = `Renombrada de "${hq.name}" a "${nuevo}"`;
                break;
            }
            case 'ASSIGN_OWNER': {
                // Dueño operativo: agrupa varias sedes bajo un mismo DIRECTOR.
                // Es lo que decide que sedes ve en su panel. null lo desasigna.
                const ownerId = body.ownerId ? String(body.ownerId) : null;
                if (ownerId) {
                    const u = await prisma.user.findUnique({
                        where: { id: ownerId },
                        select: { id: true, name: true, role: true },
                    });
                    if (!u) {
                        return NextResponse.json({ success: false, error: 'Usuario no encontrado' }, { status: 404 });
                    }
                    if (!['DIRECTOR', 'ADMIN'].includes(u.role)) {
                        return NextResponse.json({ success: false, error: 'El dueño de una sede debe ser DIRECTOR o ADMIN' }, { status: 400 });
                    }
                    data = { ownerId };
                    resumen = `Dueño asignado: ${u.name ?? ownerId}`;
                } else {
                    data = { ownerId: null };
                    resumen = 'Dueño removido';
                }
                break;
            }
            case 'RESET_DIRECTOR_PIN': {
                const pin = String(body.pinCode ?? '').trim();
                if (!/^\d{4,6}$/.test(pin)) {
                    return NextResponse.json({ success: false, error: 'pinCode debe ser de 4 a 6 dígitos' }, { status: 400 });
                }
                const director = await prisma.user.findFirst({
                    where: { headquartersId: id, role: 'DIRECTOR', isDeleted: false },
                    orderBy: { createdAt: 'asc' },
                    select: { id: true, name: true, email: true },
                });
                if (!director) {
                    return NextResponse.json({ success: false, error: 'Esta sede no tiene un Director registrado' }, { status: 404 });
                }
                await prisma.user.update({
                    where: { id: director.id },
                    data: { pinCode: await bcrypt.hash(pin, 10), isActive: true },
                });
                await logAudit({
                    headquartersId: id,
                    performedById: invokerId,
                    action: 'STATE_CHANGED',
                    entityName: 'HeadquartersLifecycle',
                    entityId: id,
                    resourceName: `${hq.name} — PIN de Director restablecido`,
                    // Jamás el PIN, ni siquiera parcial.
                    payloadChanges: { action, directorEmail: director.email },
                    request: req,
                });
                return NextResponse.json({
                    success: true,
                    action,
                    message: `PIN restablecido para ${director.name} (${director.email}). Comunícaselo por un canal seguro.`,
                });
            }
        }

        const updated = await prisma.headquarters.update({
            where: { id },
            data,
            select: {
                id: true, name: true, isActive: true, licenseActive: true,
                licenseExpiry: true, subscriptionPlan: true, subscriptionStatus: true,
            },
        });

        await logAudit({
            headquartersId: id,
            performedById: invokerId,
            action: 'STATE_CHANGED',
            entityName: 'HeadquartersLifecycle',
            entityId: id,
            resourceName: `${hq.name} — ${resumen}`,
            payloadChanges: { action, before, after: updated },
            request: req,
        });

        return NextResponse.json({ success: true, action, message: resumen, hq: updated });
    } catch (err: any) {
        logError('admin.sedes.patch', err);
        return NextResponse.json({ success: false, error: err.message || 'Error actualizando la sede' }, { status: 500 });
    }
}
