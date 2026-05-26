/**
 * src/lib/family/congruence.ts
 *
 * CHOKEPOINT — capa de congruencia familiar.
 *
 * PRINCIPIO RECTOR: "congruente o nada."
 * Ninguna superficie familiar (digest, momentos, dashboard, feed, comms) genera
 * contenido que contradiga la realidad clínica/funcional del residente. Si no
 * hay nada congruente y cierto que decir, no se dice nada.
 *
 * FUENTES DE LA VERDAD (no duplicamos campos):
 *   - Alimentación: Patient.diet (string libre) — heurística conservadora.
 *     Solo Patient.careModality es columna nueva.
 *   - Movilidad: LifePlan.mobility (más reciente) → IntakeData.mobilityLevel
 *     como fallback. Vocabulario existente: INDEPENDENT|ASSISTED|WHEELCHAIR|BEDRIDDEN.
 *   - Modalidad: Patient.careModality (NONE|PALLIATIVE|HOSPICE) — único campo nuevo.
 *
 * Patrón espejo de src/lib/family/disclosure.ts (LIFESTYLE/FULL gating).
 */

// ─── Tipos públicos (string-literal unions, no Prisma enums) ───────────────
// FeedingMethod y MobilityStatus son TIPOS del chokepoint — derivados de
// strings existentes, no persistidos como columnas. Esto evita duplicación.

export type FeedingMethod = 'ORAL' | 'PEG' | 'NPO';
export type MobilityStatus = 'AMBULATORY' | 'ASSISTED' | 'WHEELCHAIR' | 'BEDRIDDEN';
export type CareModality = 'NONE' | 'PALLIATIVE' | 'HOSPICE';

export type FamilyCareState =
    | 'ACTIVE'      // En el hogar, cuidado regular
    | 'HOSPITAL'    // status=TEMPORARY_LEAVE + leaveType=HOSPITAL
    | 'AWAY'        // status=TEMPORARY_LEAVE + leaveType ∈ {FAMILY_VISIT, OTHER, DIALYSIS}
    | 'PALLIATIVE'  // status=ACTIVE + careModality=PALLIATIVE (tono reservado)
    | 'HOSPICE'     // status=ACTIVE + careModality=HOSPICE (cero highlights)
    | 'DISCHARGED'  // Egresado permanentemente
    | 'DECEASED';   // Falleció — lockdown total

export interface CongruenceConstraints {
    allowOralFood: boolean;
    allowActivityMention: boolean;
    profileTags: string[];
    reasons: string[];
    /** Valores derivados para diagnóstico (no se usan en lógica). */
    derivedFeedingMethod: FeedingMethod;
    derivedMobilityStatus: MobilityStatus;
}

export interface FamilyContentPolicy {
    state: FamilyCareState;
    constraints: CongruenceConstraints;
    allowAutoDigest:      boolean;
    allowAutoMoments:     boolean;
    allowFeedAggregation: 'full' | 'historical' | 'none';
    allowStaffMoment:     boolean;
    allowStaffBroadcast:  boolean;
    allowAppointment:     'full' | 'visit_only' | 'none';
    dashboardMode:        'normal' | 'paused' | 'gentle' | 'farewell' | 'memorial';
    bannerCopy: string | null;
}

// ─── Input del chokepoint: el GRAFO, no solo Patient ───────────────────────

/**
 * Forma mínima del paciente + relaciones que el chokepoint necesita. Cualquier
 * fetch Prisma debe usar PATIENT_CONGRUENCE_INCLUDE (más abajo) para que la
 * data llegue completa. La precedencia es:
 *   - feeding: derivado de patient.diet (única fuente, ya poblada al 100%)
 *   - mobility: lifePlan.mobility (más reciente) → intakeData.mobilityLevel
 *   - modality: patient.careModality (campo persistido en Patient)
 */
