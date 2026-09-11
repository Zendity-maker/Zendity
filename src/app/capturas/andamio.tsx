'use client';
/**
 * ANDAMIO DE CAPTURAS — TEMPORAL. Se borra al terminar.
 *
 * Monta una pantalla REAL de Zendity con datos INVENTADOS, para fotografiarla
 * y meter la foto en los cursos de Academy.
 *
 * Por qué así y no entrando a la app:
 *  1. Entrar exige el PIN de Andrés, y yo no escribo credenciales.
 *  2. Aunque entrara, las capturas saldrían con residentes REALES. Una foto de
 *     doña Rosa con su diagnóstico dentro de un curso que ven 35 personas es
 *     justo lo que la regla 7 prohíbe. El material de formación no lleva PHI.
 *
 * Así se consiguen las dos cosas: la pantalla es la de verdad —el mismo
 * componente que corre en producción, con sus colores, su tipografía y sus
 * botones— y los residentes no existen.
 */
import { SessionProvider } from 'next-auth/react';
import { useState } from 'react';

/**
 * EN PRODUCCION ESTAS RUTAS NO EXISTEN.
 *
 * El andamio vive en el repo a proposito: cuando cambie una pantalla hay que
 * poder repetir su foto con un comando, o las capturas se quedan viejas igual
 * que se quedaron viejos los cursos. Pero no hay ninguna razon para que
 * app.zendity.com sirva una pantalla de residentes inventados, asi que fuera de
 * desarrollo devuelve 404.
 */
export const SOLO_EN_DESARROLLO = process.env.NODE_ENV !== 'production';

/** La sesión que ve la pantalla. No sale de ningún sitio real. */
export const SESION = {
    user: {
        id: 'demo-user',
        name: 'Ana Rivera',
        email: 'demo@zendity.com',
        role: 'SUPERVISOR',
        headquartersId: 'demo-hq',
        headquartersName: 'Hogar Demostración',
        photoUrl: null as string | null,
        secondaryRoles: [] as string[],
    },
    expires: '2099-01-01T00:00:00.000Z',
};

/**
 * La sesión que se está sirviendo ahora mismo.
 *
 * Varias pantallas PINTAN a quien las abre —el panel de mantenimiento saluda por
 * nombre en la barra lateral, el de dirección enseña el rol— y con una sesión
 * de SUPERVISOR fija la foto sale diciendo algo que no es. `instalar` acepta un
 * segundo argumento para cambiarla por curso.
 */
let sesionActual: typeof SESION = SESION;

/** Devuelve una sesión con lo que se le cambie encima de la de por defecto. */
export function comoSi(usuario: Partial<typeof SESION['user']>) {
    return { ...SESION, user: { ...SESION.user, ...usuario } };
}

/**
 * Sirve las respuestas de API sin que salga una sola petición de red.
 *
 * Se instala en el módulo, no en un efecto: las pantallas piden sus datos en el
 * primer `useEffect`, y un parche que llega después no llega.
 */
export function instalar(rutas: Record<string, unknown>, sesion: typeof SESION = SESION) {
    if (typeof window === 'undefined') return;
    sesionActual = sesion;
    // EN PRODUCCION NO SE PARCHEA NADA.
    //
    // `instalar()` corre al cargar el modulo, antes de que <Andamio> pueda
    // devolver null. Sin esta linea, abrir /capturas/loquesea en produccion
    // dejaba `window.fetch` sustituido para esa pestana —devolviendo datos
    // inventados a todo lo que pidiera— sobre una pagina que ademas sale en
    // blanco. La guarda tiene que estar en los dos sitios.
    if (!SOLO_EN_DESARROLLO) return;
    const w = window as any;
    if (w.__andamioPuesto) { w.__andamioRutas = rutas; w.__andamioSesion = sesion; return; }
    w.__andamioPuesto = true;
    w.__andamioRutas = rutas;
    w.__andamioSesion = sesion;
    const original = w.fetch.bind(w);

    const json = (dato: unknown) => new Response(JSON.stringify(dato), {
        status: 200, headers: { 'Content-Type': 'application/json' },
    });

    w.fetch = async (entrada: any, init?: any) => {
        const url = String(
            typeof entrada === 'string' ? entrada
                : entrada instanceof URL ? entrada.href
                    : entrada?.url ?? ''
        );

        // TODO LO QUE NO SEA /api/ PASA DE LARGO.
        // El primer intento interceptaba todo, incluidas las peticiones
        // internas de Next —HMR, payloads de RSC— y devolverles un JSON
        // inventado deja la pantalla colgada en el spinner sin decir por que.
        if (!url.includes('/api/')) return original(entrada, init);

        // La sesión se sirve SIEMPRE, y aquí, no con un SessionProvider
        // anidado: `useAuth()` vive en el layout raíz, por encima de esta
        // página, y lee el proveedor de arriba. Si ese no tiene sesión, la
        // pantalla no sabe en qué sede está y se queda esperando para siempre.
        if (url.includes('/api/auth/session')) return json(w.__andamioSesion ?? SESION);
        if (url.includes('/api/auth/')) return json({});

        const tabla = w.__andamioRutas as Record<string, unknown>;
        for (const patron of Object.keys(tabla)) {
            if (url.includes(patron)) return json(tabla[patron]);
        }
        // LO QUE NO TIENE FIXTURE DEVUELVE UN "VACIO" GENEROSO.
        //
        // Una pantalla grande monta componentes hijos que piden sus propios
        // datos —el chat del personal, los avisos, el historial— y cada uno
        // espera su campo. Un `{data: []}` pelado hace que el hijo reviente al
        // hacer `.filter` sobre undefined y se lleve la pantalla entera por
        // delante. Con las claves vacias mas comunes, el hijo se pinta vacio y
        // la foto sale.
        console.warn('[andamio] sin fixture:', url);
        return json({
            success: true, ok: true, data: [], items: [], results: [],
            messages: [], notifications: [], alerts: [], tasks: [], logs: [],
            patients: [], residentes: [], staff: [], users: [], schedules: [],
            incidents: [], history: [], eventos: [], pendientes: [], pendings: [],
            threads: [], chips: {}, totals: {}, series: {}, deltas: {},
            total: 0, count: 0,
        });
    };
}

/** El marco: la sesión falsa por encima de la pantalla real. */
export function Andamio({ children, ancho = 1100 }: { children: React.ReactNode; ancho?: number }) {
    const [listo] = useState(true);
    if (!SOLO_EN_DESARROLLO || !listo) return null;
    return (
        <SessionProvider session={sesionActual as any}>
            {/* El indicador de desarrollo de Next se cuela en la esquina de
                todas las capturas. No es parte de la app que ve el personal. */}
            <style>{`nextjs-portal, [data-nextjs-toast], #__next-build-watcher { display: none !important; }`}</style>
            <div style={{ width: ancho, background: '#F8FAFC', minHeight: '100vh' }}>
                {children}
            </div>
        </SessionProvider>
    );
}
