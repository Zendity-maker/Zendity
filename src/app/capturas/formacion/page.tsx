'use client';
/** TEMPORAL en producción (404) — el bloque de Formación de la ficha del empleado. */
import { Andamio, instalar, comoSi } from '../andamio';
import FormacionDelEmpleado from '@/components/hr/FormacionDelEmpleado';

/**
 * El bloque solo, sin la ficha entera alrededor: es lo que hay que mirar y lo
 * que hay que enseñar.
 *
 * El fixture trae los tres estados que conviven de verdad en una persona real
 * —lo medido el 12-sep-2026 daba hasta trece cursos abiertos por cuidadora—:
 *
 *   vencido      un curso que salió de una observación y pasó de los 7 días
 *   con plazo    la ruta de ingreso, 14 días
 *   sin fecha    la certificación geriátrica, que no lleva plazo a propósito
 *
 * El orden lo decide el servidor (`ordenarPendientes`), no este fixture: por eso
 * van deliberadamente desordenados aquí.
 */
instalar({
    '/api/hr/academy/asignar': {
        success: true,
        empleado: { id: 'u1', name: 'Marisol Vega', role: 'CAREGIVER' },
        pendientes: [
            {
                id: 'a1', courseId: 'c1', title: 'Proceso de Cierre de Turno', durationMins: 25,
                reason: 'Incidente de documentación', textoPlazo: 'Venció hace 6 días',
                vencida: true, aMano: false, siguiente: true,
            },
            {
                id: 'a2', courseId: 'c2', title: 'Handover de Enfermeria y Relevo de Turno', durationMins: 30,
                reason: 'Asignado por Celia Sierra: repasar el relevo, el reporte del viernes salió sin las omisiones',
                textoPlazo: 'Quedan 9 días', vencida: false, aMano: true, siguiente: false,
            },
            {
                id: 'a3', courseId: 'c3', title: 'El Cuidador en Zendity', durationMins: 30,
                reason: 'Ruta de ingreso', textoPlazo: 'Quedan 2 días', vencida: false, aMano: false, siguiente: false,
            },
            {
                id: 'a4', courseId: 'c4', title: 'Cuidado Geriátrico General', durationMins: 40,
                reason: 'Certificación geriátrica', textoPlazo: 'Sin fecha límite',
                vencida: false, aMano: false, siguiente: false,
            },
        ],
        catalogo: [
            { id: 'c5', title: 'Protocolo de Respuesta a Caidas', durationMins: 25, category: 'Protocolos Clinicos', yaAsignado: false, yaAprobado: false },
            { id: 'c1', title: 'Proceso de Cierre de Turno', durationMins: 25, category: 'Tecnologia Zendity', yaAsignado: true, yaAprobado: false },
            { id: 'c6', title: 'Turno Nocturno del Cuidador', durationMins: 25, category: 'Operaciones de Piso', yaAsignado: false, yaAprobado: true },
        ],
    },
}, comoSi({ name: 'Celia Sierra', role: 'DIRECTOR' }));

export default function CapturaFormacion() {
    return (
        <Andamio ancho={900}>
            <div className="p-6">
                <FormacionDelEmpleado userId="u1" nombre="Marisol Vega" />
            </div>
        </Andamio>
    );
}
