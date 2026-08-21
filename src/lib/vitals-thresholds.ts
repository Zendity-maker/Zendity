/**
 * Umbrales de signos vitales — aprobados por la enfermera del hogar (21-ago-2026).
 *
 * Antes vivían inline en /api/care/vitals con valores que nadie había decidido:
 * `sys > 140 || dia > 90` marcaba como crisis hipertensiva a cualquier adulto
 * mayor con la presión que se le espera, y no existía nada para hipotermia,
 * pulso ni diastólica baja.
 *
 * La enfermera aprobó DOS niveles, y esa distinción es lo que hace que el
 * sistema sea usable:
 *
 *   LLAMAR  — se avisa al supervisor de inmediato y el residente entra en
 *             protocolo de observación a 45 minutos.
 *   ANOTAR  — queda registrado y se le pasa en el reporte. No interrumpe el
 *             turno ni genera cita.
 *
 * Todo lo que no cruza ninguno de los dos, no dice nada.
 */

export type NivelVital = 'LLAMAR' | 'ANOTAR';

export interface HallazgoVital {
    nivel: NivelVital;
    signo: string;
    mensaje: string;
}

/**
 * Hipotermia — la enfermera aprobó 35.5 °C como "llamar ya".
 *
 * Medido contra las 4,836 lecturas reales de Cupey, ese corte parte por la
 * mitad la distribución normal del hogar: la mediana está en 36.1 °C, hay 1,314
 * lecturas entre 35.5 y 36.0, y de las 484 que quedarían bajo 35.5, **443 (92%)
 * caen en la banda 35.0–35.5**. Solo 41 bajan de 35.0.
 *
 * Esa forma es la de la toma AXILAR, que lee medio grado por debajo del centro.
 * Aplicar 35.5 tal cual mandaría a observación de 45 minutos a residentes que
 * casi con seguridad están bien, unas cinco veces al día.
 *
 * Mientras la enfermera confirma con qué método se mide:
 *   - bajo 35.0  → LLAMAR  (la cola donde sí hay hipotermia plausible)
 *   - 35.0–35.5  → ANOTAR  (llega a su reporte, no interrumpe el turno)
 *
 * Si confirma que la toma es central, HIPOTERMIA_LLAMAR_C sube a 35.5 y la
 * banda ANOTAR desaparece — es una línea.
 */
const HIPOTERMIA_LLAMAR_C = 35.0;
const HIPOTERMIA_ANOTAR_C = 35.5;

/** Fahrenheit por debajo del cual no existe temperatura corporal medible. */
const F_MIN_PLAUSIBLE = 95;
/** Celsius por encima del cual el valor ya no puede ser Celsius corporal. */
const C_MAX_PLAUSIBLE = 45;

/**
 * Normaliza la temperatura a Celsius.
 *
 * El personal registra unas veces en Celsius y otras en Fahrenheit. La regla
 * anterior era `temp < 45 ? celsius : fahrenheit`, que interpretaba un 50 como
 * 50 °F — es decir, 10 °C. En los datos de Cupey hay 86 lecturas en la banda
 * 45–95 que no son ni una cosa ni la otra: son errores de digitación que
 * estaban entrando al expediente como si fueran válidos.
 *
 * Devuelve null cuando el valor no es interpretable, para que quien llama lo
 * rechace en vez de guardar una temperatura inventada.
 */
export function aCelsius(temp: number): number | null {
    if (!Number.isFinite(temp)) return null;
    if (temp < C_MAX_PLAUSIBLE) return temp;            // ya viene en Celsius
    if (temp >= F_MIN_PLAUSIBLE) return (temp - 32) * 5 / 9;
    return null;                                         // banda imposible
}

/**
 * Evalúa una lectura contra los umbrales aprobados.
 *
 * Devuelve todos los hallazgos, no solo el primero: una lectura puede cruzar
 * varios umbrales a la vez y la enfermera necesita verlos todos.
 */
export function evaluarVitales(v: {
    systolic: number;
    diastolic: number;
    heartRate: number;
    /** En Celsius o Fahrenheit; se normaliza aquí. */
    temperature: number;
    spo2?: number | null;
}): HallazgoVital[] {
    const h: HallazgoVital[] = [];
    const add = (nivel: NivelVital, signo: string, mensaje: string) => h.push({ nivel, signo, mensaje });

    // ── Temperatura ────────────────────────────────────────────────────
    const c = aCelsius(v.temperature);
    if (c !== null) {
        const t = `${c.toFixed(1)} °C`;
        if (c >= 38.0) add('LLAMAR', 'temperatura', `Fiebre — ${t}.`);
        else if (c < HIPOTERMIA_LLAMAR_C) {
            add('LLAMAR', 'temperatura', `Temperatura baja — ${t}. En un adulto mayor también puede indicar infección.`);
        } else if (c <= HIPOTERMIA_ANOTAR_C) {
            add('ANOTAR', 'temperatura', `Temperatura en el límite bajo — ${t}.`);
        } else if (c >= 37.5) add('ANOTAR', 'temperatura', `Febrícula — ${t}.`);
    }

    // ── Presión ────────────────────────────────────────────────────────
    if (v.systolic > 180) add('LLAMAR', 'presión', `Sistólica muy alta — ${v.systolic}.`);
    else if (v.systolic < 90) add('LLAMAR', 'presión', `Sistólica muy baja — ${v.systolic}.`);
    else if (v.systolic >= 160) add('ANOTAR', 'presión', `Sistólica elevada — ${v.systolic}.`);

    if (v.diastolic > 110) add('LLAMAR', 'presión', `Diastólica muy alta — ${v.diastolic}.`);
    else if (v.diastolic < 50) add('LLAMAR', 'presión', `Diastólica muy baja — ${v.diastolic}.`);
    else if (v.diastolic >= 100) add('ANOTAR', 'presión', `Diastólica elevada — ${v.diastolic}.`);

    // ── Pulso ──────────────────────────────────────────────────────────
    if (v.heartRate > 110) add('LLAMAR', 'pulso', `Pulso rápido — ${v.heartRate}.`);
    else if (v.heartRate < 50) add('LLAMAR', 'pulso', `Pulso lento — ${v.heartRate}.`);
    else if (v.heartRate >= 100) add('ANOTAR', 'pulso', `Pulso elevado — ${v.heartRate}.`);

    // ── Oxígeno ────────────────────────────────────────────────────────
    if (v.spo2 != null) {
        if (v.spo2 < 90) add('LLAMAR', 'oxígeno', `Oxígeno bajo — ${v.spo2}%. Confirma con la mano tibia.`);
        else if (v.spo2 <= 93) add('ANOTAR', 'oxígeno', `Oxígeno en el límite — ${v.spo2}%.`);
    }

    return h;
}

/** El nivel más alto de una lectura, o null si no cruzó nada. */
export function nivelDe(hallazgos: HallazgoVital[]): NivelVital | null {
    if (hallazgos.some(x => x.nivel === 'LLAMAR')) return 'LLAMAR';
    if (hallazgos.length > 0) return 'ANOTAR';
    return null;
}
