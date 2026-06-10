/**
 * src/lib/sw-evaluation/template-types.ts
 *
 * Types compartidos para el JSON schema de SWFormTemplate. Usados por:
 *   - el resolver de prefill (Paso 4)
 *   - los endpoints CRUD de SWEvaluation (Paso 5)
 *   - el generador de PDF (Paso 6)
 *   - los renderers de UI (Fase 2)
 *
 * `SWFormTemplate.schema` se guarda como Json en Prisma, pero AL LEERLO
 * lo casteamos a SWFormTemplateSchema para tener type-safety en el código.
 *
 * ─── Regla de prefillMode ───────────────────────────────────────────────
 *
 *   READ_ONLY:  Inyecta el valor de prefillFrom en el campo. NO editable.
 *               Para datos factuales heredados de fuente única (Patient.name,
 *               IntakeData.diagnoses, etc.). prefillFrom obligatorio.
 *
 *   REFERENCE:  Inyecta el valor de prefillFrom como DEFAULT EDITABLE.
 *               Solo aplica cuando la fuente mapea 1:1 al campo SIN
 *               inferencia clínica. Ejemplo válido: §IX Tutor legal —
 *               inyecta el nombre del FamilyMember, la TS lo puede editar.
 *               prefillFrom obligatorio.
 *
 *   NONE + prefillFrom: Muestra el valor de prefillFrom como HINT visible
 *               al lado del campo, pero NO auto-llena. La TS marca/llena
 *               desde cero usando el hint como contexto. Aplica cuando
 *               mapear la fuente al campo requeriría inferencia clínica
 *               (ej. AVD=3 → ¿qué checkbox de dependencia?). prefillFrom
 *               trae el dato crudo para que el resolver lo exponga como
 *               referenceData; la UI lo muestra como subtítulo/tooltip.
 *
 *   NONE sin prefillFrom: Input puro de la TS, sin contexto del sistema.
 *               Para campos puramente valorativos (esferas, ánimo, etc.).
 *
 * Regla rápida: si el valor de la fuente puede asignarse directamente al
 * campo sin que la TS deba interpretar/clasificar, es REFERENCE. Si la TS
 * tiene que hacer un juicio clínico para escoger qué marcar, es NONE+hint.
 */

export type PrefillMode =
    | 'READ_ONLY'
    | 'REFERENCE'
    | 'NONE';

export type FieldType =
    | 'text'
    | 'date'
    | 'single_select'
    | 'checkbox_group'
    | 'table'
    | 'narrative';

export interface TableColumn {
    key: string;
    label: string;
    type: 'text' | 'number' | 'currency' | 'boolean';
}

export interface SWFormField {
    key: string;
    label: string;
    type: FieldType;
    prefillMode: PrefillMode;

    /**
     * Ruta de origen del valor pre-llenado. Opcional en CUALQUIER mode:
     *   - READ_ONLY: obligatorio en la práctica (sin fuente, no hay valor).
     *   - REFERENCE: obligatorio en la práctica (sin fuente, no hay default).
     *   - NONE + prefillFrom: opcional — si está, el resolver trae el valor
     *     y lo expone como referenceData (hint visible). Si no, el campo
     *     es input puro sin contexto.
     *
     * Convenciones de path (el resolver las interpreta en Paso 4):
     *   - 'Patient.X'                  → campo directo del paciente
     *   - 'IntakeData.X'               → campo de IntakeData del paciente
     *   - 'computed:X'                 → cálculo derivado (ej. computed:age_from_dob)
     *   - 'family.members'             → lista de FamilyMember[] del paciente
     *   - 'family.members[isPrimary]'  → primer FamilyMember con isPrimary=true
     *   - 'family.members[isLegalGuardian]'      → primer con isLegalGuardian=true
     *   - 'family.members[relationship~=Tutor]'  → match case-insensitive sobre relationship
     *   - 'socialWork.benefits'        → SocialWorkBenefit[] activos
     *   - 'pressureUlcer.active'       → PressureUlcer[] con status ACTIVE/HEALING
     *   - 'emar.adherenceRate'         → cálculo del eMAR (semana actual)
     *   - 'patient.servicesContext'    → derivado: hasHospice + externalServicesActiveCount
     *   - 'patient.dependenceContext'  → derivado: avdScore + mobilityLevel
     *   - 'patient.dietContext'        → derivado: dietTexture + flags
     */
    prefillFrom?: string;

    /** opciones para single_select / checkbox_group */
    options?: string[];

    /** columnas para tipo 'table' */
    columns?: TableColumn[];

    /** filas pre-definidas para 'table' (cuando el form fija las filas, ej. fuentes de ingreso) */
    rows?: string[];

    /** documentación inline visible en el JSON commiteado — no se renderiza en UI */
    notes?: string;
}

export interface SWFormSection {
    key: string;
    order: number;
    title: string;
    fields: SWFormField[];
}

export interface SWFormTemplateSchema {
    /** versión del shape del schema mismo (no del template). Bump si rompe el resolver. */
    schemaVersion: 1;
    sections: SWFormSection[];
}
