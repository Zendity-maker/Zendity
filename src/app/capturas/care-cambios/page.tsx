'use client';
/**
 * TEMPORAL en producción (404) — captura de /care/cambios.
 *
 * Lo que el piso reportó y todavía no ha mirado nadie. La escena está armada
 * para que enseñe las tres cosas de la pantalla:
 *
 *   1. La banda del patrón arriba del todo — tres residentes de la misma
 *      planta con lo mismo en piel. Es lo único de esta pantalla que no se
 *      puede explicar con palabras en un curso: hay que verlo.
 *   2. El plazo. Dos tarjetas pasaron los 3 días y salen en ámbar; las tres
 *      de piel son de ayer y de hoy.
 *   3. Que lo más viejo va arriba, no lo más reciente.
 *
 * Residentes inventados. El material de formación no lleva PHI (regla 7).
 */
import { Andamio, instalar } from '../andamio';
import CambiosDelPisoPage from '@/app/care/cambios/page';

/** Fecha fija: si fuera new Date(), la foto cambiaría cada día que se repita. */
const HACE = (dias: number, hora: string) => {
    const d = new Date('2026-09-11T12:00:00');
    d.setDate(d.getDate() - dias);
    const [h, m] = hora.split(':');
    d.setHours(Number(h), Number(m), 0, 0);
    return d.toISOString();
};

/**
 * La respuesta va PLANA: la pantalla hace setCambios(data.cambios) y
 * setPatrones(data.patrones), no data.data. Envolverla deja la lista vacía y
 * la banda del patrón sin salir, que es justo lo que hay que fotografiar.
 *
 * `patrones` lo calcula el servidor con detectarPatrones() y llega ya hecho —
 * la pantalla no lo deduce. Por eso aquí se escribe a mano, con el mismo
 * formato que arma la ruta: cuantos, enComun y los residentes.
 */
instalar({
    '/api/care/cambio-condicion': {
        success: true,
        patrones: [
            {
                area: 'PIEL',
                areaEtiqueta: 'Piel',
                cuantos: 3,
                enComun: 'todos del grupo BLUE, todos en la planta 2',
                residentes: [
                    { nombre: 'Rosa Medina', habitacion: '204' },
                    { nombre: 'Carmen Delgado', habitacion: '210' },
                    { nombre: 'Elena Figueroa', habitacion: '208' },
                ],
            },
        ],
        // Lo más viejo primero — la ruta ordena reportadoAt asc.
        cambios: [
            {
                id: 'c1',
                area: 'MOVILIDAD',
                areaEtiqueta: 'Se mueve distinto',
                descripcion: 'Ya no se levanta solo del sillón. Hay que darle la mano cada vez que se para, y camina inclinado hacia la izquierda. Hace una semana cruzaba el pasillo sin ayuda.',
                reportadoAt: HACE(4, '14:10'),
                reportadoPor: 'Damaris Soto',
                diasEsperando: 4,
                revisadoAt: null,
                revisadoPor: null,
                resultado: null,
                resultadoEtiqueta: null,
                respuesta: null,
                residente: { id: 'p2', nombre: 'Luis Ortega', habitacion: '112' },
            },
            {
                id: 'c2',
                area: 'APETITO',
                areaEtiqueta: 'Come o bebe distinto',
                descripcion: 'Lleva tres almuerzos dejando más de la mitad. Toma poca agua aunque se la dejo al lado. No se queja de nada cuando le pregunto.',
                reportadoAt: HACE(3, '12:40'),
                reportadoPor: 'Marisol Vega',
                diasEsperando: 3,
                revisadoAt: null,
                revisadoPor: null,
                resultado: null,
                resultadoEtiqueta: null,
                respuesta: null,
                residente: { id: 'p4', nombre: 'Pedro Santana', habitacion: '103' },
            },
            {
                id: 'c3',
                area: 'PIEL',
                areaEtiqueta: 'Piel',
                descripcion: 'Piquiña fuerte en la espalda y los brazos desde anoche. Piel enrojecida, sin herida abierta. Se rasca hasta dormida.',
                reportadoAt: HACE(1, '15:20'),
                reportadoPor: 'Joaneliz Pérez',
                diasEsperando: 1,
                revisadoAt: null,
                revisadoPor: null,
                resultado: null,
                resultadoEtiqueta: null,
                respuesta: null,
                residente: { id: 'p1', nombre: 'Rosa Medina', habitacion: '204' },
            },
            {
                id: 'c4',
                area: 'PIEL',
                areaEtiqueta: 'Piel',
                descripcion: 'Lo mismo que la 204: ronchas en los brazos y detrás del cuello. Se queja de picor al acostarla.',
                reportadoAt: HACE(1, '15:24'),
                reportadoPor: 'Joaneliz Pérez',
                diasEsperando: 1,
                revisadoAt: null,
                revisadoPor: null,
                resultado: null,
                resultadoEtiqueta: null,
                respuesta: null,
                residente: { id: 'p3', nombre: 'Carmen Delgado', habitacion: '210' },
            },
            {
                id: 'c5',
                area: 'PIEL',
                areaEtiqueta: 'Piel',
                descripcion: 'Enrojecimiento y picor en el antebrazo derecho y el pecho. Se lo vi esta mañana al vestirla; ayer no estaba.',
                reportadoAt: HACE(0, '07:35'),
                reportadoPor: 'Yarelis Cruz',
                diasEsperando: 0,
                revisadoAt: null,
                revisadoPor: null,
                resultado: null,
                resultadoEtiqueta: null,
                respuesta: null,
                residente: { id: 'p5', nombre: 'Elena Figueroa', habitacion: '208' },
            },
        ],
    },
});

export default function Captura() {
    // La pantalla es una columna de max-w-3xl centrada. A 1280 sale nadando en
    // blanco; a 900 el encuadre es la columna y un margen.
    return <Andamio ancho={900}><CambiosDelPisoPage /></Andamio>;
}
