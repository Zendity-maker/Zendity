/**
 * src/lib/entitlements.ts
 * ──────────────────────────────────────────────────────────────────
 * Capa de control de acceso basada en plan de suscripción.
 *
 * USO EN API ROUTES:
 *   const ent = await getEntitlements(hqId);
 *   if (!ent.hasFeature('ACADEMY')) return unauthorized('Plan no incluye Academy');
 *
 * USO EN SERVER COMPONENTS / LAYOUTS:
 *   const ent = await getEntitlements(hqId);
 *   if (ent.suspended) redirect('/suspended');
 *
 * PLANES (alineados con zendity.com):
 *
 *   LITE / "Esencial"      → $10/cama/mes (mín $150)
 *     eMAR completo, handovers, vitales, portal familiar, schedule,
 *     triage básico, Zendi AI (consultas), 16 cursos Academy
 *
 *   PRO / "Profesional"    → $15/cama/mes (mín $225)  ⭐ más popular
 *     Todo Esencial + analytics, schedule avanzado, family chat,
 *     CRM admisiones, kitchen/nutrition, kiosco recepción
 *
 *   ENTERPRISE / "Corporativo" → $20/cama/mes (mín $400)
 *     Todo Profesional + AI briefing avanzado, multi-sede, custom reports,
 *     onboarding dedicado, SLA garantizado
 */

import { prisma } from '@/lib/prisma';

// ── Feature keys disponibles en la plataforma ────────────────────
export type Feature =
    // Core clínico — en TODOS los planes (Esencial+)
    | 'EMAR'               // Administración de medicamentos
    | 'HANDOVERS'          // Reportes de cierre de turno
    | 'VITALS'             // Registro de signos vitales
    | 'FAMILY_PORTAL'      // Acceso del portal familiar
    | 'SCHEDULE'           // Constructor de horarios básico
    | 'TRIAGE'             // Centro de triage e incidentes (web lo vende en Esencial)
    | 'ACADEMY'            // Cursos y certificaciones (web lo vende en Esencial)
    | 'ZENDI_AI_BASIC'     // Zendi AI: consultas y asistencia (web lo vende en Esencial)
    // Operacional avanzado — Profesional+
    | 'ANALYTICS'          // Dashboard de tendencias y KPIs
    | 'SCHEDULE_ADVANCED'  // Schedule Builder con redistribución y colores
    | 'FAMILY_CHAT'        // Mensajería bidireccional familia ↔ staff
    | 'CRM_ADMISIONES'     // CRM de prospectos y admisiones
    | 'KITCHEN_NUTRITION'  // Módulo de cocina y nutrición
    | 'RECEPTION_KIOSK'    // Kiosco de recepción con Web Speech
    // Corporativo
    | 'AI_BRIEFING'        // Zendi Director Briefing avanzado (GPT-4o, multi-sede)
    | 'MULTI_HQ'           // Acceso a múltiples sedes
    | 'CUSTOM_REPORTS'     // Reportes exportables y auditoría HIPAA avanzada
    | 'IMPERSONATION';     // Soporte remoto con impersonation (solo Zéndity)

// ── Matriz de features por plan (alineada con zendity.com) ───────
const PLAN_FEATURES: Record<string, Feature[]> = {
    LITE: [
        // Esencial: lo básico para operar — alineado con el plan "Esencial" de la web
        'EMAR', 'HANDOVERS', 'VITALS', 'FAMILY_PORTAL', 'SCHEDULE',
        'TRIAGE', 'ACADEMY', 'ZENDI_AI_BASIC',
    ],
    PRO: [
        // Profesional: facilidad creciente — alineado con plan "Profesional" de la web
        'EMAR', 'HANDOVERS', 'VITALS', 'FAMILY_PORTAL', 'SCHEDULE',
        'TRIAGE', 'ACADEMY', 'ZENDI_AI_BASIC',
        'ANALYTICS', 'SCHEDULE_ADVANCED', 'FAMILY_CHAT',
        'CRM_ADMISIONES', 'KITCHEN_NUTRITION', 'RECEPTION_KIOSK',
    ],
    ENTERPRISE: [
        // Corporativo: operación multi-sede — alineado con plan "Corporativo" de la web
        'EMAR', 'HANDOVERS', 'VITALS', 'FAMILY_PORTAL', 'SCHEDULE',
        'TRIAGE', 'ACADEMY', 'ZENDI_AI_BASIC',
        'ANALYTICS', 'SCHEDULE_ADVANCED', 'FAMILY_CHAT',
        'CRM_ADMISIONES', 'KITCHEN_NUTRITION', 'RECEPTION_KIOSK',
        'AI_BRIEFING', 'MULTI_HQ', 'CUSTOM_REPORTS', 'IMPERSONATION',
    ],
};

