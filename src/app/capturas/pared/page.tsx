'use client';
/**
 * TEMPORAL en produccion (404) — la pared del piso.
 *
 * Los datos tienen la FORMA de los medidos hoy 16-sep-2026 a mediodia: 10 dosis
 * sin dar de la ronda de las 5, 11 vencidas de las 8, tres curas hechas y una
 * pendiente. Los nombres son inventados — regla 7, esta foto no lleva
 * residentes de verdad.
 */
import { Andamio, instalar, comoSi } from '../andamio';
import Pared from '@/app/wall/page';

const dosis = (med: string, res: string, cuarto: string, franja: string) =>
    ({ residente: res, cuarto, medicamento: med, franja });

instalar(
    {
        '/api/wall/dashboard': {
            success: true,
            data: {
                sede: { nombre: 'Vivid Senior Living Cupey', logoUrl: null },
                mirandoComo: 'Pared — sala de descanso',
                generadoA: new Date().toISOString(),
                meds: {
                    dadas: 143,
                    resueltasDeOtroModo: 2,
                    totalDelDia: 269,
                    sinDar: [
                        dosis('Levothyroxine 75 MCG', 'Mercedes Otero', '2-10', '5:00 AM'),
                        dosis('Synthroid 50mcg', 'Eva N. Morán', '2-09', '5:00 AM'),
                        dosis('Levothyroxine 25MCG', 'Rosa M. Solís', '1-01', '5:00 AM'),
                        dosis('Synthroid 75mcg', 'Iris D. Colón', '1-05', '5:00 AM'),
                        dosis('Levothyroxine 150MCG', 'Elisa Medina', '1-03', '5:00 AM'),
                    ],
                    vencidas: [
                        dosis('Lisinopril 5mg', 'Mercedes Otero', '2-10', '8:00 AM'),
                        dosis('Aspirina 81mg', 'Mercedes Otero', '2-10', '8:00 AM'),
                        dosis('Metformina 500mg', 'Óscar Lugo', '2-01', '8:00 AM'),
                        dosis('Carvedilol 6.25mg', 'Carmen A. Vélez', '1-04', '12:00 PM'),
                    ],
                },
                curas: {
                    hechasHoy: 3,
                    total: 4,
                    pendientes: [
                        { residente: 'José A. Troche', cuarto: '1-04', etapa: '3', zona: 'Talón derecho', curadaHoy: false, horasSinCura: 122.5 },
                    ],
                },
                señalamientosAbiertos: 0,
                residentes: [
                    ['1-01', 'Rosa M. Solís'], ['1-03', 'Elisa Medina'], ['1-04', 'José A. Troche'],
                    ['1-05', 'Iris D. Colón'], ['2-01', 'Óscar Lugo'], ['2-05', 'Luz A. Martínez'],
                    ['2-07', 'Aida Rivera'], ['2-09', 'Eva N. Morán'], ['2-10', 'Mercedes Otero'],
                    ['2-11', 'Héctor Vélez'], ['2-13', 'José Laboy'], ['2-19', 'Milagros Ortiz'],
                ].map(([roomNumber, name], i) => ({ id: `p${i}`, name, roomNumber })),
                menu: null,
            },
        },
    },
    comoSi({ name: 'Pared', role: 'SUPERVISOR' }),
);

export default function Captura() {
    return <Andamio ancho={1400}><Pared /></Andamio>;
}
