'use client';
/** TEMPORAL en producción (404) — captura de /maintenance (Planta Física). */
import { Andamio, instalar, comoSi } from '../andamio';
import MaintenanceDashboardPage from '@/app/maintenance/page';

/**
 * El tablero de mantenimiento es un kanban de tres columnas y lo que hay que
 * enseñar es el RECORRIDO de un aviso: entra en Nuevas, se pulsa "Iniciar" y
 * pasa a Trabajando, se pulsa "Marcar Resuelto" y cae en Resueltos con el
 * tiempo que tardó. Por eso el fixture trae las tres columnas con algo dentro:
 * una columna vacía no enseña el paso siguiente.
 *
 * El prefijo "📍 sitio |" del título NO es decoración: la pantalla lo extrae con
 * un regex y lo pinta aparte como pastilla naranja. Sin él, el aviso sale sin
 * ubicación y la foto no enseña dónde está la avería.
 */
const AHORA = Date.now();
const HACE_MIN = (m: number) => new Date(AHORA - m * 60_000).toISOString();

instalar({
    '/api/maintenance': {
        success: true,
        pending: [
            {
                id: 't1', status: 'PENDING', createdAt: HACE_MIN(35),
                title: '📍 Baño · Hab. 204 | Inodoro corriendo sin parar',
                description: 'El tanque no cierra y el agua no para desde anoche.',
                photoUrl: null,
            },
            {
                id: 't2', status: 'PENDING', createdAt: HACE_MIN(95),
                title: '📍 Pasillo · Planta 2 | Bombilla fundida junto a la 210',
                description: 'El tramo entre la 208 y la 212 queda a oscuras de noche.',
                photoUrl: null,
            },
        ],
        inProgress: [
            {
                id: 't3', status: 'IN_PROGRESS', createdAt: HACE_MIN(180),
                title: '📍 Comedor | Silla de ruedas con freno suelto',
                description: 'Frena solo de un lado. Retirada del comedor hasta arreglarla.',
                photoUrl: null,
            },
        ],
        resolved: [
            {
                id: 't4', status: 'RESOLVED', createdAt: HACE_MIN(320),
                title: '📍 Cocina | Nevera con puerta que no sella',
                description: 'Cambiada la goma de la puerta.',
                photoUrl: null, resolutionTimeMinutes: 45,
            },
            {
                id: 't5', status: 'RESOLVED', createdAt: HACE_MIN(400),
                title: '📍 Habitación 112 | Barandilla de la cama floja',
                description: 'Apretados los cuatro tornillos y comprobada con peso.',
                photoUrl: null, resolutionTimeMinutes: 20,
            },
        ],
    },
}, comoSi({ name: 'Ramón Ortiz', role: 'MAINTENANCE' }));

export default function CapturaMantenimiento() {
    return (
        <Andamio ancho={1280}>
            <MaintenanceDashboardPage />
        </Andamio>
    );
}
