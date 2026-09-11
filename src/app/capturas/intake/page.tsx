'use client';
/** TEMPORAL en producción (404) — captura de /corporate/patients/intake. */
import { Andamio, instalar } from '../andamio';
import IntakeWizardPage from '@/app/corporate/patients/intake/page';

/**
 * Aquí la fecha fija NO sirve, y es la excepción a la regla del resto de
 * capturas. El panel pinta los días con `daysSince(intake.updatedAt)`, que
 * resta contra `Date.now()` dentro de la pantalla real y no puedo tocarlo:
 * si anclara el fixture al 11-sep-2026, la foto diría "4 días" hoy, "11 días"
 * la semana que viene y "un año" cuando alguien repita la captura. Anclando el
 * DESFASE en vez del día, el texto sale idéntico siempre. El medio día de más
 * evita que un `floor` a filo de medianoche baje el número en uno.
 */
const HACE_DIAS = (dias: number) =>
    new Date(Date.now() - (dias + 0.5) * 86_400_000).toISOString();

instalar({
    // Va envuelto: la pantalla hace setPendingReviews(data.intakes ?? []), no
    // data. Y cada fila es el IntakeData entero con `patient` dentro —
    // la ruta hace `...i` sobre el registro de Prisma— más `faltaFamiliar`,
    // que la ruta calcula y NO está en el modelo.
    '/api/corporate/intake/pending-list': {
        success: true,
        // La ruta ordena por updatedAt asc: primero el que lleva más esperando.
        intakes: [
            {
                // Lista para confirmar: tiene familiar registrado, así que el
                // botón teal es lo único que se ve. Cuatro días en rojo.
                id: 'ik1',
                patientId: 'p-carmen',
                status: 'PENDIENTE_REVISION',
                allergies: 'Penicilina, mariscos',
                diagnoses: 'Hipertensión, artritis en rodillas',
                medicalHistory: 'Reemplazo de cadera izquierda en 2021.',
                mobilityLevel: 'ASSISTED',
                continenceLevel: 'CONTINENT',
                dietSpecifics: 'BAJA_SODIO',
                downtonScore: 2,
                bradenScore: 19,
                rawMedications: null,
                snapshotData: null,
                documentAnalysisNotes: null,
                zendiAnalysis: null,
                idVerifiedAt: null,
                createdAt: HACE_DIAS(5),
                updatedAt: HACE_DIAS(4),
                patient: {
                    id: 'p-carmen',
                    name: 'Carmen Delgado',
                    sinFamiliarConocido: false,
                    familyMembers: [{ id: 'f1' }],
                },
                faltaFamiliar: false,
            },
            {
                // El caso que hay que ENSEÑAR: llegó referido del hospital, sin
                // familiar y sin declaración, y la confirmación está bloqueada.
                // Debajo del botón aparece por qué y las dos salidas válidas.
                id: 'ik2',
                patientId: 'p-pedro',
                status: 'PENDIENTE_REVISION',
                allergies: 'Ninguna conocida',
                diagnoses: 'Diabetes tipo 2, deterioro cognitivo leve',
                medicalHistory: 'Referido desde sala de emergencias tras una caída en la casa.',
                mobilityLevel: 'WHEELCHAIR',
                continenceLevel: 'INCONTINENT',
                dietSpecifics: 'DIABETICA',
                downtonScore: 4,
                bradenScore: 14,
                rawMedications: null,
                snapshotData: null,
                documentAnalysisNotes: null,
                zendiAnalysis: null,
                idVerifiedAt: null,
                // Un día, no cero: con 0 la pantalla escribe "En revisión
                // desde hace hoy". Es un fallo de copy de la pantalla real, no
                // del fixture, y no se arregla desde aquí — pero una captura
                // que enseña una frase rota enseña la frase rota.
                createdAt: HACE_DIAS(1),
                updatedAt: HACE_DIAS(1),
                patient: {
                    id: 'p-pedro',
                    name: 'Pedro Santana',
                    sinFamiliarConocido: false,
                    familyMembers: [],
                },
                faltaFamiliar: true,
            },
        ],
    },
});

export default function Captura() {
    return <Andamio ancho={1280}><IntakeWizardPage /></Andamio>;
}
