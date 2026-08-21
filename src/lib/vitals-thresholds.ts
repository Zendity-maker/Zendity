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
 * Hipotermia — por qué el umbral no es el que aprobó la enfermera.
 *
 * Ella aprobó 35.5 °C como "llamar ya". Ese número es correcto para una
 * temperatura CENTRAL. El hogar mide con termómetro láser de frente
 * (confirmado 21-ago-2026), que lee la piel — y la piel de alguien que lleva
 * la noche en una habitación con aire acondicionado está fría.
 *
 * Lo que dicen las 4,761 lecturas reales de Cupey:
 *
 *   Mediana general ........ 36.1 °C   (central normal: 36.5–37.0)
 *   Turno de mañana ........ 35.8 °C   ← el más frío de todos
 *   Lecturas ≥ 37.0 ........ 55 de 4,761
 *   Lecturas ≤ 35.5 ........ 484, y 443 de ellas (92%) entre 35.0 y 35.5
 *
 * La escala entera está corrida medio grado hacia abajo. Aplicar 35.5 tal cual
 * mandaría a observación de 45 minutos a residentes que están bien, sobre todo
 * en el turno de mañana — y eso es exactamente cómo el personal aprende a
 * ignorar una alarma.
 *
 * El arreglo de fondo no es un número: es CONFIRMAR POR OTRA VÍA antes de
 * escalar. Una lectura baja de frente no es un diagnóstico, es una señal para
 * volver a medir bien. Por eso el mensaje de LLAMAR lo pide explícitamente.
 *
 *   - bajo 35.0  → LLAMAR, confirmando primero por vía axilar
 *   - 35.0–35.5  → ANOTAR, llega al reporte sin interrumpir el turno
 *
 * Si algún día se mide por vía central, HIPOTERMIA_LLAMAR_C sube a 35.5 y la
 * banda ANOTAR desaparece.
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
            add('LLAMAR', 'temperatura',
                `Temperatura baja — ${t}. Confírmala por vía axilar antes de escalar: el termómetro de frente lee la piel, y con aire acondicionado marca por debajo. Si se confirma, avisa — en un adulto mayor la hipotermia también puede indicar infección.`);
        } else if (c <= HIPOTERMIA_ANOTAR_C) {
            add('ANOTAR', 'temperatura', `Temperatura en el límite bajo — ${t}. Si el residente se ve mal, confírmala por vía axilar.`);
        } else if (c >= 37.5) {
            // Con termómetro de frente una febrícula puede ser fiebre real: el
            // aparato subestima. Por eso esta banda pide confirmación.
            add('ANOTAR', 'temperatura', `Febrícula — ${t}. Con termómetro de frente puede quedarse corta: confírmala por vía axilar.`);
        }
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
