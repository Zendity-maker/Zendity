/**
 * src/lib/sw-evaluation/templates/initial-mfr-v1.ts
 *
 * Plantilla "Evaluación Psicosocial Inicial" (Form MFR9873-ESI · 5 págs · 17 secciones).
 * Versión v1 · jun 2026.
 *
 * Fiel al mapeo provisto por la dirección. Cada campo declara su tipo,
 * prefillMode (READ_ONLY / REFERENCE / NONE) y prefillFrom donde aplique.
 *
 * ─── REGLA DE prefillMode (decisión 10-jun-2026) ────────────────────────
 *
 *   REFERENCE = INYECTA un valor que mapea 1:1 al campo SIN inferencia
 *               clínica. Default editable. La TS puede confirmar o cambiar.
 *
 *   NONE + prefillFrom = HINT visible al lado del campo. NO auto-llena.
 *               Aplica cuando mapear la fuente al campo requiere INFERENCIA
 *               clínica (ej. AVD=3 → ¿qué checkbox de dependencia?). El
 *               resolver trae el dato crudo; la TS marca su criterio.
 *
 * ─── Decisiones cerradas (anotadas inline donde tocan) ──────────────────
 *
 *   D-1 "Tutor legal" (§IX): string-match `relationship~=Tutor`. NO existe
 *       flag estructurado para tutor. Único campo que sigue siendo
 *       REFERENCE-inyecta (el resolver trae el NOMBRE del tutor).
 *
 *   D-2 "Datos económicos" (§X): TS llena los $; benefits son hint.
 *       Originalmente clasificado REFERENCE, RECLASIFICADO a NONE+hint
 *       (la TS llena la tabla, los benefits NO inyectan en celdas).
 *
 *   D-3 "Cumplimiento PEA" (§XV): adherenceRate es hint visible. NUNCA
 *       hubo valor inyectable (85% → "Cumple" sería inferencia). Era bug
 *       de mi clasificación inicial. RECLASIFICADO a NONE+hint.
 *
 *   D-4 "Servicios recibidos" (§XVI): NONE+hint. Cero "roles del HQ".
 *       referenceData = hasHospice + externalServicesActiveCount (señales
 *       per-residente reales).
 *
 *   D-5 (Extensión de la regla, 10-jun): la lógica de D-2/D-3/D-4 aplica
 *       también a §XI Dependencia, §XII Alimentación, §XIII Piel — todos
 *       inferencias clínicas, RECLASIFICADOS a NONE+hint. §XII se incluye
 *       por consistencia: el enum DietTexture (REGULAR/BLANDA/MAJADA/PUREE/
 *       LICUADO/LIQUIDOS_CLAROS/PEG) NO mapea 1:1 a las 5 opciones del form
 *       (Regular/Blanderizada/Líquida/Naso/Gastro) — MAJADA, LICUADO,
 *       LIQUIDOS_CLAROS, PEG requieren inferencia de la TS.
 *
 * ─── DECISIÓN LEGAL: apoderado vs tutor (FLAG PARA FASE 2) ──────────────
 *
 *   Estado actual del binding (v1):
 *     - Campo Prisma `FamilyMember.isLegalGuardian` → bindeado a "Apoderado"
 *     - Campo Prisma `FamilyMember.relationship` (string "Tutor") → bindeado a "Tutor"
 *
 *   Conflicto semántico: en inglés, "Legal Guardian" = tutor/guardián, no
 *   apoderado. Pero en el form MFR (y en práctica legal en PR) son
 *   conceptos LEGALMENTE distintos:
 *     - Apoderado: ejerce poder otorgado por el residente (poder notarial)
 *     - Tutor legal: designado por tribunal cuando residente no tiene capacidad
 *
 *   En v1 funciona: `isLegalGuardian` = apoderado, string "Tutor" = tutor.
 *   Pero EL NOMBRE DEL FLAG miente respecto a su semántica.
 *
 *   🚩 FASE 2 (al construir UI de captura de familiares) LOCK la semántica:
 *     Opción A: Renombrar Prisma `isLegalGuardian` → `isLegalRepresentative`
 *               (más neutral, aplica a apoderado). Mantener binding actual.
 *     Opción B: Flippear el binding — `isLegalGuardian` se usa para Tutor
 *               (semánticamente correcto en EN); agregar nuevo flag
 *               `isLegalRepresentative` o usar relationship para apoderado.
 *
 *   No se decide hoy. Pero la UI de Fase 2 debe escoger UNA y el template,
 *   el flag y el label tienen que decir lo MISMO. Apoderado ≠ tutor en un
 *   documento legal.
 *
 * ─── Campos faltantes en Patient/HQ ─────────────────────────────────────
 *
 *   - admissionDate, maritalStatus, religion, birthCity en Patient: ya
 *     añadidos en schema (Paso 1). Vacíos para residentes legacy hasta que
 *     se capturen manualmente en el perfil. Si null, sale en blanco.
 *   - licenseNumber, address en Headquarters: ya añadidos. Para el PDF
 *     del Paso 6 en el membrete; null → sale en blanco.
 *   - User.collegiateNumber para firma TS: snapshot en SWEvaluation al firmar.
 */

