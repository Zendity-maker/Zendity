'use client';
/**
 * TEMPORAL en producción (404) — captura de /care/hub.
 *
 * Es la primera pantalla que ve una cuidadora al entrar: el saludo con su
 * nombre y las tres puertas (Iniciar Turno, Academy, Mis Observaciones). Dos
 * cursos de Academy la piden como primera imagen.
 */
import { Andamio, instalar } from '../andamio';
import HubCuidador from '@/app/care/hub/page';

/**
 * EL SALUDO NO VIENE DE NINGUNA API.
 *
 * "Buenos días / Buenas tardes / Buenas noches" lo decide la pantalla con
 * `new Date().getHours()` del navegador. Sin fijarlo, la misma captura repetida
 * a las 8 de la noche sale distinta y el curso acaba enseñando dos pantallas
 * que no son la misma. Se clava el reloj a las 7 a.m., que es la hora a la que
 * esta pantalla se abre de verdad: al entrar al turno de mañana.
 *
 * Es un parche global, así que se pone SOLO aquí, en la ruta del andamio, y
 * únicamente sobre getHours — ningún otro componente de esta pantalla lee la
 * hora local.
 */
function fijarHoraDelSaludo(hora: number) {
    if (typeof window === 'undefined') return;
    const w = window as unknown as { __andamioHoraFija?: boolean };
    if (w.__andamioHoraFija) return;
    w.__andamioHoraFija = true;
    Date.prototype.getHours = function () { return hora; };
}
fijarHoraDelSaludo(7);

/**
 * LA TARJETA DE SCORE SE QUEDA FUERA DE LA FOTO, A PROPÓSITO.
 *
 * El Z-Score está apagado desde el 09-sep-2026 (`Z_SCORE_VISIBLE = false` en
 * src/lib/z-score-visible.ts) porque el número está invertido: castiga a quien
 * más documenta. /care/hub es de los sitios que NO consultan la bandera y
 * siguen pintándolo — eso hay que arreglarlo en la pantalla, no en la captura,
 * pero un curso que enseña a 35 personas a mirar ese número sería enseñar a
 * mirar algo que hoy no es verdad.
 *
 * Con `success: false` la pantalla deja `scoreData` en null y no pinta la
 * tarjeta. Si algún día el score vuelve a tener un solo dueño, se pone este
 * flag en true y la respuesta de abajo ya tiene la forma exacta que devuelve
 * calculateDynamicScore (src/lib/compliance-score.ts).
 */
const MOSTRAR_Z_SCORE = false;

const SCORE_DEMO = {
    success: true,
    score: 86,
    breakdown: {
        base: 75,
        positives: 12,
        negatives: 6,
        rawNegatives: 6,
        rawObservationPenalty: 0,
        observationPenalty: 0,
        evaluationDelta: 0,
        extraDelta: 0,
        roundBonus: 5,
        total: 86,
        details: {
            rotationsOnTime: 41,
            medsAdministered: 312,
            preventiveAlerts: 3,
            medsOmitted: 0,
            rotationsLate: 0,
            fastActionsFailed: 0,
            unclosedSessions: 0,
            incompleteHandovers: 0,
            blankShifts: 0,
            appliedObservationsCount: 0,
            evaluationsCount: 1,
            extraScoreEventsCount: 2,
        },
    },
};

instalar({
    /**
     * Va PLANA: la pantalla hace `setObsPending(data.count)`, no data.data.count.
     * Con 2 la tarjeta dice "2 pendientes de respuesta" y saca la pastilla ámbar
     * con el número — que es lo que el curso tiene que enseñar a reconocer. Con
     * 0 la tarjeta se ve igual que las demás y no enseña nada.
     */
    '/api/my-observations/pending-count': { success: true, count: 2 },

    '/api/care/my-score': MOSTRAR_Z_SCORE
        ? SCORE_DEMO
        : { success: false, error: 'Z-Score oculto — ver src/lib/z-score-visible.ts' },
});

export default function Captura() {
    // La pantalla es de tableta: todo el contenido vive en una columna
    // `max-w-md` centrada sobre el fondo oscuro. A 1280 la foto sale casi toda
    // vacía; 820 es el ancho de una tableta en vertical, que es como la usa el
    // personal del piso.
    return <Andamio ancho={820}><HubCuidador /></Andamio>;
}
