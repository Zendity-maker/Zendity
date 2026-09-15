'use client';
/**
 * TEMPORAL en producción (404) — la pestaña Medicamentos del expediente, con
 * borradores del ingreso.
 *
 * La forma de los datos es la REAL: cinco recetas del ingreso en DRAFT más dos
 * vivas, que es exactamente lo que tenía Iris Delia Colón el 14-sep-2026 antes
 * de que se autorizaran. Los nombres son inventados — regla 7, esta foto no
 * lleva residentes de verdad.
 */
import { Andamio, instalar, comoSi } from '../andamio';
import PatientEMARTab from '@/components/medical/emar/PatientEMARTab';

const borrador = (id: string, nombre: string, hora: string) => ({
    id, status: 'DRAFT', isActive: false, frequency: 'DIARIO',
    scheduleTimes: hora, scheduleDays: [], prepDuration: '2_SEMANAS',
    instructions: 'Borrador importado automáticamente desde Intake',
    prescribedBy: null,
    medication: { name: nombre, dosage: 'Por Definir', route: 'Oral' },
    administrations: [],
});

const viva = (id: string, nombre: string, hora: string, admins: number) => ({
    id, status: 'ACTIVE', isActive: true, frequency: 'DIARIO',
    scheduleTimes: hora, scheduleDays: [], prepDuration: '1_SEMANA',
    instructions: 'Tomar con alimentos',
    prescribedBy: 'Dra. Marrero, Medicina Interna',
    medication: { name: nombre, dosage: '50 mg', route: 'Oral' },
    administrations: Array.from({ length: admins }, (_, i) => ({
        id: `${id}-a${i}`, status: 'ADMINISTERED',
        administeredAt: new Date(Date.now() - (i + 1) * 86400e3).toISOString(),
        notes: null,
    })),
});

instalar(
    {
        '/api/emar/patient/demo-paciente': {
            success: true,
            adherenceRate: 92,
            weeklyLogsCount: 38,
            medications: [
                viva('v1', 'Losartan 50mg', '08:00 AM', 6),
                borrador('b1', 'Atenolol 25mg', '08:00 AM'),
                borrador('b2', 'Glimepiride 2mg', '08:00 AM'),
                borrador('b3', 'Synthroid 75mcg', '05:00 AM'),
                borrador('b4', 'Ezetimibe 10mg', '08:00 PM'),
                borrador('b5', 'Famotidine 40mg', '08:00 PM'),
                viva('v2', 'Metformina 500mg', '08:00 PM', 4),
            ],
        },
    },
    comoSi({ name: 'Celia Sierra', role: 'DIRECTOR' }),
);

export default function Captura() {
    return <Andamio ancho={1000}><PatientEMARTab patientId="demo-paciente" /></Andamio>;
}
