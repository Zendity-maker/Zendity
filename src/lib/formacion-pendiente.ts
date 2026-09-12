/**
 * CUÁNDO VENCE UNA FORMACIÓN ASIGNADA, Y CUÁL VA PRIMERO.
 *
 * Andrés, 12-sep-2026, sobre por qué nadie abre los cursos: "¿cómo sería el
 * proceso de asignación?"
 *
 * Asignar ya se asigna. Lo medido ese día en las dos sedes: **204 asignaciones,
 * 178 pendientes, 26 completadas.** 19 de las 22 personas activas tienen
 * formación esperando; las dos que más, trece cursos cada una. La más vieja
 * llevaba 23 días.
 *
 * El problema no era la falta de asignaciones. Era que asignar no producía nada:
 *
 *  1. EL PLAZO NO EXISTÍA. `PLAZO_DIAS = 7` en academy-assign.ts se usaba para
 *     escribir una fecha DENTRO del texto de la notificación —"tienes hasta el
 *     27 de agosto"— y en ningún sitio más. No se guardaba, no había cron, nadie
 *     lo miraba. El 28 no pasaba nada.
 *
 *  2. TRECE TAREAS SON CERO TAREAS. La certificación geriátrica se asigna
 *     entera, diez módulos de golpe. El propio código dice "el orden importa:
 *     el general primero, emergencias al final" — pero al llegar todos juntos
 *     el orden no lo ve nadie. La cuidadora abre Academy y ve trece tarjetas
 *     ámbar iguales.
 *
 * Este archivo resuelve las dos cosas SIN tocar el schema y SIN reescribir las
 * 178 filas que ya existen:
 *
 *  · El vencimiento se DERIVA de `createdAt` y del motivo. Una columna nueva
 *    obligaría a un push en producción y a rellenar las filas viejas; la regla
 *    es la misma para todas y se puede cambiar en un sitio.
 *  · El orden se DERIVA del motivo y, dentro de la certificación, de la posición
 *    en RUTA_CERTIFICACION, que ya estaba declarada y no la leía nadie.
 *
 * No hay castigo en ninguna parte, y es deliberado: ante un problema de
 * registro, hacer el dato veraz, no crear una métrica que castigue la conducta.
 */

/**
 * La certificación geriátrica, EN SU ORDEN.
 *
 * Es lo que el Departamento de la Familia exige para acreditar a un cuidador.
 * Vive aquí y no en academy-assign.ts para que esta librería no arrastre Prisma:
 * así el orden y los plazos se pueden calcular en cualquier sitio.
 *
 * El general primero, emergencias al final. Las tres últimas —continuidad,
 * piel, vitales— enseñan a sostener un plan que estableció otro, y eso se
 * entiende mejor cuando ya se sabe cuidar.
 */
export const RUTA_CERTIFICACION: string[] = [
    'Cuidado Geriátrico General',
    'Demencia y Alzheimer',
    'Movilización y Transferencias',
    'Higiene, Piel y Control de Infecciones',
    'Alimentación, Hidratación',
    'Trato Digno, Derechos',
    'Emergencias: Los Primeros Minutos',
    'Continuidad del Plan de Cuidado',
    'Piel: Prevención',
    'Signos Vitales, Observación',
];

/**
 * Los plazos, por motivo de la asignación.
 *
 * `dias: null` significa SIN fecha límite, y no es un olvido: la certificación
 * geriátrica son diez módulos y cuatro horas de contenido. Ponerle una fecha
 * que nadie va a cumplir convierte el plazo en decorado, y entonces tampoco se
 * cumple el de siete días del incidente, que sí importa.
 *
 * `prioridad` es el orden entre grupos. Menor va primero.
 */
const PLAZOS: { patron: RegExp; dias: number | null; prioridad: number; grupo: string }[] = [
    // Sale de algo que ya pasó en el piso. Es el único con urgencia real.
    { patron: /^Incidente de/i, dias: 7, prioridad: 0, grupo: 'Tras una observación' },
    // La pidió una persona por un motivo suyo. Va antes que lo automático.
    { patron: /^Asignado por/i, dias: 14, prioridad: 1, grupo: 'Te lo pidió tu supervisión' },
    // Sin esto no sabe usar la herramienta con la que trabaja hoy.
    { patron: /^Ruta de ingreso/i, dias: 14, prioridad: 2, grupo: 'Para empezar' },
    // Acredita a la persona. Importante, no urgente.
    { patron: /^Certificación geriátrica/i, dias: null, prioridad: 3, grupo: 'Certificación geriátrica' },
];

const POR_DEFECTO = { dias: 14, prioridad: 2, grupo: 'Asignado' };

