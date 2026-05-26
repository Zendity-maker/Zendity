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
 * Patrón espejo de src/lib/family/disclosure.ts (LIFESTYLE/FULL gating) — un
 * solo módulo, todas las superficies lo consultan. Cuando añadas una nueva
 * ruta familiar mañana, importa estos helpers y olvídate del resto.
 *
 * Estructura:
 *   - resolveFamilyCareState(p)       → estado de comunicación (6 valores)
 *   - getCongruenceConstraints(p)     → constraints DUROS del perfil
 *   - getFamilyContentPolicy(p)       → combina ambos en decisiones de alto nivel
 *   - filterCongruentInputs(p, raw)   → quita data de entrada que violaría constraints
 *   - buildCongruentPromptRules(p)    → reglas duras como string para prompts IA
 *   - PATIENT_CONGRUENCE_SELECT       → fragment Prisma para no olvidar campos
 */

// ─── Tipos públicos ────────────────────────────────────────────────────────

/**
 * Estado de comunicación con la familia, derivado de status + leaveType + careModality.
 * No siempre es el "estado clínico" — es el estado relevante para decidir qué se le
 * dice (o no) a la familia.
 */
export type FamilyCareState =
    | 'ACTIVE'      // En el hogar, cuidado regular
    | 'HOSPITAL'    // status=TEMPORARY_LEAVE + leaveType=HOSPITAL
    | 'AWAY'        // status=TEMPORARY_LEAVE + leaveType ∈ {FAMILY_VISIT, OTHER, DIALYSIS}
    | 'PALLIATIVE'  // status=ACTIVE pero careModality=PALLIATIVE (tono reservado)
    | 'HOSPICE'     // status=ACTIVE pero careModality=HOSPICE (cero highlights)
    | 'DISCHARGED'  // Egresado permanentemente
    | 'DECEASED';   // Falleció — lockdown total

/**
 * Constraints DUROS derivados del perfil funcional del residente. Estos NO dependen
 * del estado — son verdades permanentes sobre el residente que ningún generador
 * puede ignorar.
 */
export interface CongruenceConstraints {
    /** ¿Se le puede mencionar comida/alimentación oral? Falso si PEG o NPO. */
    allowOralFood: boolean;
    /** ¿Se le puede mencionar actividad/movilidad/salidas? Falso si BEDRIDDEN. */
    allowActivityMention: boolean;
    /** Etiqueta funcional para prompts: "está encamado", "se alimenta por PEG", etc. */
    profileTags: string[];
    /** Razón corta de por qué cada constraint aplica (para logs/diagnóstico). */
    reasons: string[];
}

/**
 * Política de alto nivel para una superficie familiar. Combina estado +
 * constraints en flags listos para usar.
 */
export interface FamilyContentPolicy {
    state: FamilyCareState;
    constraints: CongruenceConstraints;

    // Generación automatizada
    allowAutoDigest:      boolean;  // Cron family-digest
    allowAutoMoments:     boolean;  // Sugerencias IA de momentos
    allowFeedAggregation: 'full' | 'historical' | 'none';

    // Acciones del staff
    allowStaffMoment:     boolean;  // Aprobar/enviar momento al familiar
    allowStaffBroadcast:  boolean;

    // Acciones del familiar
    allowAppointment:     'full' | 'visit_only' | 'none';

    // UI del dashboard familiar
    dashboardMode:        'normal' | 'paused' | 'gentle' | 'farewell' | 'memorial';

    /** Banner empático para mostrar al familiar. Null si el modo no usa banner. */
    bannerCopy: string | null;
}

// ─── Tipo del input que estos helpers esperan ──────────────────────────────

/**
 * Forma mínima del paciente que estos helpers necesitan. Cualquier fetch
 * Prisma debe incluir PATIENT_CONGRUENCE_SELECT (más abajo) para garantizar
 * que estos campos estén presentes.
 */
export interface CongruencePatientInput {
    name?: string | null;
    status?: 'ACTIVE' | 'DISCHARGED' | 'DECEASED' | 'TEMPORARY_LEAVE' | null;
    leaveType?: 'HOSPITAL' | 'FAMILY_VISIT' | 'DIALYSIS' | 'OTHER' | null;
    feedingMethod?: 'ORAL' | 'PEG' | 'NPO' | null;
    mobilityStatus?: 'AMBULATORY' | 'ASSISTED' | 'WHEELCHAIR' | 'BEDRIDDEN' | null;
    careModality?: 'NONE' | 'PALLIATIVE' | 'HOSPICE' | null;
}

/**
 * Fragment de select Prisma — cualquier query que vaya a pasar el paciente
 * a estos helpers debe incluir esto en su `select`. Es la forma de no olvidar
 * un campo al añadir una superficie nueva.
 *
 *   const patient = await prisma.patient.findUnique({
 *     where: { id },
 *     select: { ...PATIENT_CONGRUENCE_SELECT, name: true, photoUrl: true, ... },
 *   });
 */
