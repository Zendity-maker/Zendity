'use client';
/** TEMPORAL en producción (404) — captura de /mi-desempeno con una empleada inventada. */
import { Andamio, instalar } from '../andamio';
import MiDesempenoPage from '@/app/mi-desempeno/page';
import type { Desempeno } from '@/lib/desempeno';

const HACE = (dias: number) => {
    const d = new Date('2026-09-11T12:00:00');
    d.setDate(d.getDate() - dias);
    d.setHours(9, 30, 0, 0);
    return d.toISOString();
};

/**
 * Las cifras se calculan aquí igual que en src/lib/desempeno.ts —porcentajes y
 * promedios salen de los conteos— para que la foto no enseñe un 90% al lado de
 * un "19 de 21" que no da 90%. Una captura con la aritmética mal se usa en
 * clase y alguien la cree.
 */
function periodo(o: {
    dias: number; turnos: number; cerrados: number; reportes: number;
    mediaTurno: number; cursosHechos: number; cursosAsignados: number;
    observaciones: { fecha: string; categoria: string; severidad: string }[];
}): Desempeno {
    return {
        nombre: 'Joaneliz Pérez',
        rol: 'CAREGIVER',
        dias: o.dias,
        esPiso: true,
        turno: 'noche',
        medidas: [
            {
                etiqueta: 'Turnos cerrados con el relevo',
                valor: `${o.cerrados} de ${o.turnos}`,
                referencia: `${Math.round(100 * o.cerrados / o.turnos)}% de los turnos que trabajaste`,
                detalle: 'Un turno sin cerrar deja al que entra sin saber qué pasó.',
            },
            {
                etiqueta: 'Lo que reportaste del residente',
                valor: `${o.reportes} en ${o.turnos} turnos`,
                referencia: `${(o.reportes / o.turnos).toFixed(2)} por turno · la media de tu turno de noche es ${o.mediaTurno.toFixed(2)}`,
                detalle: 'Se compara solo con quien tiene tu mismo puesto y trabaja tu mismo turno. De noche hay menos que reportar, y eso no cuenta en contra.',
            },
            {
                etiqueta: 'Academy',
                valor: `${o.cursosHechos} de ${o.cursosAsignados} cursos`,
                referencia: `${Math.round(100 * o.cursosHechos / o.cursosAsignados)}% completado`,
            },
        ],
        observaciones: o.observaciones,
        sinDatos: null,
    };
}

const PUNTUALIDAD = { fecha: HACE(12), categoria: 'PUNCTUALITY', severidad: 'OBSERVATION' };
const UNIFORME = { fecha: HACE(47), categoria: 'UNIFORM', severidad: 'WARNING' };

const respuesta = (d: Desempeno) => ({ success: true, desempeno: d, esPropio: true });

/**
 * La pantalla hace `setD(json.desempeno)`, no `setD(json)`: la medida va
 * ENVUELTA. Devolverla plana deja la pantalla en "No se pudo cargar."
 *
 * Y hay un fixture por cada botón de periodo. El orden importa: el interceptor
 * casa por `includes`, así que la clave genérica va LA ÚLTIMA o se traga a las
 * otras dos y los tres botones enseñarían el mismo número.
 */
instalar({
    '/api/mi-desempeno?dias=60': respuesta(periodo({
        dias: 60, turnos: 42, cerrados: 38, reportes: 26, mediaTurno: 0.19,
        cursosHechos: 9, cursosAsignados: 16, observaciones: [PUNTUALIDAD, UNIFORME],
    })),
    '/api/mi-desempeno?dias=90': respuesta(periodo({
        dias: 90, turnos: 61, cerrados: 54, reportes: 37, mediaTurno: 0.18,
        cursosHechos: 9, cursosAsignados: 16, observaciones: [PUNTUALIDAD, UNIFORME],
    })),
    // 30 días — el que sale al abrir.
    '/api/mi-desempeno': respuesta(periodo({
        dias: 30, turnos: 21, cerrados: 19, reportes: 14, mediaTurno: 0.21,
        cursosHechos: 9, cursosAsignados: 16, observaciones: [PUNTUALIDAD],
    })),
});

export default function Captura() {
    return <Andamio ancho={900}><MiDesempenoPage /></Andamio>;
}