export interface CongruencePatientInput {
    name?: string | null;
    status?: 'ACTIVE' | 'DISCHARGED' | 'DECEASED' | 'TEMPORARY_LEAVE' | null;
    leaveType?: 'HOSPITAL' | 'FAMILY_VISIT' | 'DIALYSIS' | 'OTHER' | null;
    diet?: string | null;
    careModality?: 'NONE' | 'PALLIATIVE' | 'HOSPICE' | null;
    intakeData?: { mobilityLevel?: string | null } | null;
    /** Pasar el LifePlan más reciente del paciente (cualquier status). El que
     *  exista. Si hay APPROVED y DRAFT, mandar el más reciente — la lógica
     *  arriba ya decide el ordenamiento. */
    lifePlans?: Array<{ mobility?: string | null; updatedAt?: Date | null; status?: string | null }>;
}

/**
 * Include fragment para fetches Prisma. Patient + intakeData + 1 LifePlan
 * más reciente. Cualquier ruta que vaya a pasar al chokepoint debe usar esto.
 *
 * Ejemplo:
 *   const patient = await prisma.patient.findUnique({
 *     where: { id },
 *     include: PATIENT_CONGRUENCE_INCLUDE,
 *   });
 *   const policy = getFamilyContentPolicy(patient);
 */
export const PATIENT_CONGRUENCE_INCLUDE = {
    intakeData: { select: { mobilityLevel: true } },
    lifePlans: {
        orderBy: { updatedAt: 'desc' as const },
        take: 1,
        select: { mobility: true, updatedAt: true, status: true },
    },
} as const;

/**
 * Para queries que ya hacen `select` explícito (no include), añade estos campos
 * del propio Patient además del bloque de relaciones de arriba.
 */
export const PATIENT_CONGRUENCE_SELECT = {
    status: true,
    leaveType: true,
    diet: true,
    careModality: true,
} as const;

// ─── Derivadores: alimentación desde diet, movilidad desde LP/Intake ───────

/**
 * Heurística para derivar feeding method de Patient.diet (texto libre).
 * CONSERVADORA: ante CUALQUIER ambigüedad → no-oral.
 * Asimetría: falso "no menciona comida" es inofensivo; falso "comió bien" es el daño.
 */
const PEG_KEYWORDS = [
    'peg', 'p.e.g.', 'p e g',
    'sonda', 'tubo', 'g-tube', 'g tube', 'gtube',
    'gastrostomía', 'gastrostomia', 'gastrostomy',
    'enteral', 'enteric',
    'nasogastr', 'ng tube',  // sonda nasogástrica
    'jejunostom', 'j-tube',
    // Marcas de fórmula enteral — si el residente recibe una de estas como
    // dieta, es señal fuerte de alimentación por sonda. El panel de
    // verificación del perfil es el backstop humano para marcas exóticas.
    'jevity', 'glucerna', 'osmolite', 'nepro',
    'isosource', 'pulmocare', 'fibersource', 'vital',
];

const NPO_KEYWORDS = [
    'npo', 'n.p.o.', 'n p o',
    'nada por boca',
    'nil per os',
    'nothing by mouth',
];

export function derivedFeedingMethod(diet: string | null | undefined): FeedingMethod {
    if (!diet || !diet.trim()) {
        // Sin dato → conservador. Tratamos como NO oral para no asumir nada.
        return 'NPO';
    }
    const lower = diet.toLowerCase();
    if (NPO_KEYWORDS.some((kw) => lower.includes(kw))) return 'NPO';
    if (PEG_KEYWORDS.some((kw) => lower.includes(kw))) return 'PEG';
    return 'ORAL';
}

/**
 * Mapeo del vocabulario string (Intake/LifePlan usan INDEPENDENT, ASSISTED,
 * WHEELCHAIR, BEDRIDDEN) al enum TS del chokepoint.
 *
 * INDEPENDENT y AMBULATORY son el mismo concepto — usamos AMBULATORY como
 * label canónico del chokepoint (más legible para copy familiar).
 *
 * Conservador: cualquier string que no reconozcamos → no permitir mención de
 * actividad (mapeamos a BEDRIDDEN para apagar el flag, no para etiquetar).
 * Bueno saber que es desconocido — pero en duda, no mentir.
 */
