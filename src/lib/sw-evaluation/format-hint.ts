/**
 * src/lib/sw-evaluation/format-hint.ts
 *
 * Formatter de hints para campos NONE+prefillFrom — toma el `referenceData`
 * pre-cargado por el resolver y produce un string legible que la UI muestra
 * como info-line "Referencia: ..." tenue bajo el label.
 *
 * Reglas:
 *   - El hint NUNCA debe parecer la respuesta de la TS. Por eso vive como
 *     info-line tenue, no como placeholder.
 *   - Si el valor es vacío/null/inútil, retorna null → la UI no muestra
 *     hint en absoluto (mejor nada que un hint hueco).
 *   - Cada path conocido tiene su formatter por shape — no stringify crudo.
 *   - Paths desconocidos (Patient.X primitivos) caen al formatter genérico.
 */

import type { SWFormField } from './template-types';

// ─── Helpers ─────────────────────────────────────────────────────────────

function formatDateEs(value: string | Date | null | undefined): string | null {
    if (!value) return null;
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const yyyy = d.getUTCFullYear();
    return `${dd}/${mm}/${yyyy}`;
}

function isPrimitiveEmpty(v: unknown): boolean {
    if (v === null || v === undefined) return true;
    if (typeof v === 'string' && v.trim() === '') return true;
    if (Array.isArray(v) && v.length === 0) return true;
    return false;
}

// ─── Shape-specific formatters ───────────────────────────────────────────

interface AdherenceShape {
    adherenceRate: number | null;
    weeklyLogsCount: number;
}

function formatAdherence(v: AdherenceShape): string | null {
    if (v.weeklyLogsCount === 0) return 'Sin registros de eMAR esta semana';
    if (v.adherenceRate === null) return null;
    const records = `${v.weeklyLogsCount} ${v.weeklyLogsCount === 1 ? 'registro' : 'registros'}`;
    return `${v.adherenceRate}% de adherencia esta semana (${records})`;
}

interface BenefitShape {
    type: string;
    status: string;
    details: string | null;
    expirationDate: string | null;
}

const BENEFIT_TYPE_LABEL: Record<string, string> = {
    MEDICARE: 'Medicare',
    MEDICAID: 'Medicaid',
    SNAP: 'SNAP',
    PENSION: 'Pensión',
    OTHER: 'Otro',
};

const BENEFIT_STATUS_LABEL: Record<string, string> = {
    ACTIVE: 'activo',
    PENDING: 'pendiente',
    EXPIRED: 'expirado',
    UNKNOWN: 'sin info',
};

function formatBenefits(v: BenefitShape[]): string | null {
    if (v.length === 0) return 'Sin beneficios registrados';
    const items = v.slice(0, 3).map(b => {
        const type = BENEFIT_TYPE_LABEL[b.type] ?? b.type;
        const status = BENEFIT_STATUS_LABEL[b.status] ?? b.status.toLowerCase();
        return `${type} (${status})`;
    });
    const overflow = v.length > 3 ? ` · +${v.length - 3} más` : '';
    return items.join(' · ') + overflow;
}

interface PressureUlcerShape {
    bodyLocation: string;
    stage: number;
    status: string;
    identifiedAt: string;
}

function formatPressureUlcers(v: PressureUlcerShape[]): string | null {
    if (v.length === 0) return 'Sin úlceras activas';
    const items = v.slice(0, 2).map(u => `${u.bodyLocation} etapa ${u.stage}`);
    const overflow = v.length > 2 ? ` · +${v.length - 2} más` : '';
    const count = `${v.length} ${v.length === 1 ? 'activa' : 'activas'}`;
    return `${count}: ${items.join(' · ')}${overflow}`;
}

interface ServicesContextShape {
    hasHospice: boolean;
    hospiceStartDate: string | null;
    externalServicesActiveCount: number;
}

function formatServicesContext(v: ServicesContextShape): string | null {
    const parts: string[] = [];
    if (v.hasHospice) {
        const start = v.hospiceStartDate ? ` desde ${formatDateEs(v.hospiceStartDate)}` : '';
        parts.push(`Hospicio activo${start}`);
    }
    if (v.externalServicesActiveCount > 0) {
        const word = v.externalServicesActiveCount === 1 ? 'servicio externo' : 'servicios externos';
        parts.push(`${v.externalServicesActiveCount} ${word}`);
    }
    if (parts.length === 0) return 'Sin servicios externos registrados';
    return parts.join(' · ');
}

interface DependenceContextShape {
    avdScore: number | null;
    mobilityLevel: string | null;
    continenceLevel: string | null;
    downtonRisk: boolean;
    downtonScore: number | null;
    nortonRisk: boolean;
    bradenScore: number | null;
}

function formatDependenceContext(v: DependenceContextShape): string | null {
    const parts: string[] = [];
    if (v.avdScore !== null) parts.push(`AVD ${v.avdScore}`);
    if (v.mobilityLevel) parts.push(`Movilidad ${v.mobilityLevel.toLowerCase()}`);
    if (v.continenceLevel) parts.push(`Continencia ${v.continenceLevel.toLowerCase()}`);
    if (v.downtonRisk) {
        const score = v.downtonScore !== null ? ` (${v.downtonScore})` : '';
        parts.push(`Riesgo Downton${score}`);
    }
    if (v.nortonRisk) {
        const score = v.bradenScore !== null ? ` (Braden ${v.bradenScore})` : '';
        parts.push(`Riesgo Norton${score}`);
    }
    if (parts.length === 0) return null;
    return parts.join(' · ');
}

interface DietContextShape {
    dietTexture: string | null;
    dietDiabetic: boolean;
    dietLowSodium: boolean;
    dietRenal: boolean;
    dietVegetarian: boolean;
}