const DIA = 86_400_000;

export interface EstadoDePlazo {
    /** Cuándo vence. null = sin fecha límite, a propósito. */
    vence: Date | null;
    /** Negativo si ya pasó. null si no hay plazo. */
    diasRestantes: number | null;
    /** Solo puede ser true si el motivo tiene plazo. */
    vencida: boolean;
    /** Cuánto lleva esperando desde que se asignó. Siempre tiene valor. */
    diasEsperando: number;
    grupo: string;
    prioridad: number;
}

function reglaDe(motivo: string) {
    return PLAZOS.find(p => p.patron.test(motivo ?? '')) ?? POR_DEFECTO;
}

/** El estado de plazo de UNA asignación, derivado de su motivo y su fecha. */
export function estadoDePlazo(motivo: string, asignadaEn: Date, ahora = new Date()): EstadoDePlazo {
    const regla = reglaDe(motivo);
    const diasEsperando = Math.floor((ahora.getTime() - asignadaEn.getTime()) / DIA);

    if (regla.dias === null) {
        return {
            vence: null, diasRestantes: null, vencida: false,
            diasEsperando, grupo: regla.grupo, prioridad: regla.prioridad,
        };
    }

    const vence = new Date(asignadaEn.getTime() + regla.dias * DIA);
    const diasRestantes = Math.ceil((vence.getTime() - ahora.getTime()) / DIA);
    return {
        vence, diasRestantes, vencida: diasRestantes < 0,
        diasEsperando, grupo: regla.grupo, prioridad: regla.prioridad,
    };
}

/**
 * Dónde cae un curso dentro de la certificación. 999 si no es de la ruta.
 *
 * Se compara por fragmento y no por id porque los cursos se siembran por sede y
 * sus ids difieren; los títulos son estables. Es el mismo criterio que usa
 * academy-assign para buscarlos.
 */
export function ordenEnCertificacion(titulo: string): number {
    const t = (titulo ?? '').toLowerCase();
    const i = RUTA_CERTIFICACION.findIndex(f => t.includes(f.toLowerCase()));
    return i === -1 ? 999 : i;
}

export interface AsignacionOrdenable {
    title: string;
    reason: string;
    assignedAt: Date | string;
}

/**
 * Ordena la formación pendiente por lo que de verdad va primero.
 *
 * El criterio, en cascada:
 *   1. el grupo (incidente > pedida a mano > ingreso > certificación)
 *   2. dentro del grupo, lo que vence antes — y lo vencido delante de todo
 *   3. dentro de la certificación, el orden declarado de la ruta
 *   4. a igualdad, lo más viejo primero
 *
 * Devuelve cada asignación con su plazo ya calculado y una marca `siguiente`
 * en la primera. Esa marca es la respuesta a "¿por dónde empiezo?", que es la
 * pregunta que hoy contesta el 87% no empezando.
 */
export function ordenarPendientes<T extends AsignacionOrdenable>(
    asignaciones: T[],
    ahora = new Date(),
): (T & { plazo: EstadoDePlazo; siguiente: boolean })[] {
    const conPlazo = asignaciones.map(a => ({
        ...a,
        plazo: estadoDePlazo(a.reason, new Date(a.assignedAt), ahora),
    }));

    conPlazo.sort((a, b) => {
        if (a.plazo.prioridad !== b.plazo.prioridad) return a.plazo.prioridad - b.plazo.prioridad;
        // Lo vencido, delante de lo que aún tiene plazo.
        if (a.plazo.vencida !== b.plazo.vencida) return a.plazo.vencida ? -1 : 1;
        const ra = a.plazo.diasRestantes, rb = b.plazo.diasRestantes;
        if (ra !== null && rb !== null && ra !== rb) return ra - rb;
        const oa = ordenEnCertificacion(a.title), ob = ordenEnCertificacion(b.title);
        if (oa !== ob) return oa - ob;
        return new Date(a.assignedAt).getTime() - new Date(b.assignedAt).getTime();
    });

    return conPlazo.map((a, i) => ({ ...a, siguiente: i === 0 }));
}

/** Cómo se dice el plazo en pantalla. Sin números crudos y sin alarmismo. */
export function textoDePlazo(p: EstadoDePlazo): string {
    if (p.vence === null) return 'Sin fecha límite';
    if (p.vencida) {
        const d = Math.abs(p.diasRestantes!);
        return d === 1 ? 'Venció ayer' : `Venció hace ${d} días`;
    }
    if (p.diasRestantes === 0) return 'Vence hoy';
    if (p.diasRestantes === 1) return 'Vence mañana';
    return `Quedan ${p.diasRestantes} días`;
}
