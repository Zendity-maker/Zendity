'use client';
/**
 * TEMPORAL en producción (404) — el eMAR corporativo con sus rondas reales.
 *
 * La forma de los datos es la MEDIDA en Cupey el 16-sep-2026: rondas de 05:00 AM,
 * 08:00 AM, 12:00 PM, 02:00 PM, 05:00 PM y 08:00 PM, con las diez de las 5:00
 * sin administrar. Los nombres son inventados — regla 7, esta foto no lleva
 * residentes de verdad.
 */
import { Andamio, instalar, comoSi } from '../andamio';
import PantallaEmar from '@/app/corporate/medical/emar/page';

const med = (id: string, nombre: string, franjas: string[], estados: string[]) => ({
    id,
    name: nombre,
    dosage: '25 mg',
    route: 'Oral',
    time: franjas.join(', '),
    instructions: 'Tomar con alimentos',
    status: 'PENDING',
    dosisDeHoy: franjas.map((f, i) => ({ franja: f, estado: estados[i], administeredAt: null })),
    sinAdministrar: estados.filter(e => e === 'MISSED').length,
});

const paciente = (id: string, nombre: string, cuarto: string, meds: any[]) => ({
    id, name: nombre, room: cuarto, medications: meds,
});

instalar(
    {
        '/api/emar': {
            success: true,
            patients: [
                paciente('p1', 'Mercedes Otero', '1-02', [
                    med('m1', 'Levothyroxine Sodium 75 MCG', ['05:00 AM'], ['MISSED']),
                    med('m2', 'Lisinopril 5mg', ['08:00 AM'], ['PENDING']),
                ]),
                paciente('p2', 'Eva N. Morán', '1-04', [
                    med('m3', 'Synthroid 50mcg', ['05:00 AM'], ['MISSED']),
                    med('m4', 'Metformina 500mg', ['08:00 AM', '08:00 PM'], ['ADMINISTERED', 'PENDING']),
                ]),
                paciente('p3', 'Rosa M. Solís', '2-01', [
                    med('m5', 'Levothyroxine 25MCG', ['05:00 AM'], ['MISSED']),
                    med('m6', 'Carbidopa/Levodopa', ['05:00 AM', '02:00 PM', '08:00 PM'], ['MISSED', 'PENDING', 'PENDING']),
                ]),
                paciente('p4', 'Héctor Vélez', '2-03', [
                    med('m7', 'Levothyroxine NA 75MCG', ['05:00 AM'], ['MISSED']),
                    med('m8', 'Pepcid', ['PRN'], []),
                ]),
                paciente('p5', 'Elisa Medina', '2-05', [
                    med('m9', 'Levothyroxine 150MCG', ['05:00 AM'], ['MISSED']),
                    med('m10', 'Atorvastatina 20mg', ['08:00 PM'], ['PENDING']),
                ]),
            ],
        },
    },
    comoSi({ name: 'Andrés Flores', role: 'DIRECTOR' }),
);

export default function Captura() {
    return <Andamio ancho={1200}><PantallaEmar /></Andamio>;
}
