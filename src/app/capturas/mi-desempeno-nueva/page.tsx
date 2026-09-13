'use client';
/**
 * TEMPORAL en producción (404) — /mi-desempeno para quien lleva poco.
 *
 * No es un caso raro: el 13-sep-2026 eran 4 de las 14 personas de piso. Dos sin
 * un solo turno (Celia, que dirige y no hace piso, y Paola, de alta el día 11) y
 * dos con uno o dos meses (Caridad con diez días, Krystal con tres semanas).
 * Con menos de tres meses no se dibuja gráfica: se dice por qué.
 */
import { Andamio, instalar, comoSi } from '../andamio';
import MiDesempenoPage from '@/app/mi-desempeno/page';

const respuesta = (d: unknown) => ({ success: true, desempeno: d, esPropio: true });

instalar(
    {
        '/api/mi-desempeno/historia': {
            success: true,
            esPropia: true,
            historia: {
                desde: '2026-09-03T11:00:00.000Z',
                turnosTotales: 11,
                truncadaPorElLimiteDeLaBase: false,
                aviso: 'Llevas un mes con turnos registrados. Con un par de meses más, aquí vas a ver cómo ha ido cambiando.',
                meses: [
                    { mes: '2026-09', etiqueta: 'sep', turnos: 11, cerrados: 11, forzados: 0, parcial: 'mes-en-curso' },
                ],
            },
        },
        '/api/mi-desempeno': respuesta({
            nombre: 'Caridad Veras', rol: 'CAREGIVER', dias: 30, esPiso: true, turno: 'mañana',
            medidas: [
                {
                    etiqueta: 'Turnos cerrados con el relevo',
                    valor: '11 de 11',
                    referencia: '100% de los turnos que trabajaste',
                    detalle: 'Un turno sin cerrar deja al que entra sin saber qué pasó.',
                },
                {
                    etiqueta: 'Lo que reportaste del residente',
                    valor: '0 en 11 turnos',
                    referencia: '0.00 por turno · la media de tu turno de mañana es 0.31',
                    detalle: 'Se compara solo con quien tiene tu mismo puesto y trabaja tu mismo turno. De noche hay menos que reportar, y eso no cuenta en contra.',
                },
            ],
            observaciones: [],
            sinDatos: null,
        }),
    },
    comoSi({ id: 'demo-user', name: 'Caridad Veras', role: 'CAREGIVER' }),
);

export default function Captura() {
    return <Andamio ancho={820}><MiDesempenoPage /></Andamio>;
}
