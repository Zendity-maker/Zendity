'use client';
/**
 * TEMPORAL en producción (404) — captura de /care/supervisor/rounds.
 *
 * "Rondas de Inspección" del supervisor: las tres rondas del turno, los dos
 * pisos, y el checklist de cuatro criterios por zona.
 *
 * ESTA PANTALLA CASI NO NECESITA SEMBRADO, y eso es buena noticia:
 *
 *   · Los pisos y sus zonas están escritos A MANO dentro del propio
 *     src/app/care/supervisor/rounds/page.tsx (constantes FLOORS y ROUND_TYPES,
 *     primeras ~20 líneas). No salen de la base. La pantalla los pinta igual
 *     con datos o sin ellos.
 *   · NO MUESTRA NI UN NOMBRE DE RESIDENTE. Ni un expediente, ni una
 *     habitación con dueño: "Habitaciones 1-10" es una zona del edificio, no
 *     una persona. Aquí no hay PHI que ocultar porque la pantalla nunca lo
 *     enseña.
 *
 * Llama a UNA sola API: GET /api/care/zone-inspection?hqId=… — las rondas ya
 * firmadas HOY. Eso es todo lo que se parchea abajo.
 *
 * Lo que esa respuesta cambia en la foto, y por qué está armada así:
 *
 *   1. El número verde en la esquina del botón de cada ronda = cuántas zonas
 *      lleva firmadas esa ronda (todayInspections filtrado por roundType).
 *   2. Una zona que YA se firmó en la ronda y el piso que se están mirando
 *      sale en verde con su visto (`alreadyDone`), en vez de en gris.
 *
 * OJO AL ESCRIBIR EL PIE DE LA FOTO: el visto verde significa "existe una fila
 * de esa zona en esta ronda", NO "los cuatro criterios pasaron". `handleSaveRound`
 * manda las CINCO zonas del piso al pulsar "Firmar Ronda", marcadas o sin marcar,
 * y `alreadyDone` solo comprueba que la fila esté. El fixture de abajo pone los
 * cuatro criterios en true a propósito: es el mejor caso, el de una ronda hecha
 * de verdad. El curso no debe enseñar "verde = inspeccionado".
 *
 * La escena es un turno de día a media mañana, con la Ronda 1 EN CURSO: el
 * Piso 1 lleva tres zonas firmadas y le faltan dos; el Piso 2 no ha empezado.
 * Así la misma foto enseña los dos estados de una zona —la verde ya hecha y la
 * gris con su checklist en 0/4 esperando— en vez de una pantalla entera de un
 * solo color, que no explica nada.
 */
import { Andamio, instalar } from '../andamio';
import RondasDeInspeccionPage from '@/app/care/supervisor/rounds/page';

/**
 * Fechas FIJAS y escritas enteras, nunca new Date() sin argumento: la foto
 * tiene que salir igual cada vez que se repita. En esta pantalla ninguna fecha
 * llega a pintarse —`inspections` solo se cuenta y se compara por
 * roundType/floor/zoneName— pero se escriben de verdad para que el fixture
 * tenga la forma que devuelve la ruta y no una recortada.
 *
 * -04:00 es AST, la hora de Puerto Rico.
 */
const EL_DIA = '2026-09-20';
const A_LAS = (hora: string) => `${EL_DIA}T${hora}:00.000-04:00`;

/** Una zona ya firmada, con la forma exacta que devuelve la ruta. */
const firmada = (
    id: string,
    roundType: string,
    floor: number,
    zoneName: string,
    hora: string,
    observations: string | null = null,
) => ({
    id,
    headquartersId: 'demo-hq',
    supervisorId: 'demo-user',
    roundType,
    floor,
    zoneName,
    checklistData: { limpieza: true, seguridad: true, residentes: true, equipo: true },
    observations,
    completedAt: A_LAS(hora),
    createdAt: A_LAS(hora),
    supervisor: { id: 'demo-user', name: 'Ana Rivera' },
});

instalar({
    /**
     * La respuesta va PLANA y bajo `inspections`: la pantalla hace
     * setTodayInspections(data.inspections || []) y antes comprueba
     * data.success. Envolverla en `data` deja los contadores en cero y las
     * zonas todas grises.
     *
     * La ruta ordena createdAt DESC —lo último firmado primero—, así que el
     * fixture va en ese mismo orden.
     *
     * Esta misma tabla responde también al POST de "Firmar Ronda" (el parcheo
     * es por trozo de URL, no por método). Trae success: true, que es lo único
     * que mira handleSaveRound para contar la zona como guardada, así que el
     * botón se puede pulsar en una toma y sale su confirmación abajo. No se
     * escribe nada en ninguna parte: no sale una petición de red.
     */
    '/api/care/zone-inspection': {
        success: true,
        inspections: [
            // Ronda 1 — Piso 1: tres zonas hechas, faltan Recepción y Pasillo Principal.
            firmada('zi-3', 'INICIO', 1, 'Comedor', '09:21', 'Mesa 3 con una pata floja. Avisado a mantenimiento.'),
            firmada('zi-2', 'INICIO', 1, 'Baños P1', '09:14'),
            firmada('zi-1', 'INICIO', 1, 'Habitaciones 1-10', '09:06'),
            // El Piso 2 no ha empezado, y las rondas 2 y 3 tampoco: sus botones
            // salen sin número. A las 9:40 de la mañana es lo que toca —la
            // Ronda 2 es a las 12:30— y una pantalla donde todo está hecho no
            // enseña a usarla.
        ],
    },
});

export default function Captura() {
    // La pantalla es max-w-[1400px] con padding de 8. A 1400 el encuadre es la
    // columna entera sin nadar en blanco.
    return <Andamio ancho={1400}><RondasDeInspeccionPage /></Andamio>;
}