export function derivedMobilityStatus(raw: string | null | undefined): MobilityStatus {
    if (!raw || !raw.trim()) {
        // Sin dato → asumimos lo más restrictivo (no permitir actividad).
        return 'BEDRIDDEN';
    }
    const v = raw.trim().toUpperCase();
    if (v === 'INDEPENDENT' || v === 'AMBULATORY') return 'AMBULATORY';
    if (v === 'ASSISTED' || v === 'WALKING_WITH_AID' || v === 'WITH_AID') return 'ASSISTED';
    if (v === 'WHEELCHAIR' || v === 'SILLA' || v === 'SILLA_DE_RUEDAS') return 'WHEELCHAIR';
    if (v === 'BEDRIDDEN' || v === 'ENCAMADO' || v === 'BED-BOUND' || v === 'BEDBOUND') return 'BEDRIDDEN';
    // Valor desconocido → conservador.
    return 'BEDRIDDEN';
}

/**
 * Resolver de movilidad efectiva del paciente con precedencia
 * `LifePlan.mobility (más reciente) > IntakeData.mobilityLevel`.
 * El caller pasa `lifePlans` ya ordenado desc por updatedAt (take:1).
 */
export function resolveEffectiveMobility(input: CongruencePatientInput): MobilityStatus {
    const latestLp = input.lifePlans?.[0];
    if (latestLp?.mobility && latestLp.mobility.trim()) {
        return derivedMobilityStatus(latestLp.mobility);
    }
    return derivedMobilityStatus(input.intakeData?.mobilityLevel);
}

// ─── Resolutores ───────────────────────────────────────────────────────────

export function resolveFamilyCareState(p: CongruencePatientInput | null | undefined): FamilyCareState {
    if (!p) return 'ACTIVE';
    if (p.status === 'DECEASED') return 'DECEASED';
    if (p.status === 'DISCHARGED') return 'DISCHARGED';
    if (p.status === 'TEMPORARY_LEAVE') {
        if (p.leaveType === 'HOSPITAL') return 'HOSPITAL';
        return 'AWAY';
    }
    if (p.careModality === 'HOSPICE') return 'HOSPICE';
    if (p.careModality === 'PALLIATIVE') return 'PALLIATIVE';
    return 'ACTIVE';
}

export function getCongruenceConstraints(p: CongruencePatientInput | null | undefined): CongruenceConstraints {
    const safe = p ?? {};
    const feeding = derivedFeedingMethod(safe.diet);
    const mobility = resolveEffectiveMobility(safe);

    const allowOralFood = feeding === 'ORAL';
    const allowActivityMention = mobility !== 'BEDRIDDEN';

    const profileTags: string[] = [];
    const reasons: string[] = [];

    if (feeding === 'PEG') {
        profileTags.push('se alimenta por sonda PEG');
        reasons.push(`derivedFeedingMethod=PEG (diet="${safe.diet}")`);
    } else if (feeding === 'NPO') {
        profileTags.push('está en NPO (nada por boca)');
        reasons.push(`derivedFeedingMethod=NPO (diet="${safe.diet ?? '(vacío)'}")`);
    }

    if (mobility === 'BEDRIDDEN') {
        profileTags.push('está encamado');
        reasons.push(`mobility=BEDRIDDEN`);
    } else if (mobility === 'WHEELCHAIR') {
        profileTags.push('usa silla de ruedas');
        reasons.push(`mobility=WHEELCHAIR`);
    } else if (mobility === 'ASSISTED') {
        profileTags.push('camina con asistencia');
        reasons.push(`mobility=ASSISTED`);
    }

    if (safe.careModality === 'HOSPICE') {
        profileTags.push('está en hospicio');
        reasons.push('careModality=HOSPICE');
    } else if (safe.careModality === 'PALLIATIVE') {
        profileTags.push('está en cuidado paliativo');
        reasons.push('careModality=PALLIATIVE');
    }

    return {
        allowOralFood,
        allowActivityMention,
        profileTags,
        reasons,
        derivedFeedingMethod: feeding,
        derivedMobilityStatus: mobility,
    };
}