const TEXTURE_LABEL: Record<string, string> = {
    REGULAR: 'Regular',
    BLANDA: 'Blanda',
    MAJADA: 'Majada',
    PUREE: 'Puré',
    LICUADO: 'Licuado',
    LIQUIDOS_CLAROS: 'Líquidos claros',
    PEG: 'PEG',
};

function formatDietContext(v: DietContextShape): string | null {
    const parts: string[] = [];
    if (v.dietTexture) {
        parts.push(TEXTURE_LABEL[v.dietTexture] ?? v.dietTexture);
    }
    if (v.dietDiabetic) parts.push('Diabética');
    if (v.dietLowSodium) parts.push('Baja en sodio');
    if (v.dietRenal) parts.push('Renal');
    if (v.dietVegetarian) parts.push('Vegetariana');
    if (parts.length === 0) return null;
    return parts.join(' · ');
}

interface FamilyMemberShape {
    name: string;
    relationship: string;
    address: string;
    phone: string;
    email: string;
    isPrimary: boolean;
    isLegalGuardian: boolean;
}

function formatFamilyMembersList(v: FamilyMemberShape[]): string | null {
    if (v.length === 0) return 'Sin familiares registrados';
    const items = v.slice(0, 3).map(m => {
        const tags: string[] = [];
        if (m.isPrimary) tags.push('primario');
        // isLegalGuardian = Apoderado (semántica lockeada — drift documentado,
        // ver CLAUDE.md y src/lib/sw-evaluation/templates/initial-mfr-v1.ts).
        if (m.isLegalGuardian) tags.push('apoderado');
        const rel = m.relationship ? m.relationship : 'sin parentesco';
        const tagsStr = tags.length > 0 ? ` (${tags.join(', ')})` : '';
        return `${m.name} — ${rel}${tagsStr}`;
    });
    const overflow = v.length > 3 ? ` · +${v.length - 3} más` : '';
    return items.join(' · ') + overflow;
}

// ─── Genérico para primitivos ────────────────────────────────────────────

function formatPrimitive(value: unknown): string | null {
    if (isPrimitiveEmpty(value)) return null;
    if (value instanceof Date) return formatDateEs(value);
    if (typeof value === 'boolean') return value ? 'Sí' : 'No';
    if (typeof value === 'number') return String(value);
    if (typeof value === 'string') {
        // Detectar ISO date YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}/.test(value)) return formatDateEs(value);
        return value;
    }
    return null;
}

// ─── Type guards ─────────────────────────────────────────────────────────

function isAdherence(v: unknown): v is AdherenceShape {
    return typeof v === 'object' && v !== null
        && 'adherenceRate' in v && 'weeklyLogsCount' in v;
}

function isBenefitArray(v: unknown): v is BenefitShape[] {
    return Array.isArray(v) && (v.length === 0 || (
        typeof v[0] === 'object' && v[0] !== null && 'type' in v[0] && 'status' in v[0]
    ));
}

function isPressureUlcerArray(v: unknown): v is PressureUlcerShape[] {
    return Array.isArray(v) && (v.length === 0 || (
        typeof v[0] === 'object' && v[0] !== null && 'bodyLocation' in v[0] && 'stage' in v[0]
    ));
}

function isServicesContext(v: unknown): v is ServicesContextShape {
    return typeof v === 'object' && v !== null
        && 'hasHospice' in v && 'externalServicesActiveCount' in v;
}

function isDependenceContext(v: unknown): v is DependenceContextShape {
    return typeof v === 'object' && v !== null
        && 'avdScore' in v && 'mobilityLevel' in v && 'continenceLevel' in v;
}

function isDietContext(v: unknown): v is DietContextShape {
    return typeof v === 'object' && v !== null
        && 'dietTexture' in v && 'dietDiabetic' in v;
}

function isFamilyMemberArray(v: unknown): v is FamilyMemberShape[] {
    return Array.isArray(v) && (v.length === 0 || (
        typeof v[0] === 'object' && v[0] !== null && 'name' in v[0] && 'relationship' in v[0]
    ));
}

// ─── API pública ─────────────────────────────────────────────────────────

/**
 * Dado un field y su valor `referenceData[field.key]`, devuelve el string
 * legible para mostrar como hint. null si no hay hint útil.
 *
 * El despacho se hace por `prefillFrom` (la fuente original), no por shape
 * runtime — más explícito y resistente a cambios futuros del resolver.
 */
export function formatHint(field: SWFormField, value: unknown): string | null {
    if (value === undefined) return null;

    const path = field.prefillFrom;
    if (!path) return null;

    // ── Compuestos: dispatch por path conocido ──
    switch (path) {
        case 'emar.adherenceRate':
            return isAdherence(value) ? formatAdherence(value) : null;

        case 'socialWork.benefits':
            return isBenefitArray(value) ? formatBenefits(value) : null;

        case 'pressureUlcer.active':
            return isPressureUlcerArray(value) ? formatPressureUlcers(value) : null;

        case 'patient.servicesContext':
            return isServicesContext(value) ? formatServicesContext(value) : null;

        case 'patient.dependenceContext':
            return isDependenceContext(value) ? formatDependenceContext(value) : null;

        case 'patient.dietContext':
            return isDietContext(value) ? formatDietContext(value) : null;

        case 'family.members':
            return isFamilyMemberArray(value) ? formatFamilyMembersList(value) : null;

        default:
            // Patient.X, IntakeData.X, computed:age_from_dob, family.members[selector]
            // → primitivos (string / number / Date / null)
            return formatPrimitive(value);
    }
}
