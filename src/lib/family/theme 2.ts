/**
 * src/lib/family/theme.ts
 *
 * White-label theming POR TENANT para la superficie familiar.
 * Driver: Headquarters.brand* fields. Fallback: paleta default Zéndity.
 *
 * USO:
 *   import { resolveFamilyTheme, themeCssVars } from '@/lib/family/theme';
 *
 *   const theme = resolveFamilyTheme(hq);
 *   return <div style={themeCssVars(theme)}>{children}</div>
 *
 * Los componentes consumen via arbitrary CSS vars:
 *   className="bg-[var(--brand-primary)] text-white"
 *   className="bg-[var(--brand-bg)] min-h-screen"
 */

export interface FamilyTheme {
    brandName: string;       // "Vivid", "Zéndity"
    primary: string;         // botones, headings, focus — hex
    secondary: string;       // acentos suaves — hex
    accent: string;          // señal positiva ("Bien", ✓, "Al día") — hex
    bg: string;              // fondo de página — hex
}

// Default Zéndity (teal). Cualquier tenant sin brand* configurado lo usa.
export const DEFAULT_FAMILY_THEME: FamilyTheme = {
    brandName: 'Zéndity',
    primary: '#0F6B78',     // teal-700
    secondary: '#1D9E75',   // teal-500
    accent: '#10B981',      // emerald-500
    bg: '#FAFAF9',          // stone-50
};

interface HqBranding {
    name?: string | null;
    brandName?: string | null;
    brandPrimary?: string | null;
    brandSecondary?: string | null;
    brandAccent?: string | null;
    brandBg?: string | null;
}

/**
 * Resuelve el tema a aplicar a la superficie familiar.
 * Acepta el HQ del residente (puede ser null en edge cases — usa default).
 */
export function resolveFamilyTheme(hq: HqBranding | null | undefined): FamilyTheme {
    if (!hq) return DEFAULT_FAMILY_THEME;
    return {
        brandName: hq.brandName || DEFAULT_FAMILY_THEME.brandName,
        primary:   hq.brandPrimary   || DEFAULT_FAMILY_THEME.primary,
        secondary: hq.brandSecondary || DEFAULT_FAMILY_THEME.secondary,
        accent:    hq.brandAccent    || DEFAULT_FAMILY_THEME.accent,
        bg:        hq.brandBg        || DEFAULT_FAMILY_THEME.bg,
    };
}

/**
 * Convierte el tema a CSS variables aplicables vía style={} en un wrapper.
 * Los hijos consumen vía `var(--brand-*)` en cualquier prop CSS de Tailwind.
 */
export function themeCssVars(theme: FamilyTheme): React.CSSProperties {
    return {
        ['--brand-primary' as any]:   theme.primary,
        ['--brand-secondary' as any]: theme.secondary,
        ['--brand-accent' as any]:    theme.accent,
        ['--brand-bg' as any]:        theme.bg,
    };
}