export const PATIENT_CONGRUENCE_SELECT = {
    status: true,
    leaveType: true,
    feedingMethod: true,
    mobilityStatus: true,
    careModality: true,
} as const;

// ─── Resolutores ───────────────────────────────────────────────────────────

/**
 * Deriva el estado de comunicación familiar.
 *
 * Precedencia (de más severo a menos):
 *   DECEASED > DISCHARGED > HOSPITAL > AWAY > HOSPICE > PALLIATIVE > ACTIVE
 *
 * HOSPICE/PALLIATIVE sólo aplican si el paciente sigue ACTIVE en el hogar —
 * un hospitalizado en hospicio se reporta como HOSPITAL (la familia ya sabe
 * que está afuera; ese es el dato dominante).
 */
export function resolveFamilyCareState(p: CongruencePatientInput | null | undefined): FamilyCareState {
    if (!p) return 'ACTIVE';

    if (p.status === 'DECEASED') return 'DECEASED';
    if (p.status === 'DISCHARGED') return 'DISCHARGED';

    if (p.status === 'TEMPORARY_LEAVE') {
        if (p.leaveType === 'HOSPITAL') return 'HOSPITAL';
        return 'AWAY';
    }

    // status === 'ACTIVE' (o null por seguridad)
    if (p.careModality === 'HOSPICE') return 'HOSPICE';
    if (p.careModality === 'PALLIATIVE') return 'PALLIATIVE';
    return 'ACTIVE';
}

/**
 * Deriva los constraints duros del perfil funcional. Estos aplican siempre,
 * sin importar el estado — son hechos sobre cómo es el residente HOY.
 */
export function getCongruenceConstraints(p: CongruencePatientInput | null | undefined): CongruenceConstraints {
    const feeding = p?.feedingMethod ?? 'ORAL';
    const mobility = p?.mobilityStatus ?? 'AMBULATORY';

    const allowOralFood = feeding === 'ORAL';
    const allowActivityMention = mobility !== 'BEDRIDDEN';

    const profileTags: string[] = [];
    const reasons: string[] = [];

    if (feeding === 'PEG') {
        profileTags.push('se alimenta por sonda PEG');
        reasons.push('feedingMethod=PEG');
    } else if (feeding === 'NPO') {
        profileTags.push('está en NPO (nada por boca)');
        reasons.push('feedingMethod=NPO');
    }

    if (mobility === 'BEDRIDDEN') {
        profileTags.push('está encamado');
        reasons.push('mobilityStatus=BEDRIDDEN');
    } else if (mobility === 'WHEELCHAIR') {
        profileTags.push('usa silla de ruedas');
        reasons.push('mobilityStatus=WHEELCHAIR');
    } else if (mobility === 'ASSISTED') {
        profileTags.push('camina con asistencia');
        reasons.push('mobilityStatus=ASSISTED');
    }

    if (p?.careModality === 'HOSPICE') {
        profileTags.push('está en hospicio');
        reasons.push('careModality=HOSPICE');
    } else if (p?.careModality === 'PALLIATIVE') {
        profileTags.push('está en cuidado paliativo');
        reasons.push('careModality=PALLIATIVE');
    }

    return { allowOralFood, allowActivityMention, profileTags, reasons };
}

/**
 * Política de alto nivel para una superficie familiar. Lo que llaman las rutas.
 */
