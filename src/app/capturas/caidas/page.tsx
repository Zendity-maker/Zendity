'use client';
/** TEMPORAL — captura de /care/caidas con residentes inventados. */
import { Andamio, instalar } from '../andamio';
import CaidasPage from '@/app/care/caidas/page';

const HACE = (dias: number, hora: string) => {
    const d = new Date('2026-09-11T12:00:00');
    d.setDate(d.getDate() - dias);
    const [h, m] = hora.split(':');
    d.setHours(Number(h), Number(m), 0, 0);
    return d.toISOString();
};

instalar({
    '/api/care/incidents': {
        success: true,
        incidents: [
            { id: 'i1', type: 'FALL', severity: 'MILD', patientName: 'Rosa Medina', roomNumber: '204', location: 'Habitación', occurredAt: HACE(3, '03:20'), createdAt: HACE(3, '03:35'), description: 'Encontrada sentada en el piso al lado de la cama. Dijo que iba al baño.' },
            { id: 'i2', type: 'FALL', severity: 'NONE', patientName: 'Luis Ortega', roomNumber: '112', location: 'Pasillo', occurredAt: HACE(11, '19:45'), createdAt: HACE(11, '19:52'), description: 'Se ladeó al levantarse de la silla del comedor. Lo sostuvo la cuidadora.' },
            { id: 'i3', type: 'FALL', severity: 'SEVERE', patientName: 'Pedro Santana', roomNumber: '103', location: 'Baño', occurredAt: HACE(38, '02:50'), createdAt: HACE(40, '09:15'), description: 'Resbaló al salir de la ducha. Se quejó de dolor en la cadera; se llamó al 911.' },
        ],
    },
    '/api/patients': [
        { id: 'p1', name: 'Rosa Medina', roomNumber: '204' },
        { id: 'p2', name: 'Luis Ortega', roomNumber: '112' },
        { id: 'p3', name: 'Carmen Delgado', roomNumber: '210' },
        { id: 'p4', name: 'Pedro Santana', roomNumber: '103' },
    ],
    '/api/care/fall-risk': {
        success: true,
        residentes: [
            { id: 'p1', nombre: 'Rosa Medina', habitacion: '204', nivel: 'HIGH', evaluadoEl: HACE(20, '10:00'), proximaRevision: HACE(-160, '10:00'), vencida: false, puntaje: 7, encamado: false, caidas90d: 2, ultimaCaida: HACE(3, '03:20') },
            { id: 'p4', nombre: 'Pedro Santana', habitacion: '103', nivel: null, evaluadoEl: null, proximaRevision: null, vencida: false, puntaje: null, encamado: true, caidas90d: 1, ultimaCaida: HACE(38, '02:50') },
            { id: 'p3', nombre: 'Carmen Delgado', habitacion: '210', nivel: null, evaluadoEl: null, proximaRevision: null, vencida: false, puntaje: null, encamado: false, caidas90d: 0, ultimaCaida: null },
            { id: 'p5', nombre: 'Elena Figueroa', habitacion: '208', nivel: 'MODERATE', evaluadoEl: HACE(200, '11:00'), proximaRevision: HACE(20, '11:00'), vencida: true, puntaje: 4, encamado: false, caidas90d: 0, ultimaCaida: null },
            { id: 'p2', nombre: 'Luis Ortega', habitacion: '112', nivel: 'LOW', evaluadoEl: HACE(45, '09:00'), proximaRevision: HACE(-135, '09:00'), vencida: false, puntaje: 1, encamado: false, caidas90d: 1, ultimaCaida: HACE(11, '19:45') },
        ],
    },
});

export default function Captura() {
    return <Andamio><CaidasPage /></Andamio>;
}