import type { SWFormTemplateSchema } from '../template-types';

export const INITIAL_MFR_TEMPLATE_NAME = 'Evaluación Psicosocial Inicial';
export const INITIAL_MFR_TEMPLATE_VERSION = 1;

export const INITIAL_MFR_TEMPLATE_V1: SWFormTemplateSchema = {
    schemaVersion: 1,
    sections: [
        // ─── I ────────────────────────────────────────────────────────────
        {
            key: 'identificacion',
            order: 1,
            title: 'I. Información Personal',
            fields: [
                { key: 'name',           label: 'Nombre',                 type: 'text', prefillMode: 'READ_ONLY', prefillFrom: 'Patient.name' },
                { key: 'age',            label: 'Edad',                   type: 'text', prefillMode: 'READ_ONLY', prefillFrom: 'computed:age_from_dob' },
                { key: 'dateOfBirth',    label: 'Fecha de nacimiento',    type: 'date', prefillMode: 'READ_ONLY', prefillFrom: 'Patient.dateOfBirth' },
                { key: 'birthCity',      label: 'Pueblo de nacimiento',   type: 'text', prefillMode: 'READ_ONLY', prefillFrom: 'Patient.birthCity',
                  notes: 'Campo nuevo del Paso 1. Vacío para residentes legacy hasta que se capture en el perfil.' },
                { key: 'residenceCity',  label: 'Pueblo de residencia',   type: 'text', prefillMode: 'READ_ONLY', prefillFrom: 'Patient.address',
                  notes: 'Es la dirección completa pre-admisión. Parsear pueblo es opcional en la UI.' },
                { key: 'maritalStatus',  label: 'Estado civil',           type: 'single_select', options: ['Soltero', 'Casado', 'Divorciado', 'Viudo'],
                  prefillMode: 'READ_ONLY', prefillFrom: 'Patient.maritalStatus',
                  notes: 'Campo nuevo. Si vacío, la TS lo captura en el perfil del residente (no en esta eval). Fase 2 puede agregar write-back si hace falta.' },
                { key: 'religion',       label: 'Religión',               type: 'text', prefillMode: 'READ_ONLY', prefillFrom: 'Patient.religion',
                  notes: 'Campo nuevo. Free-form (alta variabilidad en PR).' },
                { key: 'admissionDate',  label: 'Fecha de admisión',      type: 'date', prefillMode: 'READ_ONLY', prefillFrom: 'Patient.admissionDate',
                  notes: 'Campo nuevo. Distinto de createdAt (fecha en BD).' },
            ],
        },

        // ─── II ───────────────────────────────────────────────────────────
        {
            key: 'procedencia',
            order: 2,
            title: 'II. Lugar de Procedencia',
            fields: [
                { key: 'placeOfOrigin', label: 'Lugar de procedencia', type: 'single_select', prefillMode: 'NONE',
                  options: [
                      'Hospital',
                      'Hospital psiquiátrico',
                      'Rehabilitación',
                      'Institución de Cuido Prolongado',
                      'Residencia',
                      'Residencia de familiar',
                      'Égida',
                  ],
                },
            ],
        },

        // ─── III ──────────────────────────────────────────────────────────
        {
            key: 'directrices',
            order: 3,
            title: 'III. Directrices',
            fields: [
                { key: 'advanceDirectives',     label: 'Directrices anticipadas', type: 'single_select', options: ['Sí', 'No'], prefillMode: 'NONE' },
                { key: 'deliveredCopy',         label: 'Entregó copia',           type: 'single_select', options: ['Sí', 'No'], prefillMode: 'NONE' },
            ],
        },

        // ─── IV ───────────────────────────────────────────────────────────
        {
            key: 'salud_mental_dx',
            order: 4,
            title: 'IV. Condiciones de Salud Física, Mental, Hx Psiquiátricas',
            fields: [
                { key: 'orientation', label: 'Orientación', type: 'single_select',
                  options: ['Orientado', 'Desorientado', 'Intervalos', 'No se puede evaluar'],
                  prefillMode: 'NONE',
                  notes: 'GAP cerrado (decisión C en chat 10-jun): el mapeo original pedía REFERENCE desde IntakeData.cognitiveLevel, pero ese campo NO existe en el schema. Orientación / estado mental es valoración propia de la TS — sin hint clínico, igual que el resto del bloque mental (esferas, etc.). PROPAGAR este mismo fix a Seguimiento §I cuando se siembre esa plantilla (mismo gap, misma resolución). Si en el futuro se identifica una fuente real (p.ej. LifePlan.cognitiveLevel — verificar antes), se promueve a REFERENCE en una v2 del template, NO se crea columna vacía nueva.' },
                { key: 'spheres',     label: 'Esferas',  type: 'checkbox_group',
                  options: ['Persona', 'Tiempo', 'Lugar', 'Espacio'], prefillMode: 'NONE' },
                { key: 'diagnoses',   label: 'Diagnósticos (DX)', type: 'narrative',
                  prefillMode: 'READ_ONLY', prefillFrom: 'IntakeData.diagnoses',
                  notes: 'Display-only: muestra el texto libre de diagnoses del intake.' },
                { key: 'observations', label: 'Observaciones', type: 'narrative', prefillMode: 'NONE' },
            ],
        },

        // ─── V ────────────────────────────────────────────────────────────
        {
            key: 'comunicacion',
            order: 5,
            title: 'V. Comunicación',
            fields: [
                { key: 'communication', label: 'Comunicación', type: 'checkbox_group',
                  options: ['Sordo', 'Mudo', 'No verbaliza', 'Dificultad para verbalizar'],
                  prefillMode: 'NONE' },
                { key: 'observations',  label: 'Observaciones', type: 'narrative', prefillMode: 'NONE' },
            ],
        },

        // ─── VI ───────────────────────────────────────────────────────────
        {
            key: 'educacion_ocupacion',
            order: 6,
            title: 'VI. Nivel de Educación / Historial Ocupacional',
            fields: [
                { key: 'educationLevel', label: 'Nivel educativo', type: 'checkbox_group',
                  options: [
                      'Escuela Elemental', 'Intermedia', 'Superior', 'Universidad',
                      'Bachillerato', 'Maestría', 'Doctorado', 'No completó estudios',
                  ],
                  prefillMode: 'NONE' },
                { key: 'occupation',     label: 'Ocupación',     type: 'text',      prefillMode: 'NONE' },
                { key: 'observations',   label: 'Observaciones', type: 'narrative', prefillMode: 'NONE' },
            ],
        },

        // ─── VII ──────────────────────────────────────────────────────────
        {
            key: 'estilo_vida',
            order: 7,
            title: 'VII. Estilo de Vida Actual y Pasatiempo',
            fields: [
                { key: 'lifestyleAndHobbies', label: 'Estilo de vida y pasatiempo', type: 'narrative', prefillMode: 'NONE' },
            ],
        },

        // ─── VIII ─────────────────────────────────────────────────────────
        {
            key: 'aspecto_fisico',
            order: 8,
            title: 'VIII. Aspecto Físico',
            fields: [
                { key: 'physicalAppearance', label: 'Aspecto físico', type: 'checkbox_group',
                  options: ['Aseado', 'Poca higiene', 'Vestimenta adecuada'],
                  prefillMode: 'NONE' },
            ],
        },

        // ─── IX ───────────────────────────────────────────────────────────
        {
            key: 'composicion_familiar',
            order: 9,
            title: 'IX. Composición Familiar',
            fields: [
                { key: 'familyMembers', label: 'Familiares', type: 'table',
                  prefillMode: 'READ_ONLY', prefillFrom: 'family.members',
                  notes: '🚩 FASE 2 FLAG: el label "¿Apoderado?" mapea al Prisma flag isLegalGuardian. Decisión semántica pendiente (ver header del archivo).',
                  columns: [
                      { key: 'name',            label: 'Nombre',      type: 'text' },
                      { key: 'relationship',    label: 'Parentesco',  type: 'text' },
                      { key: 'address',         label: 'Dirección',   type: 'text' },
                      { key: 'phone',           label: 'Teléfono',    type: 'text' },
                      { key: 'email',           label: 'Email',       type: 'text' },
                      { key: 'isLegalGuardian', label: '¿Apoderado?', type: 'boolean' },
                      { key: 'isPrimary',       label: '¿Principal?', type: 'boolean' },
                  ],
                },
                { key: 'patientRepresentative', label: 'Representante del paciente', type: 'text',
                  prefillMode: 'READ_ONLY', prefillFrom: 'family.members[isPrimary]',
                  notes: 'Nombre del FamilyMember con isPrimary=true.' },
                { key: 'legalGuardian',         label: 'Apoderado legal', type: 'text',
                  prefillMode: 'READ_ONLY', prefillFrom: 'family.members[isLegalGuardian]',
                  notes: '🚩 FASE 2 FLAG: el campo del form se llama "Apoderado legal" pero bindea al Prisma flag isLegalGuardian (semánticamente tutor/guardián en inglés). Decisión legal pendiente — ver header del archivo (Opción A: renombrar flag; Opción B: flippear binding). En v1, la convención es: isLegalGuardian = apoderado.' },
                { key: 'legalTutor',            label: 'Tutor legal', type: 'text',
                  prefillMode: 'REFERENCE', prefillFrom: 'family.members[relationship~=Tutor]',
                  notes: 'D-1: único campo REFERENCE-inyecta puro del template. Inyecta el NOMBRE del FamilyMember con relationship~=Tutor (string-match case-insensitive). NO existe flag estructurado. La TS lo puede editar.' },
                { key: 'profession',            label: 'Profesión',       type: 'text', prefillMode: 'NONE' },
                { key: 'workplace',             label: 'Lugar de trabajo', type: 'text', prefillMode: 'NONE' },
            ],
        },

        // ─── X ────────────────────────────────────────────────────────────
        {
            key: 'datos_economicos',
            order: 10,
            title: 'X. Datos Económicos',
            fields: [
                { key: 'incomeSources', label: 'Fuentes de ingreso', type: 'table',
                  prefillMode: 'NONE', prefillFrom: 'socialWork.benefits',
                  notes: 'D-2: NONE+hint. SocialWorkBenefit[] del residente aparecen como referenceData visible (hint), pero NO auto-llenan celdas $. La TS llena la tabla manualmente. Mapear benefit.type → fila del form es inferencia (ej. SNAP → "PAN", PENSION → ¿retiro gob., empresa priv., viudo, veterano?).',
                  rows: [
                      'Tutor del SS',
                      'Pensión (Retiro Gob.)',
                      'Pensión (Empresa Priv.)',
                      'Pensión (Viudo)',
                      'Pensión (Veterano)',
                      'Renta Propiedad',
                      'Ahorros',
                      'PAN',
                      'TANF',
                      'Ayuda Depto. Familia',
                      'Aportación Familiar',
                      'Otras',
                  ],
                  columns: [
                      { key: 'concept', label: 'Concepto',  type: 'text'     },
                      { key: 'amount',  label: 'Cantidad',  type: 'currency' },
                  ],
                },
                { key: 'refusedToProvide', label: 'Rehusó brindar información', type: 'single_select',
                  options: ['Sí', 'No'], prefillMode: 'NONE' },
                { key: 'observations',     label: 'Observaciones', type: 'narrative', prefillMode: 'NONE' },
            ],
        },

        // ─── XI ───────────────────────────────────────────────────────────
        {
            key: 'dependencia_fisica',
            order: 11,
            title: 'XI. Nivel de Dependencia Física',
            fields: [
                { key: 'physicalDependence', label: 'Dependencia física', type: 'single_select',
                  options: [
                      'Independiente',
                      'Necesidad de asistencia personal',
                      'Dependiente total',
                      'Utiliza equipo',
                  ],
                  prefillMode: 'NONE', prefillFrom: 'patient.dependenceContext',
                  notes: 'D-5: NONE+hint. referenceData expone avdScore + mobilityLevel como contexto. Mapear AVD=3 → checkbox específico es inferencia clínica que hace la TS.' },
                { key: 'observations', label: 'Observaciones', type: 'narrative', prefillMode: 'NONE' },
            ],
        },

        // ─── XII ──────────────────────────────────────────────────────────
        {
            key: 'alimentacion',
            order: 12,
            title: 'XII. Alimentación',
            fields: [
                { key: 'feedingMode', label: 'Alimentación', type: 'checkbox_group',
                  options: ['Regular', 'Blanderizada', 'Líquida', 'Naso', 'Gastro'],
                  prefillMode: 'NONE', prefillFrom: 'patient.dietContext',
                  notes: 'D-5: NONE+hint por decisión de consistencia. El enum DietTexture (7 vals) NO mapea 1:1 al form (5 opciones): MAJADA, LICUADO, LIQUIDOS_CLAROS, PEG requieren inferencia (PEG = Naso o Gastro? depende del tubo real). referenceData expone dietTexture + 4 flags como contexto; la TS marca.' },
                { key: 'observations', label: 'Observaciones', type: 'narrative', prefillMode: 'NONE' },
            ],
        },

        // ─── XIII ─────────────────────────────────────────────────────────
        {
            key: 'condiciones_piel',
            order: 13,
            title: 'XIII. Condiciones Tópicas (piel)',
            fields: [
                { key: 'skinConditions', label: 'Condiciones tópicas', type: 'checkbox_group',
                  options: [
                      'Úlceras', 'Hongos', 'Área de presión', 'Laceración',
                      'Alergias', 'Sensitiva', 'Reseca', 'Condición',
                      'Scavis', 'Infecciones', 'Otros', 'Ninguna',
                  ],
                  prefillMode: 'NONE', prefillFrom: 'pressureUlcer.active',
                  notes: 'D-5: NONE+hint. UPP activa es UN dato; la TS valora todas las condiciones tópicas (incluyendo si hay hongos, alergias, etc. que no están en PressureUlcer). referenceData = lista de UPP activas como contexto.' },
                { key: 'observations', label: 'Observaciones', type: 'narrative', prefillMode: 'NONE' },
            ],
        },

        // ─── XIV ──────────────────────────────────────────────────────────
        {
            key: 'tratamiento_piel',
            order: 14,
            title: 'XIV. Tratamiento Condiciones de la Piel',
            fields: [
                { key: 'skinTreatment', label: 'Tratamiento piel', type: 'checkbox_group',
                  options: ['Home Care', 'Referido a evaluación'], prefillMode: 'NONE' },
                { key: 'observations',  label: 'Observaciones', type: 'narrative', prefillMode: 'NONE' },
            ],
        },

        // ─── XV ───────────────────────────────────────────────────────────
        {
            key: 'cumplimiento_tratamiento',
            order: 15,
            title: 'XV. Cumplimiento al Tratamiento Médico Ordenado',
            fields: [
                { key: 'compliancePEA', label: 'Cumplimiento (PEA)', type: 'single_select',
                  options: ['Cumple', 'No cumple', 'Rehúsa'],
                  prefillMode: 'NONE', prefillFrom: 'emar.adherenceRate',
                  notes: 'D-3 (corregido): adherenceRate (0-100%) NUNCA fue inyectable — 85% → "Cumple" sería inferencia. NONE+hint: el resolver expone el % como referenceData ("Adherencia esta semana: 85%, 12 dosis"). La TS marca su criterio clínico.' },
                { key: 'complianceFamily', label: 'Cumplimiento (Familiar)', type: 'checkbox_group',
                  options: ['Adeuda balance', 'Se opone', 'Refiere contraindicación'],
                  prefillMode: 'NONE' },
                { key: 'observations', label: 'Observaciones', type: 'narrative', prefillMode: 'NONE' },
            ],
        },

        // ─── XVI ──────────────────────────────────────────────────────────
        {
            key: 'servicios_recibidos',
            order: 16,
            title: 'XVI. Servicios que Recibe en la Institución',
            fields: [
                { key: 'servicesReceived', label: 'Servicios recibidos', type: 'checkbox_group',
                  options: [
                      'Médico/Generalista', 'Enfermero', 'Psiquiatra',
                      'Trabajador Social', 'Sicólogo', 'Terapias Físicas',
                      'Home Care', 'Dermatólogo', 'Terapia ocupacional',
                      'Hospicio', 'Podiatra', 'Terapia recreativa', 'Otros',
                  ],
                  prefillMode: 'NONE', prefillFrom: 'patient.servicesContext',
                  notes: 'D-4: NONE+hint. Cero "roles del HQ". referenceData expone solo data PER-RESIDENTE real: hasHospice (Patient.hospiceStartDate != null), externalServicesActiveCount (ExternalServiceVisitPatient activos). El resto de opciones (13 total) las marca la TS manualmente.' },
                { key: 'observations', label: 'Observaciones', type: 'narrative', prefillMode: 'NONE' },
            ],
        },

        // ─── XVII ─────────────────────────────────────────────────────────
        {
            key: 'referidos',
            order: 17,
            title: 'XVII. Referidos',
            fields: [
                { key: 'referralMade', label: '¿Se realiza algún referido?', type: 'single_select',
                  options: ['Sí', 'No'], prefillMode: 'NONE' },
                { key: 'observations', label: 'Observaciones', type: 'narrative', prefillMode: 'NONE' },
            ],
        },
    ],
};