export function getFamilyContentPolicy(p: CongruencePatientInput | null | undefined): FamilyContentPolicy {
    const state = resolveFamilyCareState(p);
    const constraints = getCongruenceConstraints(p);
    const name = p?.name?.trim() || 'su familiar';

    // Política por estado. Las reglas vienen de la spec del dueño.
    switch (state) {
        case 'ACTIVE':
            return {
                state, constraints,
                allowAutoDigest:      true,
                allowAutoMoments:     true,
                allowFeedAggregation: 'full',
                allowStaffMoment:     true,
                allowStaffBroadcast:  true,
                allowAppointment:     'full',
                dashboardMode:        'normal',
                bannerCopy:           null,
            };

        case 'HOSPITAL':
            return {
                state, constraints,
                allowAutoDigest:      false,
                allowAutoMoments:     false,
                allowFeedAggregation: 'none',
                allowStaffMoment:     false,  // el equipo de Vivid no narra mientras está en el hospital
                allowStaffBroadcast:  false,
                allowAppointment:     'none',
                dashboardMode:        'paused',
                bannerCopy:           `Estamos al pendiente de ${name}, esperamos que todo esté bien. Recuerde mantenernos informados.`,
            };

        case 'AWAY':
            return {
                state, constraints,
                allowAutoDigest:      false,
                allowAutoMoments:     false,
                allowFeedAggregation: 'historical',
                allowStaffMoment:     true,
                allowStaffBroadcast:  true,
                allowAppointment:     'full',
                dashboardMode:        'paused',
                bannerCopy:           `${name} está fuera de la residencia por unas horas. Te avisaremos cuando regrese.`,
            };

        case 'HOSPICE':
            return {
                state, constraints,
                allowAutoDigest:      false,  // cero highlights alegres
                allowAutoMoments:     false,
                allowFeedAggregation: 'historical',
                allowStaffMoment:     true,   // mensajes humanos del equipo SÍ, tono reservado
                allowStaffBroadcast:  false,
                allowAppointment:     'visit_only',
                dashboardMode:        'gentle',
                bannerCopy:           `${name} está cómoda y bien acompañada. El equipo está atento. Llámanos cuando nos necesites.`,
            };

        case 'PALLIATIVE':
            return {
                state, constraints,
                allowAutoDigest:      true,   // permitido pero los constraints recortan tono
                allowAutoMoments:     false,  // momentos auto pueden ser inadecuados; staff sí
                allowFeedAggregation: 'full',
                allowStaffMoment:     true,
                allowStaffBroadcast:  true,
                allowAppointment:     'full',
                dashboardMode:        'gentle',
                bannerCopy:           null,
            };

        case 'DISCHARGED':
            return {
                state, constraints,
                allowAutoDigest:      false,
                allowAutoMoments:     false,
                allowFeedAggregation: 'none',
                allowStaffMoment:     false,
                allowStaffBroadcast:  false,
                allowAppointment:     'none',
                dashboardMode:        'farewell',
                bannerCopy:           null,  // sin auto-mensaje, sólo silencio
            };

        case 'DECEASED':
            // Lockdown total. La experiencia de duelo se diseña aparte
            // (Fase D) y SIEMPRE la inicia un humano, nunca auto.
            return {
                state, constraints,
                allowAutoDigest:      false,
                allowAutoMoments:     false,
                allowFeedAggregation: 'none',
                allowStaffMoment:     false,
                allowStaffBroadcast:  false,
                allowAppointment:     'none',
                dashboardMode:        'memorial',
                bannerCopy:           null,  // banner real lo configura un humano
            };
    }
}

// ─── Filtrado de inputs (la 1ra mitad de "congruente o nada") ──────────────

/**
 * Filtra data de entrada antes de pasarla a un generador. Cualquier campo que
 * violaría un constraint duro se borra. El generador nunca ve data
 * incongruente, por lo tanto no puede regurgitarla.
 *
 * Genérico: opera sobre un dict de campos. Quita keys conocidas problemáticas
 * según constraints. No transforma valores válidos.
 */
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

    if (!c.allowOralFood) {
        out.foodIntake = null;
        out.foodBand = null;
    }
    if (!c.allowActivityMention) {
        out.activityNote = null;
        // wellnessNotes pueden contener actividades — filtrado en consumer (heurística por keyword opcional)
    }

    return out;
}

/**
 * Heurística simple para detectar si un texto menciona actividad/movilidad.
 * Sirve para filtrar notas wellness cuando el paciente es BEDRIDDEN.
 * Conservadora — falsos positivos son aceptables (suprimir nota es seguro;
 * pasar nota incongruente es el bug).
 */
const ACTIVITY_KEYWORDS = [
    'caminó', 'caminando', 'caminar',
    'salió', 'salida', 'paseo', 'paseó',
    'participó', 'participación', 'participando',
    'actividad', 'actividades',
    'jugó', 'jugando',
    'bailó', 'bailando',
    'levantó', 'sentó', 'sentada en silla', 'silla', // referencias a movilidad
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
];

export function noteMentionsFood(note: string): boolean {
    const n = note.toLowerCase();
    return FOOD_KEYWORDS.some((kw) => n.includes(kw));
}

/**
 * Filtra una lista de notas (wellness/staff) según los constraints del paciente.
 * Quita las que mencionan comida/actividad cuando esos constraints están off.
 */
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

// ─── Reglas duras para prompts de IA (2da mitad de "congruente o nada") ────

/**
 * Bloque de reglas para inyectar en cualquier prompt Gemini que genere
 * contenido para la familia. Defensa en profundidad sobre el filtrado de
 * inputs — si el filtrado falló o la nota libre menciona algo dudoso, el
 * prompt mismo le dice al modelo qué NO mencionar.
 *
 * Devuelve string listo para concatenar. Ejemplo:
 *   prompt = `... ${buildCongruentPromptRules(patient)} ... contexto: ${ctx}`;
 */
export function buildCongruentPromptRules(p: CongruencePatientInput): string {
    const c = getCongruenceConstraints(p);
    const state = resolveFamilyCareState(p);
    const lines: string[] = [];

    lines.push('REGLAS DURAS DE CONGRUENCIA — son inquebrantables:');

    if (!c.allowOralFood) {
        const reason = p.feedingMethod === 'PEG' ? 'se alimenta por sonda gástrica (PEG)' : 'está en NPO (nada por boca)';
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

// ─── Verificación final post-generación (cinturón + tirantes) ──────────────

/**
 * Verifica que un texto generado no viole los constraints. Si los viola,
 * retorna null (que el caller interprete como "no enviar"). Es la última
 * red de seguridad antes de persistir/enviar.
 *
 * Devuelve el texto original si pasa, null si falla.
 */
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
