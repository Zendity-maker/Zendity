'use client';
/** TEMPORAL en producción (404) — captura de /med (Zéndity Med). */
import { Andamio, instalar } from '../andamio';
import ZendityMedPage from '@/app/med/page';

/**
 * La pantalla agrupa por residente y filtra en el cliente, así que el fixture
 * tiene que traer los TRES estados que conviven en una tarjeta:
 *
 *   ACTIVE      lo que ya está en la tableta
 *   DRAFT       lo que dejó una admisión y nadie ha autorizado todavía
 *   DISCONTINUED  lo que se retiró — no se pinta, y esa es la prueba
 *
 * Los residentes son inventados (regla 7: el material de formación no lleva PHI).
 */
const RESIDENTES = [
    {
        id: 'p1', name: 'Rosa Medina', roomNumber: '204', colorGroup: 'BLUE',
        medications: [
            {
                id: 'm1', patientId: 'p1', status: 'ACTIVE', isActive: true,
                scheduleTimes: '08:00 AM, 08:00 PM', frequency: 'DIARIO', scheduleDays: [],
                prepDuration: '2_SEMANAS', prescribedBy: 'Dra. Marrero',
                medication: { id: 'f1', name: 'Metformina', dosage: '500 mg' },
            },
            {
                // El caso semanal: se ve el día en la propia tarjeta.
                id: 'm2', patientId: 'p1', status: 'ACTIVE', isActive: true,
                scheduleTimes: '08:00 AM', frequency: 'SEMANAL', scheduleDays: [5],
                prepDuration: '2_SEMANAS', prescribedBy: 'Dra. Marrero',
                medication: { id: 'f2', name: 'Alendronato', dosage: '70 mg' },
            },
            {
                // Descontinuada: NO debe aparecer en la tarjeta.
                id: 'm3', patientId: 'p1', status: 'DISCONTINUED', isActive: false,
                scheduleTimes: '10:00 PM', frequency: 'DIARIO', scheduleDays: [],
                prepDuration: '2_SEMANAS', prescribedBy: null,
                medication: { id: 'f3', name: 'Trazodona', dosage: '50 mg' },
            },
        ],
    },
    {
        id: 'p2', name: 'Luis Ortega', roomNumber: '112', colorGroup: 'GREEN',
        medications: [
            {
                id: 'm4', patientId: 'p2', status: 'ACTIVE', isActive: true,
                scheduleTimes: '08:00 PM', frequency: 'DIARIO', scheduleDays: [],
                prepDuration: '2_SEMANAS', prescribedBy: 'Dr. Colón',
                medication: { id: 'f4', name: 'Simvastatina', dosage: '20 mg' },
            },
            {
                // LO QUE HAY QUE ENSEÑAR: el borrador que dejó la admisión.
                // Está capturado, tiene hora, y NO llega a la tableta hasta que
                // alguien lo autorice. Antes esto no se veía en ninguna pantalla.
                id: 'm5', patientId: 'p2', status: 'DRAFT', isActive: false,
                scheduleTimes: '08:00 AM, 08:00 PM', frequency: 'DIARIO', scheduleDays: [],
                prepDuration: '1_SEMANA', prescribedBy: null,
                instructions: 'Borrador importado automáticamente desde Intake',
                medication: { id: 'f5', name: 'Baclofeno', dosage: '10 mg' },
            },
        ],
    },
    {
        id: 'p3', name: 'Carmen Delgado', roomNumber: '210', colorGroup: 'YELLOW',
        medications: [
            {
                id: 'm6', patientId: 'p3', status: 'ACTIVE', isActive: true,
                scheduleTimes: '08:00 AM', frequency: 'DIARIO', scheduleDays: [],
                prepDuration: '2_SEMANAS', prescribedBy: 'Dra. Marrero',
                medication: { id: 'f6', name: 'Levotiroxina', dosage: '75 mcg' },
            },
        ],
    },
];

instalar({
    '/api/med/crud': {
        success: true,
        medications: [
            { id: 'f1', name: 'Metformina', dosage: '500 mg', category: 'Endocrino' },
            { id: 'f2', name: 'Alendronato', dosage: '70 mg', category: 'Óseo' },
            { id: 'f7', name: 'Losartán', dosage: '50 mg', category: 'Cardiovascular' },
        ],
    },
    // Ojo al orden: '/api/med' sin barra final también casa con '/api/med/crud'
    // por `includes`, y el andamio devuelve el PRIMER patrón que case. Por eso
    // el catálogo va antes.
    '/api/med': {
        success: true,
        patients: RESIDENTES,
        data: RESIDENTES.flatMap(p => p.medications.map(m => ({ ...m, patient: p }))),
    },
});

export default function CapturaMed() {
    return (
        <Andamio ancho={1400}>
            <ZendityMedPage />
        </Andamio>
    );
}
