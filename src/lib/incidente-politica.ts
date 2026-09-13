/**
 * LA POLÍTICA DE UNA OBSERVACIÓN DE PERSONAL, EN UN SOLO SITIO.
 *
 * Aquí viven los plazos y los puntos. Nada más: ni Prisma, ni notificaciones,
 * ni correo. Es a propósito — este módulo lo importan pantallas de cliente
 * (`/my-observations`), y un `import { prisma }` en esta cadena rompe el build.
 * Lo que toca la base está en `incidente-aplicar.ts`.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * POR QUÉ EXISTE
 *
 * Hasta el 13-sep-2026 la misma sanción se aplicaba por dos caminos con reglas
 * distintas, y el automático era el flojo:
 *
 *                          /decide (a mano)        el cron (solo)
 *   reloj                  notifiedAt              createdAt (el BORRADOR)
 *   espera el acuse        sí, 3 días              no
 *   puntos                 3 / 8 / 20              0 / 5 / 15  (tabla de 2025)
 *   deja ScoreEvent        sí                      NO
 *   tipo de aviso          HR_OBSERVATION          EMAR_ALERT (medicación)
 *
 * Medido ese día en producción: de 83 observaciones aplicadas, 49 las aplicó
 * el cron. Escribieron 70 puntos donde /decide habría escrito 217, y NINGUNA
 * de las 49 dejó una fila en ScoreEvent — cero de 49. Se enviaron avisos de
 * "aplicada automáticamente. Puntos deducidos: N" por sanciones cuyo N no se
 * dedujo de ningún sitio.
 *
 * La regla que sale de ahí: el cron decide CUÁNDO, nunca CUÁNTO.
 */
import type { HrIncidentSeverity } from '@prisma/client';

/**
 * Horas que tiene el empleado para responder antes de que se aplique sola.
 *
 * La UI decía 48 en cuatro sitios y el aviso, el correo y el cron decían 72.
 * No había ningún plazo de 48 horas en el backend: era un número que solo
 * existía en la pantalla. Se cuenta desde que se le AVISÓ, no desde que el
 * supervisor escribió el borrador.
 */
export const HORAS_PARA_RESPONDER = 72;

/**
 * Días que se espera al empleado tras avisarle, antes de poder aplicar sin
 * su acuse.
 *
 * Sin esta salida, quien no abre Zéndity bloquea su propia sanción para
 * siempre — y la dirección acabaría buscando la forma de saltarse la regla,
 * que es como se llegó aquí. Con ella, el silencio tiene consecuencia y queda
 * registrado que se esperó.
 */
export const DIAS_ESPERA_ACUSE = 3;

export function puntosPorSeveridad(severity: HrIncidentSeverity): { delta: number; setToZero: boolean } {
    switch (severity) {
        case 'OBSERVATION': return { delta: -3, setToZero: false };
        case 'WARNING': return { delta: -8, setToZero: false };
        case 'SUSPENSION': return { delta: -20, setToZero: false };
        case 'TERMINATION': return { delta: 0, setToZero: true };
        default: return { delta: 0, setToZero: false };
    }
}

export function etiquetaSeveridad(sev: HrIncidentSeverity | string): string {
    return sev === 'OBSERVATION' ? 'Observación'
        : sev === 'WARNING' ? 'Amonestación Escrita'
        : sev === 'SUSPENSION' ? 'Suspensión Temporal'
        : sev === 'TERMINATION' ? 'Despido Justificado'
        : String(sev);
}

/** Lo mínimo que hace falta saber de una observación para fechar su reloj. */
export interface RelojDeObservacion {
    notifiedAt: Date | string | null;
    createdAt: Date | string;
    visibleToEmployee: boolean;
}

/**
 * CUÁNDO SE LE AVISÓ DE VERDAD. El reloj de todos los plazos.
 *
 * `notifiedAt` lo escribe "Pedir explicación" (`/decide` acción
 * REQUEST_EXPLANATION). Pero hay un segundo camino que crea la observación ya
 * en PENDING_EXPLANATION y avisa al empleado en el mismo acto: el patrón de
 * ausencias de `/api/hr/schedule/absent`. Ahí `createdAt` ES el momento del
 * aviso, porque nace visible y con la notificación enviada.
 *
 * Devuelve null cuando NO consta que se le avisara. Un plazo no puede correr
 * contra alguien que no sabe que existe: quien lea esto debe abstenerse de
 * aplicar, no inventar una fecha.
 */
export function avisadoEn(i: RelojDeObservacion): Date | null {
    if (i.notifiedAt) return new Date(i.notifiedAt);
    if (i.visibleToEmployee) return new Date(i.createdAt);
    return null;
}

/** Horas que le quedan para responder. null si no consta que se le avisara. */
export function horasQueLeQuedan(i: RelojDeObservacion, ahora: Date = new Date()): number | null {
    const desde = avisadoEn(i);
    if (!desde) return null;
    const pasadas = (ahora.getTime() - desde.getTime()) / 3600000;
    return Math.max(0, Math.round(HORAS_PARA_RESPONDER - pasadas));
}

export type MotivoParaNoAplicar =
    | { ok: true }
    | { ok: false; code: 'SIN_AVISAR' | 'ESPERANDO_ACUSE' | 'ESTADO_NO_APLICABLE'; error: string };

/**
 * ¿Se puede aplicar ya? La misma respuesta para el director y para el cron.
 *
 * Negarse a firmar NO impide aplicar: la negativa queda registrada y el proceso
 * sigue, que es la política del hogar.
 */
export function puedeAplicarse(
    i: RelojDeObservacion & {
        status: string;
        acknowledgedAt: Date | string | null;
        acknowledgeRefusedAt: Date | string | null;
    },
    ahora: Date = new Date(),
): MotivoParaNoAplicar {
    if (i.status !== 'PENDING_EXPLANATION' && i.status !== 'EXPLANATION_RECEIVED') {
        return {
            ok: false,
            code: 'ESTADO_NO_APLICABLE',
            error: 'Primero hay que notificar al empleado. Usa "Pedir explicación" y espera su acuse.',
        };
    }

    const desde = avisadoEn(i);
    if (!desde) {
        return {
            ok: false,
            code: 'SIN_AVISAR',
            error: 'No consta que se le avisara al empleado. Usa "Pedir explicación" antes de aplicar.',
        };
    }

    const acuseHecho = Boolean(i.acknowledgedAt) || Boolean(i.acknowledgeRefusedAt);
    const diasDesdeElAviso = (ahora.getTime() - desde.getTime()) / (24 * 3600 * 1000);
    if (!acuseHecho && diasDesdeElAviso < DIAS_ESPERA_ACUSE) {
        const faltan = Math.ceil(DIAS_ESPERA_ACUSE - diasDesdeElAviso);
        return {
            ok: false,
            code: 'ESPERANDO_ACUSE',
            error: `El empleado aún no ha firmado ni rehusado. Puedes aplicar sin su acuse en ${faltan} día${faltan !== 1 ? 's' : ''}.`,
        };
    }

    return { ok: true };
}
