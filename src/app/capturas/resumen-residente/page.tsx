'use client';
/**
 * TEMPORAL en producción (404) — el modal "Resumen de Residente".
 *
 * Es el papel que el supervisor genera cuando un residente sale al hospital.
 * Se abre desde el expediente, /corporate/medical/patients/[id], con el botón
 * "Imprimir Resumen" (estado `summaryOpen`), y también solo tras hospitalizar,
 * con `transferReason` — ahí el marco se pone rojo y se titula "Resumen de
 * Traslado Hospitalario". Esta foto es la primera forma: la que el supervisor
 * abre a propósito.
 *
 * No hace falta montarle contenedor: el componente ES el modal, `fixed
 * inset-0`. Se monta suelto y se pinta solo.
 *
 * LO QUE ESTA FOTO SÍ ENSEÑA — y lo que NO. Importa decirlo aquí porque el
 * curso prometía las cuatro cosas en una vista:
 *
 *   · Alergias destacadas ....... SÍ, en rojo y con el texto real.
 *   · Contacto de emergencia .... SÍ, nombre, parentesco y teléfono.
 *   · Condiciones ............... NO. La vista dice "3 condiciones", el número,
 *                                 no la lista.
 *   · Medicamentos activos ...... NO. Dice "5 activos", tampoco la lista.
 *
 * Las listas completas viven en el PDF que arma
 * src/lib/resumen-residente-pdf.ts al pulsar "Descargar PDF" — ese botón sale
 * en la foto, que es la acción que el curso enseña. El bloque grande de esta
 * misma pantalla que PARECE el papel (el `printRef` de más abajo) está
 * `display: none` y ya nadie lo lee: se quedó de cuando el PDF se hacía con
 * html2canvas. Fotografiarlo sería enseñar un documento que no se produce.
 *
 * Residentes inventados. El material de formación no lleva PHI (regla 7).
 */
import { Andamio, instalar } from '../andamio';
import ResidentSummaryPrint from '@/components/medical/patient/ResidentSummaryPrint';

/**
 * Las alergias NO están en Patient: viven en IntakeData, y la ruta real las
 * trae con `include: { intakeData: true }`. El componente las lee de
 * `data.intakeData.allergies` y las pasa por src/lib/alergias.ts — que trata
 * "N/A", "ninguna" y el vacío como SIN DOCUMENTAR y pinta el aviso ámbar.
 * Aquí el campo dice algo de verdad, así que sale la caja roja.
 */
const ALERGIAS = 'Penicilina · Sulfas (sulfametoxazol)';

/**
 * Los diagnósticos llegan como UN texto con saltos de línea; la pantalla los
 * parte por `\n` y quita el guion de delante para contarlos. Tres líneas, tres
 * condiciones.
 */
const DIAGNOSTICOS = [
    'Hipertensión arterial',
    'Diabetes mellitus tipo 2',
    'Osteoartritis de rodillas',
].map(d => `- ${d}`).join('\n');

/**
 * Fechas fijas: con `new Date()` la foto saldría distinta cada vez.
 *
 * Y una que no depende de este fichero: la edad. La pantalla la calcula con
 * `calcAge()` (ResidentSummaryPrint.tsx:88), que resta contra `Date.now()`, no
 * contra ningún dato del fixture. Con la fecha de nacimiento de abajo la foto
 * dice "83 años" hoy y diría "84" a partir del 18-abr-2027, ella sola, sin que
 * nadie toque nada. Por eso la toma TIENE que llevar `reloj:
 * '2026-09-20T10:00:00'` — es lo único de esta captura que se mueve, y el
 * único sitio donde se puede clavar es la entrada de TOMAS, no aquí.
 */
const VITAL_1 = '2026-09-20T07:15:00.000Z';
const VITAL_2 = '2026-09-19T19:40:00.000Z';

const receta = (
    id: string, nombre: string, dosis: string, frecuencia: string, horario: string,
) => ({
    id,
    frequency: frecuencia,
    scheduleTimes: horario,
    instructions: null,
    medication: { name: nombre, dosage: dosis, route: 'Oral' },
});

