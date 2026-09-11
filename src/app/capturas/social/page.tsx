'use client';
/** TEMPORAL en producción (404) — captura de /corporate/social (Trabajo Social). */
import { Andamio, instalar, comoSi } from '../andamio';
import CorporateSocialDashboard from '@/app/corporate/social/page';

/**
 * Cuatro bloques que enseñar: las cuatro medidas de arriba, la tabla de tareas
 * pendientes, los beneficios por vencer y las notas recientes.
 *
 * Dos detalles que hay que forzar para que la foto enseñe algo:
 *
 *  - Una tarea con `isZendiSuggested: true` — la tabla le pinta la chispita
 *    violeta al lado, y es la única forma de ver de un vistazo qué propuso Zendi
 *    y qué escribió una persona.
 *  - Una fecha límite YA VENCIDA — sale en rojo con "(vencida)" detrás. Es el
 *    estado que hay que reconocer, y con fechas futuras no aparece nunca.
 *
 * `overdueSpecialists` va vacío A PROPÓSITO: la API lo devuelve vacío desde el
 * 31-may-2026 (el modelo SpecialistVisit se retiró). Rellenarlo aquí haría una
 * foto de algo que en producción nadie ve.
 */
const HOY = Date.now();
const DIAS = (d: number) => new Date(HOY + d * 86_400_000).toISOString();

instalar({
    '/api/social/dashboard': {
        success: true,
        stats: {
            totalActiveResidents: 31,
            tasksCompletedThisWeek: 7,
            totalPendingTasks: 4,
            benefitsExpiringSoon: 2,
        },
        pendingTasks: [
            {
                id: 's1', title: 'Renovar plan Medicare antes del vencimiento',
                description: null, category: 'BENEFIT', priority: 'URGENT', status: 'PENDING',
                dueDate: DIAS(-3), isZendiSuggested: false,
                patient: { id: 'p1', name: 'Rosa Medina', roomNumber: '204' },
                createdBy: { id: 'u1', name: 'Marta Colón' }, assignedTo: null,
            },
            {
                id: 's2', title: 'Llamar a la hija: lleva tres semanas sin visitar',
                description: null, category: 'FAMILY', priority: 'HIGH', status: 'PENDING',
                dueDate: DIAS(2), isZendiSuggested: true,
                patient: { id: 'p2', name: 'Luis Ortega', roomNumber: '112' },
                createdBy: { id: 'u1', name: 'Marta Colón' }, assignedTo: null,
            },
            {
                id: 's3', title: 'Falta la firma del consentimiento de fotografía',
                description: null, category: 'DOCUMENT', priority: 'NORMAL', status: 'PENDING',
                dueDate: DIAS(9), isZendiSuggested: false,
                patient: { id: 'p3', name: 'Carmen Delgado', roomNumber: '210' },
                createdBy: { id: 'u1', name: 'Marta Colón' }, assignedTo: null,
            },
            {
                id: 's4', title: 'Coordinar transporte a la cita de podiatría',
                description: null, category: 'APPOINTMENT', priority: 'LOW', status: 'PENDING',
                dueDate: null, isZendiSuggested: false,
                patient: { id: 'p4', name: 'Elena Figueroa', roomNumber: '208' },
                createdBy: { id: 'u1', name: 'Marta Colón' }, assignedTo: null,
            },
        ],
        expiringBenefits: [
            { id: 'b1', type: 'MEDICARE', status: 'ACTIVE', expirationDate: DIAS(11), details: 'Parte B', patient: { id: 'p1', name: 'Rosa Medina' } },
            { id: 'b2', type: 'SNAP', status: 'ACTIVE', expirationDate: DIAS(24), details: null, patient: { id: 'p5', name: 'Pedro Santana' } },
        ],
        overdueSpecialists: [],
        recentNotes: [
            {
                id: 'n1', category: 'FAMILY',
                content: 'La familia pregunta por el cambio de habitación. Se explica que la 204 está más cerca del puesto de enfermería y quedan conformes.',
                createdAt: new Date(HOY - 4 * 3_600_000).toISOString(),
                patient: { id: 'p1', name: 'Rosa Medina' }, createdBy: { id: 'u1', name: 'Marta Colón' },
            },
            {
                id: 'n2', category: 'BENEFITS',
                content: 'Entregada en la oficina la documentación de renovación. Acuse recibido, queda copia en el expediente.',
                createdAt: new Date(HOY - 27 * 3_600_000).toISOString(),
                patient: { id: 'p5', name: 'Pedro Santana' }, createdBy: { id: 'u1', name: 'Marta Colón' },
            },
        ],
    },
}, comoSi({ name: 'Marta Colón', role: 'SOCIAL_WORKER' }));

export default function CapturaSocial() {
    return (
        <Andamio ancho={1440}>
            <CorporateSocialDashboard />
        </Andamio>
    );
}
