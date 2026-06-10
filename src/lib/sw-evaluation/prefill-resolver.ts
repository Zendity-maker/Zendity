/**
 * src/lib/sw-evaluation/prefill-resolver.ts
 *
 * Resolver puro (sin acceso a DB) que toma un SWFormTemplateSchema + data
 * pre-cargada del residente y produce el shape de prefill que el endpoint
 * /api/corporate/sw-evaluations/prefill devuelve al cliente.
 *
 * Routing por prefillMode:
 *   READ_ONLY  → prefill[field.key] = valor inyectado
 *   REFERENCE  → prefill[field.key] = valor inyectado (default editable)
 *   NONE + prefillFrom → referenceData[field.key] = valor crudo (hint)
 *   NONE sin prefillFrom → nada (la TS llena sin contexto)
 *
 * El resolver es PURE para que el endpoint sea quien hace las queries con
 * los joins necesarios. Eso lo hace testable contra fixtures sintéticos sin
 * tocar DB.
 */

import type { SWFormTemplateSchema, SWFormField, PrefillMode } from './template-types';

// ─── Shape de data pre-cargada que el endpoint pasa al resolver ──────────
export interface PrefillSourceData {
    patient: {
        id: string;
        name: string;
        dateOfBirth: Date | null;
        admissionDate: Date | null;
        maritalStatus: string | null;
        religion: string | null;
        birthCity: string | null;
        address: string | null;
        avdScore: number | null;
        downtonRisk: boolean;
        nortonRisk: boolean;
        hospiceStartDate: Date | null;
        dietTexture: string | null;
        dietDiabetic: boolean;
        dietLowSodium: boolean;
        dietRenal: boolean;
        dietVegetarian: boolean;
        insurancePlanName: string | null;
        insurancePolicyNumber: string | null;
        medicareNumber: string | null;
        medicaidNumber: string | null;
        preferredHospital: string | null;
    };
    intakeData: {
        diagnoses: string | null;
        medicalHistory: string | null;
        mobilityLevel: string | null;
        continenceLevel: string | null;
        downtonScore: number | null;
        bradenScore: number | null;
    } | null;
    familyMembers: Array<{
        id: string;
        name: string;
        relationship: string | null;
        address: string | null;
        phone: string | null;
        email: string;
        isPrimary: boolean;
        isLegalGuardian: boolean;
    }>;
    socialWorkBenefits: Array<{
        id: string;
        type: string;
        status: string;
        details: string | null;
        expirationDate: Date | null;
    }>;
    activePressureUlcers: Array<{
        id: string;
        bodyLocation: string;
        stage: number;
        status: string;
        identifiedAt: Date;
    }>;
    emarAdherence: {
        adherenceRate: number;
        weeklyLogsCount: number;
    } | null;
    externalServicesActiveCount: number;
}