export function getFamilyContentPolicy(p: CongruencePatientInput | null | undefined): FamilyContentPolicy {
    const state = resolveFamilyCareState(p);
    const constraints = getCongruenceConstraints(p);
    const name = p?.name?.trim() || 'su familiar';

    switch (state) {
        case 'ACTIVE':
            return { state, constraints,
                allowAutoDigest: true, allowAutoMoments: true,
                allowFeedAggregation: 'full',
                allowStaffMoment: true, allowStaffBroadcast: true,
                allowAppointment: 'full',
                dashboardMode: 'normal', bannerCopy: null };
        case 'HOSPITAL':
            return { state, constraints,
                allowAutoDigest: false, allowAutoMoments: false,
                allowFeedAggregation: 'none',
                allowStaffMoment: false, allowStaffBroadcast: false,
                allowAppointment: 'none',
                dashboardMode: 'paused',
                bannerCopy: `Estamos al pendiente de ${name}, esperamos que todo esté bien. Recuerde mantenernos informados.` };
        case 'AWAY':
            return { state, constraints,
                allowAutoDigest: false, allowAutoMoments: false,
                allowFeedAggregation: 'historical',
                allowStaffMoment: true, allowStaffBroadcast: true,
                allowAppointment: 'full',
                dashboardMode: 'paused',
                bannerCopy: `${name} está fuera de la residencia por unas horas. Te avisaremos cuando regrese.` };
        case 'HOSPICE':
            return { state, constraints,
                allowAutoDigest: false, allowAutoMoments: false,
                allowFeedAggregation: 'historical',
                allowStaffMoment: true, allowStaffBroadcast: false,
                allowAppointment: 'visit_only',
                dashboardMode: 'gentle',
                bannerCopy: `${name} está cómoda y bien acompañada. El equipo está atento. Llámanos cuando nos necesites.` };
        case 'PALLIATIVE':
            return { state, constraints,
                allowAutoDigest: true, allowAutoMoments: false,
                allowFeedAggregation: 'full',
                allowStaffMoment: true, allowStaffBroadcast: true,
                allowAppointment: 'full',
                dashboardMode: 'gentle', bannerCopy: null };
        case 'DISCHARGED':
            return { state, constraints,
                allowAutoDigest: false, allowAutoMoments: false,
                allowFeedAggregation: 'none',
                allowStaffMoment: false, allowStaffBroadcast: false,
                allowAppointment: 'none',
                dashboardMode: 'farewell', bannerCopy: null };
        case 'DECEASED':
            return { state, constraints,
                allowAutoDigest: false, allowAutoMoments: false,
                allowFeedAggregation: 'none',
                allowStaffMoment: false, allowStaffBroadcast: false,
                allowAppointment: 'none',
                dashboardMode: 'memorial', bannerCopy: null };
    }
}

// ─── Filtrado de inputs ────────────────────────────────────────────────────

export interface FamilyGenerationInput {
    foodIntake?: number | null;
    foodBand?: 'bien' | 'parcial' | 'poco' | null;
    activityNote?: string | null;
    wellnessNotes?: string[] | null;
    [key: string]: unknown;
}

export function filterCongruentInputs<T extends FamilyGenerationInput>(
    p: CongruencePatientInput,
    raw: T,
): T {
    const c = getCongruenceConstraints(p);
    const out: T = { ...raw };
    if (!c.allowOralFood) { out.foodIntake = null; out.foodBand = null; }
    if (!c.allowActivityMention) { out.activityNote = null; }
    return out;
}

