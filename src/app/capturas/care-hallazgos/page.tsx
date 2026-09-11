'use client';
/**
 * TEMPORAL en producción (404) — captura de /care/hallazgos.
 *
 * Lo que Zendi saca de las notas del piso, con residentes inventados. La
 * pantalla solo pide una cosa al cargar: `/api/care/hallazgos` (y la misma
 * ruta con `?historial=1` cuando se pulsa la segunda pestaña). La respuesta va
 * ENVUELTA —la pantalla lee `data.hallazgos` tras comprobar `data.success`—,
 * así que una lista pelada la deja en el spinner.
 *
 * Las dos claves están puestas de la LARGA a la CORTA a propósito: el andamio
 * casa por `includes` y en orden de inserción, y `/api/care/hallazgos` también
 * casa con la URL del historial. Al revés, las dos pestañas enseñarían lo
 * mismo.
 */
import { Andamio, instalar } from '../andamio';
import HallazgosPage from '@/app/care/hallazgos/page';

/** Fecha fija: si no, la captura cambia cada día que se repita. */
const HACE = (dias: number, hora: string) => {
    const d = new Date('2026-09-11T12:00:00');
    d.setDate(d.getDate() - dias);
    const [h, m] = hora.split(':');
    d.setHours(Number(h), Number(m), 0, 0);
    return d.toISOString();
};

instalar({
    // Pestaña "Confirmados — falta construirlos". La pantalla filtra a
    // estado === 'CONFIRMADO', así que el DESCARTADO viaja y no se pinta: es
    // lo que hace la de verdad.
    '/api/care/hallazgos?historial=1': {
        success: true,
        hallazgos: [
            {
                id: 'hz-c1',
                tipo: 'SIN_CAMPO',
                tipoEtiqueta: 'No tiene dónde guardarse',
                resumen: 'Varias notas anotan a mano que el residente rechazó el baño y por qué. No hay dónde guardar el motivo del rechazo.',
                evidencia: 'No quiso bañarse hoy tampoco. Dice que el baño está frío y que se baña más tarde. Lo dejé para la tarde y a las 3:00 sí aceptó.',
                sugerencia: 'Un motivo de rechazo en el registro de baño, como el que ya tiene el eMAR al omitir un medicamento.',
                fuente: 'DailyLog:dl-7712',
                estado: 'CONFIRMADO',
                nota: '',
                diasEsperando: 19,
                revisadoAt: HACE(16, '09:40'),
                revisadoPor: 'Ana Rivera',
                residente: { id: 'p2', nombre: 'Luis Ortega', habitacion: '112' },
            },
            {
                id: 'hz-c2',
                tipo: 'SIN_CAMPO',
                tipoEtiqueta: 'No tiene dónde guardarse',
                resumen: 'La nota deja por escrito una instrucción dada a la familia. Queda en el texto y nadie la ve al turno siguiente.',
                evidencia: 'Le expliqué a la hija que no le traiga dulces porque el doctor le bajó el azúcar y ella dijo que entendía.',
                sugerencia: 'Un renglón de acuerdos con la familia en el expediente, visible desde el portal familiar.',
                fuente: 'DailyLog:dl-7903',
                estado: 'CONFIRMADO',
                nota: '',
                diasEsperando: 12,
                revisadoAt: HACE(9, '14:05'),
                revisadoPor: 'Ana Rivera',
                residente: { id: 'p3', nombre: 'Carmen Delgado', habitacion: '210' },
            },
            {
                id: 'hz-c3',
                tipo: 'SIN_CAMPO',
                tipoEtiqueta: 'No tiene dónde guardarse',
                resumen: 'Pide un campo para anotar caídas.',
                evidencia: 'Debería haber un sitio donde escribir las caídas sin tener que ponerlo en la nota del día.',
                sugerencia: null,
                fuente: 'DailyLog:dl-7550',
                estado: 'DESCARTADO',
                nota: 'El botón de Caída, en la tableta',
                diasEsperando: 24,
                revisadoAt: HACE(21, '11:20'),
                revisadoPor: 'Ana Rivera',
                residente: null,
            },
        ],
    },

    // Pestaña "Por decidir" — la de la foto. Va primero lo más viejo, igual
    // que la ruta real (orderBy createdAt asc cuando no es historial).
    '/api/care/hallazgos': {
        success: true,
        hallazgos: [
            {
                id: 'hz-1',
                tipo: 'ALERTA_NO_ESCALADA',
                tipoEtiqueta: 'Debió avisar y no avisó',
                resumen: 'La nota describe una caída y ese día no se registró ningún incidente de caída para esta residente.',
                evidencia: 'La encontré sentada en el piso al lado de la cama a las 3:20 de la madrugada. Dice que iba al baño sola. La revisé, no se quejó de dolor, la acosté otra vez y quedó tranquila.',
                sugerencia: 'Si fue una caída, va por el botón de Caída en la tableta: así entra en el conteo del mes y en el riesgo de caída de la residente.',
                fuente: 'DailyLog:dl-8821',
                diasEsperando: 6,
                residente: { id: 'p1', nombre: 'Rosa Medina', habitacion: '204' },
            },
            {
                id: 'hz-2',
                tipo: 'SIN_CAMPO',
                tipoEtiqueta: 'No tiene dónde guardarse',
                resumen: 'El texto dice con detalle qué acepta y qué rechaza. Eso vive solo en la nota: al turno siguiente hay que leerla entera para enterarse.',
                evidencia: 'Solo se comió la avena. Desde el lunes rechaza el arroz y las habichuelas, dice que le caen pesadas. Le di Ensure y eso sí se lo tomó completo.',
                sugerencia: 'Preferencias de alimentación en el expediente, que se vean al servir la bandeja.',
                fuente: 'DailyLog:dl-8899',
                diasEsperando: 4,
                residente: { id: 'p2', nombre: 'Luis Ortega', habitacion: '112' },
            },
            {
                id: 'hz-3',
                tipo: 'CONTRADICCION',
                tipoEtiqueta: 'Contradice al expediente',
                resumen: 'El expediente dice que se desplaza en silla de ruedas. La nota la describe caminando con asistencia de una persona.',
                evidencia: 'La llevé caminando al comedor agarrada de mi brazo y regresó igual, sin el andador y sin cansarse.',
                sugerencia: 'Si su movilidad cambió, conviene abrirlo en "Algo cambió en el residente" para que enfermería lo revise.',
                fuente: 'DailyLog:dl-8914',
                diasEsperando: 2,
                residente: { id: 'p3', nombre: 'Carmen Delgado', habitacion: '210' },
            },
            {
                id: 'hz-4',
                tipo: 'SIN_CAMPO',
                tipoEtiqueta: 'No tiene dónde guardarse',
                resumen: 'Se le prometió una llamada a una familia y no hay dónde anotar que alguien tiene que devolverla.',
                evidencia: 'Llamó la hija preguntando por la cita del oftalmólogo y le dije que la trabajadora social la llama el lunes.',
                sugerencia: null,
                fuente: 'DailyLog:dl-8920',
                diasEsperando: 0,
                residente: null,
            },
        ],
    },
});

export default function Captura() {
    return <Andamio ancho={1000}><HallazgosPage /></Andamio>;
}
