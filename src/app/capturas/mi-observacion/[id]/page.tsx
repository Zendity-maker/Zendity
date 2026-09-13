'use client';
/**
 * TEMPORAL en producción (404) — captura de /my-observations/[id] con una
 * observación inventada, para comprobar el acuse de recibo sin entrar con el
 * PIN de nadie y sin fotografiar el expediente de una persona real.
 *
 * Va en una ruta dinámica a propósito: la pantalla lee `useParams().id` y sin
 * segmento se queda en "Cargando..." para siempre. Y las tres variantes se
 * instalan A LA VEZ, a nivel de módulo: el interceptor casa por `includes`
 * sobre la URL, así que cada segmento se lleva su fixture. Instalarlas dentro
 * del componente llega tarde — la pantalla ya pidió sus datos y el layout ya
 * mandó al login.
 *
 *   /capturas/mi-observacion/sin-firmar   el bloque de acuse con sus dos botones
 *   /capturas/mi-observacion/firmada      la vista de solo lectura con la firma
 *   /capturas/mi-observacion/rehusada     la constancia de que no firmó
 */
import { Andamio, instalar, comoSi } from '../../andamio';
import MiObservacionPage from '@/app/my-observations/[id]/page';

const HACE = (horas: number) => {
    const d = new Date('2026-09-13T14:00:00');
    d.setHours(d.getHours() - horas);
    return d.toISOString();
};

/** Un trazo cualquiera. Lo que importa es que el <img> pinte algo. */
const FIRMA =
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="260" height="90">` +
        `<path d="M14 62 C40 20, 58 74, 82 44 S128 16, 150 54 S196 70, 232 30" ` +
        `fill="none" stroke="#0F6B78" stroke-width="2.5" stroke-linecap="round"/></svg>`,
    );

/**
 * `employeeId` tiene que ser el id de la sesión del andamio: la pantalla corta
 * con "Esta observación no es tuya" si no coinciden.
 */
const BASE = {
    id: 'obs-demo',
    employeeId: 'demo-user',
    status: 'PENDING_EXPLANATION',
    severity: 'OBSERVATION',
    category: 'PUNCTUALITY',
    visibleToEmployee: true,
    createdAt: HACE(9),
    description:
        'Llegó 25 minutos tarde al turno de la mañana del 9 de septiembre. Es la segunda vez este mes. El grupo Azul quedó sin cubrir hasta que llegó.',
    directorNote: 'Conversamos el lunes. Queda constancia para el expediente.',
    employeeResponse: null as string | null,
    respondedAt: null as string | null,
    appealText: null as string | null,
    appealedAt: null as string | null,
    pointsDeducted: null as number | null,
    acknowledgedAt: null as string | null,
    acknowledgedSignature: null as string | null,
    acknowledgeRefusedAt: null as string | null,
    acknowledgeRefusedReason: null as string | null,
    supervisor: { id: 'sup-demo', name: 'Celia Sierra', role: 'DIRECTOR' },
};

const respuesta = (incident: typeof BASE) => ({ success: true, incident });

instalar(
    {
        '/api/hr/incidents/firmada': respuesta({
            ...BASE,
            acknowledgedAt: HACE(2),
            acknowledgedSignature: FIRMA,
        }),
        '/api/hr/incidents/rehusada': respuesta({
            ...BASE,
            acknowledgeRefusedAt: HACE(3),
            acknowledgeRefusedReason:
                'No estoy de acuerdo con la hora que aparece. Pido revisar el reloj de entrada.',
        }),
        // La genérica va LA ÚLTIMA: el interceptor casa por `includes` y se
        // tragaría a las otras dos.
        '/api/hr/incidents/': respuesta(BASE),
    },
    comoSi({ id: 'demo-user', name: 'Joaneliz Pérez', role: 'CAREGIVER' }),
);

export default function Captura() {
    return <Andamio ancho={820}><MiObservacionPage /></Andamio>;
}
