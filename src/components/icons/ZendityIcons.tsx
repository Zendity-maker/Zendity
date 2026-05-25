/**
 * src/components/icons/ZendityIcons.tsx
 *
 * Set de iconos SVG originales de Zéndity para el Portal Familiar.
 * Propuesta C — Humanista Suave.
 *
 * Trazos en `currentColor` para herencia del tema — el padre define el color
 * vía Tailwind (text-brand) o inline style (color: var(--brand-primary)).
 * Stroke 2px, viewBox 48x48, esquinas redondeadas.
 *
 * USO:
 *   import { IconAlimentacion } from '@/components/icons/ZendityIcons';
 *   <IconAlimentacion size={24} className="opacity-80" />
 */

interface IconProps {
    size?: number;
    className?: string;
}

// ── Alimentación: tenedor + cuchara estilizados ─────────────────────────
export function IconAlimentacion({ size = 24, className }: IconProps) {
    return (
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
            <path d="M16 14 C16 14 16 20 16 22 C16 25 18 27 22 27 L22 36"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M20 14 L20 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M24 14 L24 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M28 14 C28 14 32 16 32 20 C32 24 30 26 28 27 L28 36"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
    );
}

// ── Higiene: bañera con burbujas ────────────────────────────────────────
export function IconHigiene({ size = 24, className }: IconProps) {
    return (
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
            <path d="M14 26 L34 26 L32 34 L16 34 Z"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M14 26 L14 20 C14 18 16 16.5 18 16.5 C19 16.5 19.5 17.2 19.5 18 L19.5 26"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M34 26 L34 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M22 20 Q24 18 26 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M26 22 Q28 20 30 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
    );
}

// ── Medicamentos: cápsula con cruz ──────────────────────────────────────
export function IconMedicamentos({ size = 24, className }: IconProps) {
    return (
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
            <rect x="16" y="14" width="16" height="20" rx="8" stroke="currentColor" strokeWidth="2" />
            <line x1="16" y1="24" x2="32" y2="24" stroke="currentColor" strokeWidth="2" />
            <rect x="16" y="14" width="16" height="10" rx="8" fill="currentColor" fillOpacity="0.15" />
            <line x1="24" y1="28" x2="24" y2="32" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="22" y1="30" x2="26" y2="30" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
    );
}

// ── Presión arterial: onda + bomba ─────────────────────────────────────
export function IconPresion({ size = 24, className }: IconProps) {
    return (
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
            <path d="M12 24 L16 24 L19 18 L22 30 L25 22 L27 26 L30 24 L36 24"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="24" cy="34" r="3" fill="currentColor" fillOpacity="0.3"
                stroke="currentColor" strokeWidth="1.5" />
            <path d="M24 31 L24 29" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
    );
}

// ── Temperatura: termómetro con marcas ─────────────────────────────────
export function IconTemperatura({ size = 24, className }: IconProps) {
    return (
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
            <rect x="21" y="13" width="6" height="18" rx="3" stroke="currentColor" strokeWidth="2" />
            <rect x="21" y="22" width="6" height="9" rx="0" fill="currentColor" fillOpacity="0.25" />
            <circle cx="24" cy="33" r="4" fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeWidth="2" />
            <circle cx="24" cy="33" r="2" fill="currentColor" />
            <line x1="29" y1="16" x2="32" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="29" y1="19" x2="31" y2="19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="29" y1="22" x2="32" y2="22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
    );
}

// ── Saturación O₂: gota con check ──────────────────────────────────────
export function IconSpO2({ size = 24, className }: IconProps) {
    return (
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
            <path d="M18 24 C18 20 21 17 24 17 C27 17 30 20 30 24 C30 29 24 34 24 34 C24 34 18 29 18 24 Z"
                stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            <path d="M18 24 C18 20 21 17 24 17 C27 17 30 20 30 24"
                fill="currentColor" fillOpacity="0.15" />
            <path d="M21 24 L23 26 L27 21"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

// ── Pulso: corazón con onda ECG ────────────────────────────────────────
export function IconPulso({ size = 24, className }: IconProps) {
    return (
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
            <path d="M24 15 C24 15 17 17 17 23 C17 28 24 33 24 33 C24 33 31 28 31 23 C31 17 24 15 24 15 Z"
                stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            <path d="M24 15 C24 15 17 17 17 23 C17 28 24 33 24 33"
                fill="currentColor" fillOpacity="0.12" />
            <path d="M19 24 L21 24 L23 21 L25 27 L27 24 L29 24"
                stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

// ── Mensajes: globo de diálogo con líneas ──────────────────────────────
export function IconMensajes({ size = 24, className }: IconProps) {
    return (
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
            <path d="M13 16 L35 16 L35 30 L26 30 L22 35 L22 30 L13 30 Z"
                stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            <path d="M13 16 L35 16 L35 22 L13 22" fill="currentColor" fillOpacity="0.1" />
            <line x1="18" y1="21" x2="30" y2="21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="18" y1="25" x2="27" y2="25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
    );
}

// ── Citas: calendario con puntos ───────────────────────────────────────
export function IconCitas({ size = 24, className }: IconProps) {
    return (
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
            <rect x="13" y="16" width="22" height="20" rx="3" stroke="currentColor" strokeWidth="2" />
            <rect x="13" y="16" width="22" height="7" rx="3" fill="currentColor" fillOpacity="0.2" />
            <line x1="13" y1="23" x2="35" y2="23" stroke="currentColor" strokeWidth="1.5" />
            <line x1="19" y1="13" x2="19" y2="19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="29" y1="13" x2="29" y2="19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <circle cx="20" cy="28" r="2" fill="currentColor" />
            <circle cx="24" cy="28" r="2" fill="currentColor" fillOpacity="0.3" />
            <circle cx="28" cy="28" r="2" fill="currentColor" fillOpacity="0.3" />
        </svg>
    );
}

// ── PAI: carpeta de plan con líneas ────────────────────────────────────
export function IconPAI({ size = 24, className }: IconProps) {
    return (
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
            <rect x="15" y="13" width="18" height="22" rx="3" stroke="currentColor" strokeWidth="2" />
            <rect x="15" y="13" width="18" height="6" rx="3" fill="currentColor" fillOpacity="0.2" />
            <line x1="19" y1="24" x2="29" y2="24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="19" y1="27" x2="29" y2="27" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="19" y1="30" x2="25" y2="30" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="17.5" cy="24" r="1.5" fill="currentColor" />
            <circle cx="17.5" cy="27" r="1.5" fill="currentColor" />
            <circle cx="17.5" cy="30" r="1.5" fill="currentColor" fillOpacity="0.3" />
        </svg>
    );
}

// ── Facturación: recibo con símbolo $ ──────────────────────────────────
export function IconFacturacion({ size = 24, className }: IconProps) {
    return (
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
            <rect x="14" y="14" width="20" height="22" rx="3" stroke="currentColor" strokeWidth="2" />
            <rect x="14" y="14" width="20" height="7" rx="3" fill="currentColor" fillOpacity="0.2" />
            <path d="M24 19 L24 21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M24 31 L24 33" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M21 22 C21 22 21 21 24 21 C27 21 27 23 24 24 C21 25 21 27 24 27 C27 27 27 26 27 26"
                stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
    );
}