// ── Nombres comerciales y pricing (lo que vende la web) ──────────
export const PLAN_DISPLAY_NAMES: Record<string, string> = {
    LITE: 'Plan Esencial',
    PRO: 'Plan Profesional',
    ENTERPRISE: 'Plan Corporativo',
};

export const PLAN_PRICING: Record<string, { pricePerBed: number; monthlyMinimum: number; founderPrice: number }> = {
    // pricePerBed × camas o monthlyMinimum, lo que sea mayor
    // founderPrice = 50% lifetime para primeras 10 facilidades
    LITE:       { pricePerBed: 10, monthlyMinimum: 150, founderPrice: 5 },
    PRO:        { pricePerBed: 15, monthlyMinimum: 225, founderPrice: 7.5 },
    ENTERPRISE: { pricePerBed: 20, monthlyMinimum: 400, founderPrice: 10 },
};

// Mapeo aliases comerciales ↔ códigos internos
const PLAN_ALIASES: Record<string, string> = {
    // Códigos internos (pasan tal cual)
    'LITE': 'LITE',
    'PRO': 'PRO',
    'ENTERPRISE': 'ENTERPRISE',
    // Nombres comerciales (web)
    'ESENCIAL': 'LITE',
    'PROFESIONAL': 'PRO',
    'CORPORATIVO': 'ENTERPRISE',
    // Aliases en inglés (legacy)
    'BASIC': 'LITE',
    'PROFESSIONAL': 'PRO',
    'CORPORATE': 'ENTERPRISE',
};

/**
 * Normaliza un nombre de plan (acepta nombre comercial o código interno)
 * y lo convierte al código interno. Retorna null si no es válido.
 *
 * Ejemplos:
 *   normalizePlan('Esencial')      → 'LITE'
 *   normalizePlan('PROFESIONAL')   → 'PRO'
 *   normalizePlan('LITE')          → 'LITE'
 *   normalizePlan('plan-invalido') → null
 */
export function normalizePlan(input: string | null | undefined): string | null {
    if (!input) return null;
    const key = input.trim().toUpperCase();
    return PLAN_ALIASES[key] ?? null;
}

/** Retorna el nombre comercial mostrable de un plan. */
export function getPlanDisplayName(plan: string): string {
    const normalized = normalizePlan(plan) ?? 'LITE';
    return PLAN_DISPLAY_NAMES[normalized] ?? PLAN_DISPLAY_NAMES.LITE;
}

/** Retorna el pricing del plan. */
export function getPlanPricing(plan: string): { pricePerBed: number; monthlyMinimum: number; founderPrice: number } {
    const normalized = normalizePlan(plan) ?? 'LITE';
    return PLAN_PRICING[normalized] ?? PLAN_PRICING.LITE;
}

/** Retorna la lista de features para un plan. */
export function getPlanFeatures(plan: string): Feature[] {
    const normalized = normalizePlan(plan) ?? 'LITE';
    return PLAN_FEATURES[normalized] ?? PLAN_FEATURES.LITE;
}

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

    // Normaliza el plan: acepta tanto códigos internos como nombres comerciales.
    // Si el plan está corrupto o no reconocido, cae a LITE (Esencial) explícitamente.
    const plan = normalizePlan(hq.subscriptionPlan) ?? 'LITE';
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