// ─── Output ──────────────────────────────────────────────────────────────
export interface PrefillOutput {
    prefill: Record<string, unknown>;       // READ_ONLY + REFERENCE values
    referenceData: Record<string, unknown>; // NONE+from hints
    unmapped: string[];                     // prefillFrom paths que el resolver no supo interpretar (audit)
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function computeAgeFromDOB(dob: Date | null): number | null {
    if (!dob) return null;
    const now = new Date();
    let age = now.getFullYear() - dob.getFullYear();
    const m = now.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
    return age;
}

function findByRelationshipMatch(members: PrefillSourceData['familyMembers'], pattern: string): PrefillSourceData['familyMembers'][number] | undefined {
    const p = pattern.toLowerCase();
    return members.find(m => m.relationship?.toLowerCase().includes(p));
}

/**
 * Interpreta un `prefillFrom` y devuelve el valor crudo. Si el path es
 * desconocido, retorna `undefined` y el caller lo registra en `unmapped`.
 */
function resolvePath(path: string, src: PrefillSourceData): unknown {
    // ── Patient.X ──
    if (path.startsWith('Patient.')) {
        const key = path.slice('Patient.'.length) as keyof PrefillSourceData['patient'];
        return src.patient[key] ?? null;
    }

    // ── IntakeData.X ──
    if (path.startsWith('IntakeData.')) {
        if (!src.intakeData) return null;
        const key = path.slice('IntakeData.'.length) as keyof NonNullable<PrefillSourceData['intakeData']>;
        return src.intakeData[key] ?? null;
    }

    // ── computed:X ──
    if (path === 'computed:age_from_dob') {
        return computeAgeFromDOB(src.patient.dateOfBirth);
    }

    // ── family.members (tabla completa) ──
    if (path === 'family.members') {
        return src.familyMembers.map(m => ({
            name: m.name,
            relationship: m.relationship ?? '',
            address: m.address ?? '',
            phone: m.phone ?? '',
            email: m.email,
            isPrimary: m.isPrimary,
            isLegalGuardian: m.isLegalGuardian,
        }));
    }

    // ── family.members[isPrimary] / [isLegalGuardian] / [relationship~=X] ──
    if (path.startsWith('family.members[')) {
        const selector = path.slice('family.members['.length, -1);
        if (selector === 'isPrimary') {
            return src.familyMembers.find(m => m.isPrimary)?.name ?? null;
        }
        if (selector === 'isLegalGuardian') {
            return src.familyMembers.find(m => m.isLegalGuardian)?.name ?? null;
        }
        const relMatch = selector.match(/^relationship~=(.+)$/);
        if (relMatch) {
            const found = findByRelationshipMatch(src.familyMembers, relMatch[1]);
            return found?.name ?? null;
        }
        return undefined; // path desconocido
    }

    // ── socialWork.benefits ──
    if (path === 'socialWork.benefits') {
        return src.socialWorkBenefits.map(b => ({
            type: b.type,
            status: b.status,
            details: b.details,
            expirationDate: b.expirationDate ? b.expirationDate.toISOString().slice(0, 10) : null,
        }));
    }

    // ── pressureUlcer.active ──
    if (path === 'pressureUlcer.active') {
        return src.activePressureUlcers.map(u => ({
            bodyLocation: u.bodyLocation,
            stage: u.stage,
            status: u.status,
            identifiedAt: u.identifiedAt.toISOString().slice(0, 10),
        }));
    }

    // ── emar.adherenceRate ──
    if (path === 'emar.adherenceRate') {
        return src.emarAdherence ?? { adherenceRate: null, weeklyLogsCount: 0 };
    }

    // ── patient.servicesContext ──
    if (path === 'patient.servicesContext') {
        return {
            hasHospice: src.patient.hospiceStartDate !== null,
            hospiceStartDate: src.patient.hospiceStartDate ? src.patient.hospiceStartDate.toISOString().slice(0, 10) : null,
            externalServicesActiveCount: src.externalServicesActiveCount,
        };
    }

    // ── patient.dependenceContext ──
    if (path === 'patient.dependenceContext') {
        return {
            avdScore: src.patient.avdScore,
            mobilityLevel: src.intakeData?.mobilityLevel ?? null,
            continenceLevel: src.intakeData?.continenceLevel ?? null,
            downtonRisk: src.patient.downtonRisk,
            downtonScore: src.intakeData?.downtonScore ?? null,
            nortonRisk: src.patient.nortonRisk,
            bradenScore: src.intakeData?.bradenScore ?? null,
        };
    }

    // ── patient.dietContext ──
    if (path === 'patient.dietContext') {
        return {
            dietTexture: src.patient.dietTexture,
            dietDiabetic: src.patient.dietDiabetic,
            dietLowSodium: src.patient.dietLowSodium,
            dietRenal: src.patient.dietRenal,
            dietVegetarian: src.patient.dietVegetarian,
        };
    }

    // ── Path desconocido ──
    return undefined;
}

// ─── Resolver principal ──────────────────────────────────────────────────

export function resolvePrefill(
    schema: SWFormTemplateSchema,
    src: PrefillSourceData,
): PrefillOutput {
    const prefill: Record<string, unknown> = {};
    const referenceData: Record<string, unknown> = {};
    const unmapped: string[] = [];

    for (const section of schema.sections) {
        for (const field of section.fields) {
            if (!field.prefillFrom) continue; // sin fuente → nada

            const value = resolvePath(field.prefillFrom, src);

            // Path desconocido → log para audit, no crash
            if (value === undefined) {
                unmapped.push(`${section.key}.${field.key} → "${field.prefillFrom}" (path desconocido)`);
                continue;
            }

            // Routing por mode
            if (field.prefillMode === 'READ_ONLY' || field.prefillMode === 'REFERENCE') {
                prefill[field.key] = value;
            } else if (field.prefillMode === 'NONE') {
                // NONE + prefillFrom → hint visible
                referenceData[field.key] = value;
            }
        }
    }

    return { prefill, referenceData, unmapped };
}
