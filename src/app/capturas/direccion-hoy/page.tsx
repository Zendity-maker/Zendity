'use client';
/**
 * TEMPORAL en producción (404) — la pantalla de dirección reescrita.
 *
 * Los datos son los MEDIDOS en Cupey el 14-sep-2026 con
 * `construirPantallaDireccion`, no inventados: así la foto enseña la forma que
 * de verdad tiene la pantalla un día cualquiera, incluida la franja de anoche
 * vacía, que es el caso más común y el que más fácil se diseña mal.
 */
import { Andamio, instalar, comoSi } from '../andamio';
import PantallaDireccion from '@/app/corporate/page';

const hace = (h: number) => new Date(Date.now() - h * 3600e3).toISOString();

instalar(
    {
        '/api/corporate/hoy': {
            success: true,
            pantalla: {
                sede: { id: 'demo-hq', nombre: 'Vivid Senior Living Cupey' },
                desde: hace(14),
                // Lo medido: una noche tranquila. Es el caso más frecuente.
                anoche: [],
                decisiones: [
                    {
                        que: 'Registrar las curaciones de las úlceras de estadio 3 o 4',
                        porque: '3 de estadio alto, y 2 sin nota reciente',
                        quien: 'Enfermería, desde Rotación / UPP',
                    },
                    {
                        que: 'Decidir las observaciones de personal que el empleado ya contestó',
                        porque: '2 paradas, la más vieja lleva 67 días',
                        quien: 'Dirección o Recursos Humanos',
                    },
                    {
                        que: 'Revisar con enfermería las dietas que no coinciden con el diagnóstico',
                        porque: '5 residentes; la cocina arma las bandejas desde ese campo',
                        quien: 'Enfermería con cocina',
                    },
                    {
                        que: 'Averiguar por qué no se aceptan los relevos de turno',
                        porque: '63 sin aceptar — a este volumen no es olvido, es que algo del flujo no funciona',
                        quien: 'Supervisión',
                    },
                    {
                        que: 'Preguntar por la formación que venció',
                        porque: '8 cursos con plazo pasado en 3 personas. El más viejo lleva 22 días asignado',
                        quien: 'Dirección',
                    },
                    {
                        que: 'Recordar la encuesta a las 25 familias que no han contestado',
                        porque: 'Han respondido 2 de 27 — un 7%. Un promedio sobre 2 respuestas no dice nada del hogar.',
                        quien: 'Dirección, en Encuestas',
                    },
                ],
                piso: {
                    enTurno: [
                        { caregiverId: '1', nombre: 'Zuleyka Valcárcel', colores: ['AZUL'], desde: hace(3) },
                        { caregiverId: '2', nombre: 'Brendali Collazo', colores: ['VERDE'], desde: hace(3) },
                        { caregiverId: '3', nombre: 'Carlos Negrón', colores: ['ROJO'], desde: hace(3) },
                    ],
                    ausencias: [],
                    corriendo: { enHospital: [{ nombre: 'R. M.' }, { nombre: 'C. T.' }], alertasAbiertas: 8, rotacionesVencidas: 0 },
                    progreso: {
                        banos: { hecho: 29, total: 30 },
                        comidas: { hecho: 28, total: 30 },
                        vitales: { hecho: 29, total: 30 },
                    },
                    sinActividad: [],
                    sinContactoFamilia: [],
                },
                parado: [
                    { que: '10 observaciones esperando decisión', dias: 67, cuantos: 10, enlace: '/hr/incidents' },
                    { que: '191 relevos sin firmar', dias: 29, cuantos: 191, enlace: '/care/reports' },
                    { que: '8 alertas clínicas sin cerrar', dias: 18, cuantos: 8, enlace: '/care/supervisor' },
                    { que: '6 ausencias sin motivo anotado', dias: 0, cuantos: 6, enlace: '/hr/schedule' },
                ],
            },
        },
    },
    comoSi({ name: 'Andrés Flores', role: 'DIRECTOR' }),
);

export default function Captura() {
    return <Andamio ancho={900}><PantallaDireccion /></Andamio>;
}