instalar({
    // El componente pide /api/care/resident-summary?patientId=… y lee json.patient.
    '/api/care/resident-summary': {
        success: true,
        patient: {
            id: 'demo-residente',
            name: 'Carmen Delgado',
            roomNumber: '210',
            // 83 años al 20-sep-2026 — ver la nota del reloj más arriba.
            dateOfBirth: '1943-04-18T00:00:00.000Z',
            diet: 'Blanda, baja en sodio',
            photoUrl: null,
            colorGroup: 'BLUE',
            status: 'ACTIVE',
            idCardUrl: null,
            medicalPlanUrl: null,
            medicareCardUrl: null,
            ssnLastFour: null,
            insurancePlanName: 'Plan Demostración Salud',
            insurancePolicyNumber: 'DEM-0000-210',
            medicareNumber: null,
            medicaidNumber: null,
            preferredHospital: 'Hospital Municipal de Demostración',
            address: 'Calle Ejemplo 12, Urb. Demostración, San Juan, PR 00926',
            headquarters: {
                id: 'demo-hq',
                name: 'Hogar Demostración',
                logoUrl: null,
                phone: '787-555-0100',
                address: 'Ave. Demostración 500, San Juan, PR 00926',
                billingAddress: null,
            },
            intakeData: {
                allergies: ALERGIAS,
                diagnoses: DIAGNOSTICOS,
                medicalHistory: 'Colecistectomía en 2011. Sin hospitalizaciones en los últimos 12 meses.',
            },
            // Cinco recetas activas — la ruta real filtra por isActive: true.
            medications: [
                receta('m1', 'Losartán', '50 mg', 'DIARIO', '08:00 AM'),
                receta('m2', 'Metformina', '500 mg', 'DOS VECES AL DÍA', '08:00 AM, 08:00 PM'),
                receta('m3', 'Atorvastatina', '20 mg', 'DIARIO', '08:00 PM'),
                receta('m4', 'Acetaminofén', '500 mg', 'SEGÚN NECESIDAD', 'Hasta 3 al día'),
                receta('m5', 'Calcio + Vitamina D', '600 mg / 400 UI', 'DIARIO', '08:00 AM'),
            ],
            // La ruta real trae `take: 2`: los dos últimos, no el historial.
            vitalSigns: [
                {
                    id: 'v1', systolic: 138, diastolic: 82, heartRate: 76,
                    temperature: 98.4, glucose: 142, oxygen: 96,
                    createdAt: VITAL_1,
                    measuredBy: { name: 'Ana Rivera', role: 'SUPERVISOR' },
                },
                {
                    id: 'v2', systolic: 145, diastolic: 88, heartRate: 81,
                    temperature: 98.7, glucose: 158, oxygen: 95,
                    createdAt: VITAL_2,
                    measuredBy: { name: 'Marisol Vega', role: 'CAREGIVER' },
                },
            ],
            /**
             * La pantalla elige de encargado al primero con accessLevel 'Full'.
             * La hija va primera a propósito: es quien contesta el teléfono.
             */
            familyMembers: [
                {
                    id: 'f1', name: 'Mariel Delgado Ortiz',
                    email: 'mariel.delgado@example.com', phone: '787-555-0142',
                    relationship: 'Hija', accessLevel: 'Full', isRegistered: true,
                },
                {
                    id: 'f2', name: 'Héctor Delgado Ortiz',
                    email: 'hector.delgado@example.com', phone: '787-555-0188',
                    relationship: 'Hijo', accessLevel: 'Read', isRegistered: false,
                },
            ],
        },
    },
});

export default function Captura() {
    // El modal es `fixed inset-0` y su tarjeta es max-w-3xl centrada: el ancho
    // del Andamio no lo encuadra, lo hace `recortar` en la toma.
    return (
        <Andamio ancho={1100}>
            <ResidentSummaryPrint patientId="demo-residente" onClose={() => { }} />
        </Andamio>
    );
}