const ACTIVITY_KEYWORDS = [
    'caminó', 'caminando', 'caminar',
    'salió', 'salida', 'paseo', 'paseó',
    'participó', 'participación', 'participando',
    'actividad', 'actividades',
    'jugó', 'jugando',
    'bailó', 'bailando',
    'levantó', 'sentó', 'sentada en silla',
];

export function noteMentionsActivity(note: string): boolean {
    const n = note.toLowerCase();
    return ACTIVITY_KEYWORDS.some((kw) => n.includes(kw));
}

const FOOD_KEYWORDS = [
    'comió', 'come', 'comida', 'comiendo',
    'desayunó', 'desayuno',
    'almorzó', 'almuerzo',
    'cenó', 'cena',
    'merendó', 'merienda',
    'apetito',
    'sabor', 'sabores',
    'plato',
    'masticó', 'masticando',
    'tragó', 'tragando',
    'saboreó', 'saboreaba',
];

export function noteMentionsFood(note: string): boolean {
    const n = note.toLowerCase();
    return FOOD_KEYWORDS.some((kw) => n.includes(kw));
}

export function filterCongruentNotes(
    p: CongruencePatientInput,
    notes: string[],
): string[] {
    const c = getCongruenceConstraints(p);
    return notes.filter((n) => {
        if (!c.allowOralFood && noteMentionsFood(n)) return false;
        if (!c.allowActivityMention && noteMentionsActivity(n)) return false;
        return true;
    });
}

// ─── Reglas duras para prompts de IA ───────────────────────────────────────

export function buildCongruentPromptRules(p: CongruencePatientInput): string {
    const c = getCongruenceConstraints(p);
    const state = resolveFamilyCareState(p);
    const lines: string[] = [];

    lines.push('REGLAS DURAS DE CONGRUENCIA — son inquebrantables:');

    if (!c.allowOralFood) {
        const reason = c.derivedFeedingMethod === 'PEG'
            ? 'se alimenta por sonda gástrica (PEG)'
            : 'está en NPO (nada por boca)';
        lines.push(`- Este residente ${reason}. NUNCA menciones comida, comidas, desayuno, almuerzo, cena, apetito, sabores, "comió", "disfrutó" relacionado a alimentos, ni nada similar. Sería falso y cruel.`);
    }
    if (!c.allowActivityMention) {
        lines.push(`- Este residente está encamado. NUNCA menciones actividades, salidas, paseos, "participó", "caminó", levantarse, ni nada que sugiera movilidad. Sería falso.`);
    }
    if (state === 'HOSPICE') {
        lines.push(`- Este residente está en HOSPICIO (cuidado de fin de vida). Tono reservado, cero "highlights" alegres. Nunca uses "¡qué bien!", "disfrutó", "feliz", ni superlativos positivos. Habla de comodidad, calma, acompañamiento.`);
    } else if (state === 'PALLIATIVE') {
        lines.push(`- Este residente está en cuidado paliativo. Tono cálido pero sobrio, sin superlativos alegres.`);
    }

    lines.push('- Solo menciona hechos del contexto recibido. NO inventes. NO uses plantillas alegres genéricas.');
    lines.push('- Si tras estas reglas no queda nada concreto que decir, devuelve cadena vacía. Es mejor el silencio que un mensaje falso.');

    return lines.join('\n');
}

// ─── Verificación final post-generación ────────────────────────────────────

export function verifyCongruentOutput(
    p: CongruencePatientInput,
    text: string | null | undefined,
): string | null {
    if (!text || !text.trim()) return null;
    const c = getCongruenceConstraints(p);
    if (!c.allowOralFood && noteMentionsFood(text)) return null;
    if (!c.allowActivityMention && noteMentionsActivity(text)) return null;
    return text;
}
