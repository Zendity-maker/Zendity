/**
 * src/lib/entitlements.ts
 * ──────────────────────────────────────────────────────────────────
 * Capa de control de acceso basada en plan de suscripción (SaaSContract).
 *
 * USO EN API ROUTES:
 *   const ent = await getEntitlements(hqId);
 *   if (!ent.hasFeature('ACADEMY')) return unauthorized('Plan no incluye Academy');
 *
 * USO EN SERVER COMPONENTS / LAYOUTS:
 *   const ent = await getEntitlements(hqId);
 *   if (ent.suspended) redirect('/suspended');
 *
 * PLANES:
 *   LITE       → eMAR básico, handovers, vitales, portal familiar, schedule
 *   PRO        → + Academy, Triage, Analytics, Schedule Builder avanzado
 *   ENTERPRISE → + AI Briefing, Family App, reportes avanzados, multi-sede
 */

import { prisma } from '@/lib/prisma';

// ── Feature keys disponibles en la plataforma ────────────────────
export type Feature =
    | 'EMAR'               // Administración de medicamentos
    | 'HANDOVERS'          // Reportes de cierre de turno
    | 'VITALS'             // Registro de signos vitales
    | 'FAMILY_PORTAL'      // Acceso del portal familiar
    | 'SCHEDULE'           // Constructor de horarios básico
    | 'TRIAGE'             // Centro de triage e incidentes
    | 'ACADEMY'            // Cursos y certificaciones
    | 'ANALYTICS'          // Dashboard de tendencias y KPIs
    | 'SCHEDULE_ADVANCED'  // Schedule Builder con redistribución y colores
    | 'AI_BRIEFING'        // Zendi Director Briefing (GPT-4o)
    | 'FAMILY_CHAT'        // Mensajería bidireccional familia ↔ staff
    | 'MULTI_HQ'           // Acceso a múltiples sedes
    | 'CUSTOM_REPORTS'     // Reportes exportables y auditoría HIPAA avanzada
    | 'IMPERSONATION';     // Soporte remoto con impersonation (solo Zéndity)

// ── Matriz de features por plan ───────────────────────────────────
const PLAN_FEATURES: Record<string, Feature[]> = {
    LITE: [
        'EMAR', 'HANDOVERS', 'VITALS', 'FAMILY_PORTAL', 'SCHEDULE',
    ],
    PRO: [
        'EMAR', 'HANDOVERS', 'VITALS', 'FAMILY_PORTAL', 'SCHEDULE',
        'TRIAGE', 'ACADEMY', 'ANALYTICS', 'SCHEDULE_ADVANCED', 'FAMILY_CHAT',
    ],
    ENTERPRISE: [
        'EMAR', 'HANDOVERS', 'VITALS', 'FAMILY_PORTAL', 'SCHEDULE',
        'TRIAGE', 'ACADEMY', 'ANALYTICS', 'SCHEDULE_ADVANCED', 'FAMILY_CHAT',
        'AI_BRIEFING', 'MULTI_HQ', 'CUSTOM_REPORTS', 'IMPERSONATION',
    ],
};

// ── Resultado de entitlements para una sede ───────────────────────
export interface Entitlements {
    hqId: string;
    plan: string;
    isActive: boolean;
    licenseActive: boolean;
    licenseExpiry: Date | null;
    suspended: boolean;          // true si la licencia expiró o está inactiva
    features: Feature[];
    hasFeature: (f: Feature) => boolean;
}

// ── Cache en memoria liviana (30 segundos) para evitar N+1 en polling ──
const cache = new Map<string, { data: Entitlements; ts: number }>();
const CACHE_TTL_MS = 30_000;

/**
 * Obtiene los entitlements de una sede.
 * Cachea por 30 segundos para no golpear la DB en cada request.
 */
export async function getEntitlements(hqId: string): Promise<Entitlements> {
    const cached = cache.get(hqId);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
        return cached.data;
    }

    const hq = await prisma.headquarters.findUnique({
        where: { id: hqId },
        select: {
            id: true,
            isActive: true,
            licenseActive: true,
            licenseExpiry: true,
            subscriptionPlan: true,
            subscriptionStatus: true,
        },
    });

    // Si no existe la sede → acceso denegado total
    if (!hq) {
        const empty = buildEntitlements(hqId, 'LITE', false, false, null, 'SUSPENDED');
        return empty;
    }

    const plan = hq.subscriptionPlan || 'LITE';
    const suspended =
        !hq.isActive ||
        !hq.licenseActive ||
        hq.subscriptionStatus === 'SUSPENDED' ||
        hq.subscriptionStatus === 'CANCELED' ||
        (hq.licenseExpiry !== null && hq.licenseExpiry < new Date());

    const result = buildEntitlements(
        hqId,
        plan,
        hq.isActive,
        hq.licenseActive,
        hq.licenseExpiry,
        hq.subscriptionStatus,
    );

    cache.set(hqId, { data: result, ts: Date.now() });
    return result;
}

/** Invalida el cache de una sede (llamar al actualizar contrato desde /admin) */
export function invalidateEntitlementCache(hqId: string) {
    cache.delete(hqId);
}

function buildEntitlements(
    hqId: string,
    plan: string,
    isActive: boolean,
    licenseActive: boolean,
    licenseExpiry: Date | null,
    subscriptionStatus: string,
): Entitlements {
    const suspended =
        !isActive ||
        !licenseActive ||
        subscriptionStatus === 'SUSPENDED' ||
        subscriptionStatus === 'CANCELED' ||
        (licenseExpiry !== null && licenseExpiry < new Date());

    const features: Feature[] = suspended ? [] : (PLAN_FEATURES[plan] ?? PLAN_FEATURES.LITE);

    return {
        hqId,
        plan,
        isActive,
        licenseActive,
        licenseExpiry,
        suspended,
        features,
        hasFeature: (f: Feature) => features.includes(f),
    };
}

/**
 * Helper para API routes: retorna un NextResponse 403 si el HQ no tiene
 * la feature requerida. Listo para usar con early-return.
 *
 * Ejemplo:
 *   const block = await requireFeature(hqId, 'ACADEMY');
 *   if (block) return block;
 */
import { NextResponse } from 'next/server';

export async function requireFeature(
    hqId: string,
    feature: Feature,
): Promise<NextResponse | null> {
    const ent = await getEntitlements(hqId);
    if (ent.suspended) {
        return NextResponse.json(
            { success: false, error: 'Licencia inactiva o suspendida. Contacta a Zéndity.' },
            { status: 403 },
        );
    }
    if (!ent.hasFeature(feature)) {
        return NextResponse.json(
            { success: false, error: `Tu plan (${ent.plan}) no incluye esta funcionalidad. Actualiza tu plan con Zéndity.` },
            { status: 403 },
        );
    }
    return null; // acceso permitido
}
