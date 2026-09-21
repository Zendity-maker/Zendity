'use client';
/**
 * TEMPORAL en producción (404) — captura de /care/reports/[id]: el reporte de
 * cierre de turno YA FIRMADO, tal como se lee después.
 *
 * POR QUÉ ESTA PANTALLA Y NO EL ASISTENTE DE CIERRE
 * El pie del curso dice que la entrega queda firmada con tu nombre y la hora.
 * En el asistente (/care, "Entregar Turno") eso todavía no se ve: se firma y la
 * pantalla se va. El nombre y la hora aparecen AQUÍ, en el encabezado del
 * reporte guardado, que es donde el supervisor lo lee al día siguiente.
 *
 * POR QUÉ VIVE EN UNA CARPETA [id] Y NO EN /capturas/care-reporte A SECAS
 * La pantalla saca el id con `useParams<{ id: string }>()` y su `useEffect` de
 * carga arranca con `if (!reportId) return;`. En una ruta estática `useParams()`
 * devuelve {}, así que no pide nada, `loading` se queda en true para siempre y
 * la foto sale siendo un spinner. Con el segmento dinámico la pantalla recibe
 * su id igual que en producción. Mismo motivo y misma forma que
 * src/app/capturas/mi-observacion/[id]/page.tsx, que ya lo resolvió así.
 * La foto se toma en /capturas/care-reporte/firmado.
 *
 * EL RELEVO SALE VACÍO A PROPÓSITO
 * `incomingNurse` existe en el modelo y la API lo incluye, pero el cierre desde
 * la tableta nunca lo llena: en producción viene null siempre. Aquí va null.
 * (Y la pantalla, hoy, ni siquiera pinta ese hueco — lee `incomingNurse` en su
 * interfaz y no lo usa en ningún sitio del render. Ver el informe.)
 *
 * Residentes y personal INVENTADOS. El material de formación no lleva PHI
 * (regla 7). Nada de esto sale de la base: está escrito a mano en este fichero.
 */
import { Andamio, instalar } from '../../andamio';
import ReporteDeTurnoPage from '@/app/care/reports/[id]/page';

/**
 * Horas FIJAS. `new Date()` sin argumento haría que la foto cambiara cada vez
 * que se repita, y lo que el curso señala con una flecha es justamente la hora.
 * Se escriben en hora local (sin Z) porque la pantalla las pinta con
 * `toLocaleString('es-PR')`: así el reloj de la foto dice lo que aquí se lee.
 */
const CUANDO = (local: string) => new Date(local).toISOString();

/** El cuerpo del reporte: lo que Zendi propuso y la cuidadora dio por bueno. */
const CUERPO = [
    '**Turno diurno — 6:00 AM a 2:00 PM. Grupos Verde y Azul, doce residentes.**',
    '',
    'Todos desayunaron y almorzaron en el comedor. Rosa Medina (204) durmió mal: se levantó dos veces de madrugada y estuvo decaída toda la mañana, aunque comió completo. Pedro Santana (103) dejó más de la mitad del almuerzo por segundo día seguido; queda anotado para que lo vea enfermería. Carmen Delgado (210) tuvo su baño asistido sin novedad y caminó el pasillo con andador.',
    '',
    '**Queda pendiente:** la curación del talón de Elena Figueroa (208) no se hizo — no había apósito en el carro, se avisó a compras. Sin caídas y sin cambios de condición nuevos en el turno.',
].join('\n');

instalar({
    // La pantalla llama a `/api/care/reports/${id}` con cache: 'no-store'.
    // El interceptor casa por `includes`, así que este patrón basta.
    '/api/care/reports/': {
        success: true,
        report: {
            id: 'firmado',
            shiftType: 'MORNING',
            // HandoverStatus solo tiene PENDING y ACCEPTED (schema.prisma:2393).
            // Decia 'COMPLETED', un valor que la base no puede producir. No se
            // pinta —la pantalla deriva su estado de supervisorSignedAt— pero un
            // fixture imposible es una foto que miente por debajo.
            status: 'ACCEPTED',
            createdAt: CUANDO('2026-09-19T13:58:00'),
            // La hora del cierre: la que sale en el encabezado, al lado del turno.
            signedOutAt: CUANDO('2026-09-19T14:12:00'),
            supervisorSignedAt: CUANDO('2026-09-19T14:41:00'),
            handoverCompleted: true,
            aiSummaryReport: CUERPO,
            colorGroups: ['GREEN', 'BLUE'],
            isDailyPrologue: false,
            supervisorNote: 'Leído. Llamo a compras por el apósito del 208 y le pido a la noche que vigile a la 204. Lo de Pedro Santana va a enfermería hoy mismo.',
            supervisorSignature: 'Ana Rivera·firmado·2026-09-19T14:41:00.000Z',
            // Quien entregó: el nombre grande del encabezado.
            outgoingNurse: { id: 'cuid-demo', name: 'Marisol Vega', role: 'CAREGIVER' },
            // NULL A PROPÓSITO — el cierre desde la tableta no lo llena nunca.
            incomingNurse: null,
            supervisorSigned: { id: 'demo-user', name: 'Ana Rivera', role: 'SUPERVISOR' },
            notes: [
                {
                    id: 'n1',
                    patientId: 'p1',
                    clinicalNotes: 'Noche inquieta. Se levantó a las 2:10 y a las 4:30 diciendo que iba al baño; se la acompañó las dos veces. Por la mañana estuvo callada y se quedó dormida en el sillón después del desayuno.',
                    isCritical: false,
                    patient: { id: 'p1', name: 'Rosa Medina', roomNumber: '204' },
                },
                {
                    id: 'n2',
                    patientId: 'p4',
                    clinicalNotes: 'Segundo almuerzo seguido que deja a la mitad. No se queja de dolor ni de náusea; dice que no tiene hambre. Toma líquidos bien.',
                    isCritical: false,
                    patient: { id: 'p4', name: 'Pedro Santana', roomNumber: '103' },
                },
                {
                    id: 'n3',
                    patientId: 'p5',
                    clinicalNotes: 'Curación del talón derecho NO realizada: no había apósito del tamaño en el carro. Se dejó el talón descubierto y elevado con almohada. Pendiente para el turno de la tarde.',
                    isCritical: true,
                    patient: { id: 'p5', name: 'Elena Figueroa', roomNumber: '208' },
                },
            ],
        },
    },
});

export default function Captura() {
    // La pantalla es una columna max-w-4xl centrada; a 1400 sale nadando en
    // blanco. 1100 encuadra la columna con su margen.
    return <Andamio ancho={1100}><ReporteDeTurnoPage /></Andamio>;
}
