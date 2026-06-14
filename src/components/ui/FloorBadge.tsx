/**
 * FloorBadge — chip visual para piso de un residente o cuidadora.
 *
 * SPRINT MULTI-FLOOR (jun-2026). Reusado en:
 *   - Wall del supervisor (tile de cuidadora + secciones de piso)
 *   - Directorio staff (badge en row)
 *   - Chip del director (zombiePatients por piso)
 *   - Modales (preview)
 *
 * Variantes:
 *   - default (teal): piso normal "Piso N" — sigue paleta Zéndity teal-50/200/700
 *   - alarm (rojo):   floor=null en CAREGIVER activo o residente ACTIVE → data
 *                     anomaly visible. "⚠ Sin asignar". Reservado para
 *                     SIGNAL DE INTEGRIDAD, no decisión deliberada (el
 *                     break-glass cross-piso usa amarillo en otra superficie).
 *
 * floorLabel() centraliza el texto — Mayagüez piso 3 renderea "Piso 3"
 * automáticamente sin hardcoding 1/2.
 */
import { floorLabel } from '@/lib/floor';

interface FloorBadgeProps {
    floor: number | null;
    /** 'default' (teal) o 'alarm' (rojo). Si floor=null → siempre 'alarm'. */
    variant?: 'default' | 'alarm';
    /** Texto alternativo en lugar del label automático (e.g. "Multi-piso" para managers). */
    label?: string;
    className?: string;
}

export function FloorBadge({ floor, variant, label, className = '' }: FloorBadgeProps) {
    const isAlarm = floor === null || variant === 'alarm';
    const text = label ?? (floor === null ? '⚠ Sin asignar' : floorLabel(floor));
    const tone = isAlarm
        ? 'bg-red-50 text-red-700 border-red-200'
        : 'bg-teal-50 text-teal-700 border-teal-200';
    return (
        <span className={`inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-full border ${tone} ${className}`}>
            {text}
        </span>
    );
}
