'use client';
/**
 * TEMPORAL en producción (404) — captura de /care con el turno YA ABIERTO.
 *
 * Es la pantalla que más piden los cursos (21 veces). La tableta decide qué
 * enseñar con DOS respuestas encadenadas, y si una de las dos falla sale la
 * pantalla de "elige tu color" en vez del turno:
 *
 *   1. GET /api/care/shift/start?caregiverId=… → { success, activeSession }
 *      Sin `activeSession` la pantalla ni siquiera pregunta el color.
 *   2. GET /api/hr/schedule/my-color → { success, color, colors[], source }
 *      `colors` tiene que traer al menos uno. Si viene vacío, o si `source`
 *      es 'no_color_assigned' / 'shift_not_current', la pantalla LIMPIA el
 *      color a propósito y cae al selector.
 *   3. Sólo entonces pide GET /api/care?color=BLUE&hqId=… y pinta la lista.
 */
import { useEffect } from 'react';
import { Andamio, instalar } from '../andamio';
import PantallaCare from '@/app/care/page';

/**
 * DOS RELOJES, y la diferencia importa.
 *
 * `HOY(hora)` es fecha FIJA: sirve para lo que sólo se imprime (la hora de una
 * toma de vitales sale "7:40 a. m." haga la foto quien la haga, el día que
 * sea).
 *
 * `HACE_MIN` / `EN_MIN` son relativos a ahora porque la pantalla RESTA contra
 * `Date.now()`: el SLA de rotación y la ventana de vitales de entrada. Con una
 * fecha fija, la tarjeta diría "8417.3h / 2.0h" y todas saldrían vencidas.
 * Fijo lo que se imprime, relativo lo que se cuenta.
 */
const HOY = (hora: string) => {
    const d = new Date('2026-09-11T12:00:00');
    const [h, m] = hora.split(':');
    d.setHours(Number(h), Number(m), 0, 0);
    return d.toISOString();
};
const HACE_MIN = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
const EN_MIN = (min: number) => new Date(Date.now() + min * 60_000).toISOString();

/** Un medicamento del turno tal como lo devuelve el include de /api/care. */
const med = (id: string, nombre: string, dosis: string, horas: string) => ({
    id,
    patientId: '',
    frequency: 'DIARIO',
    scheduleTimes: horas, // CSV; se filtra por el turno en curso
    scheduleDays: [] as number[], // vacío = todos los días
    instructions: null,
    isActive: true,
    status: 'ACTIVE',
    medication: { id: `m-${id}`, name: nombre, dosage: dosis, form: 'Tableta' },
    administrations: [] as any[], // ninguno resuelto todavía hoy
});

instalar({
    // ── 1. ¿Hay turno abierto? ────────────────────────────────────────────
    // PLANA: la pantalla lee `data.activeSession`, no `data.data`.
    '/api/care/shift/start': {
        success: true,
        activeSession: {
            id: 'ss-demo-1',
            caregiverId: 'demo-user',
            headquartersId: 'demo-hq',
            shiftType: 'MORNING',
            startTime: HOY('06:00'),
            actualEndTime: null,
            initialCensus: 5,
            colorGroup: 'BLUE',
        },
    },

    // ── 2. ¿Qué grupo cubro? ──────────────────────────────────────────────
    // `colors` es la UNIÓN (una sustituta puede cubrir dos grupos); `color` es
    // el primario y es el que pinta el chip del encabezado.
    '/api/hr/schedule/my-color': {
        success: true,
        color: 'BLUE',
        colors: ['BLUE'],
        source: 'roster',
        shiftNotes: null,
    },

    // Cobertura en vivo. `absentColors` VACÍO a propósito: con un solo color
    // sin cubrir, la pantalla abre sola el modal de "toma este grupo" y tapa
    // la foto entera.
    '/api/care/shift/coverage': {
        success: true,
        coveredColors: ['RED', 'YELLOW', 'GREEN', 'BLUE'],
        absentColors: [],
        alreadyRedistributed: [],
        activeCaregivers: [
            { userId: 'c1', name: 'Joaneliz Pérez', color: 'RED' },
            { userId: 'c2', name: 'Marisol Vega', color: 'GREEN' },
            { userId: 'c3', name: 'Yarelis Cruz', color: 'YELLOW' },
            { userId: 'demo-user', name: 'Ana Rivera', color: 'BLUE' },
        ],
        activeOverrides: [],
        colorFloorMap: null,
    },
    '/api/care/shift/my-coverage': { success: true, hasCoverage: false, totalPatients: 0, groups: [] },

    // ── 3. La lista de residentes ─────────────────────────────────────────
    // `patients` y `events` van al RAÍZ de la respuesta (setPatients(data.patients)).
    // Cada residente llega con sus includes: medications, lifePlans, mealLogs,
    // vitalSigns, bathLogs, pressureUlcers, posturalChanges, vitalsOrders.
    '/api/care?color=': {
        success: true,
        isSolo: false,
        hospitalizedCount: 1,
        ownCount: 4,
        coverageCount: 1,
        events: [
            {
                id: 'ev1',
                title: 'Visita de familia — hija de Rosa',
                type: 'FAMILY',
                startTime: HOY('15:30'),
                patient: { id: 'p1', name: 'Rosa Medina' },
            },
        ],
        patients: [
            {
                // Todo al día: baño hecho, vitales tomados, rotación reciente.
                // Y la etiqueta roja de UPP, que es un botón: la cuidadora
                // registra ahí que cambió el apósito.
                id: 'p1', name: 'Rosa Medina', roomNumber: '204', status: 'ACTIVE', leaveType: null,
                photoUrl: null, colorGroup: 'BLUE', diet: null,
                nortonRisk: true, downtonRisk: true, needsDialysis: false,
                medications: [
                    med('md1', 'Losartan', '50 mg', '8:00 AM, 8:00 PM'),
                    med('md2', 'Calcio + Vitamina D', '600 mg', '9:00 AM, 6:00 PM'),
                ],
                lifePlans: [{
                    id: 'lp1', status: 'ACTIVE',
                    risks: [
                        { area: 'Piel', finding: 'Úlcera sacra en cicatrización', priority: 'Alta' },
                        { area: 'Caídas', finding: 'Se levanta sola de noche', priority: 'Alta' },
                    ],
                    preferences: 'Le gusta el café con leche temprano y la novela de las 4.',
                    dietDetails: 'Blanda, baja en sodio',
                    clinicalSummary: null,
                }],
                mealLogs: [{ id: 'ml1', mealType: 'BREAKFAST' }, { id: 'ml2', mealType: 'LUNCH' }],
                vitalSigns: [{
                    id: 'v1', systolic: 128, diastolic: 76, heartRate: 72,
                    temperature: 98.4, glucose: 104, createdAt: HOY('07:40'),
                }],
                bathLogs: [{ id: 'b1' }],
                pressureUlcers: [{
                    id: 'u1', bodyLocation: 'Sacro', stage: 'II',
                    planTratamiento: 'Limpieza con solución salina y apósito de hidrocoloide cada 24 h.',
                    planEstablecidoPor: 'Enfermera de home care',
                }],
                posturalChanges: [{ id: 'pc1', performedAt: HACE_MIN(35), position: 'Izquierdo lateral' }],
                vitalsOrders: [],
            },
            {
                // Lo que FALTA por hacer: baño pendiente, sin vitales todavía y
                // una orden de vitales de entrada con el reloj corriendo.
                id: 'p2', name: 'Luis Ortega', roomNumber: '112', status: 'ACTIVE', leaveType: null,
                photoUrl: null, colorGroup: 'BLUE', diet: 'Regular',
                nortonRisk: false, downtonRisk: false, needsDialysis: false,
                medications: [
                    med('md3', 'Metformina', '850 mg', '8:00 AM, 6:00 PM'),
                    med('md4', 'Atorvastatina', '20 mg', '9:00 AM, 8:00 PM'),
                    med('md5', 'Tamsulosina', '0.4 mg', '10:00 AM, 7:00 PM'),
                ],
                lifePlans: [],
                mealLogs: [{ id: 'ml3', mealType: 'BREAKFAST' }],
                vitalSigns: [],
                bathLogs: [],
                pressureUlcers: [],
                posturalChanges: [],
                vitalsOrders: [{
                    id: 'vo1', expiresAt: EN_MIN(52), orderedAt: HACE_MIN(188),
                    reason: 'Vitales de entrada del turno',
                }],
            },
            {
                // La diálisis es su martes, no un evento: por eso tiene su
                // propio botón de salida. Temperatura en ámbar (100.2 °F).
                id: 'p3', name: 'Carmen Delgado', roomNumber: '210', status: 'ACTIVE', leaveType: null,
                photoUrl: null, colorGroup: 'BLUE', diet: null,
                nortonRisk: false, downtonRisk: false, needsDialysis: true,
                medications: [med('md6', 'Carbonato de sevelamer', '800 mg', '8:00 AM, 1:00 PM, 7:00 PM')],
                lifePlans: [{
                    id: 'lp3', status: 'ACTIVE',
                    risks: [{ area: 'Nutrición', finding: 'Restricción de líquidos', priority: 'Alta' }],
                    preferences: 'Prefiere que la peinen antes de salir a diálisis.',
                    dietDetails: 'Renal, sin sal',
                    clinicalSummary: null,
                }],
                mealLogs: [{ id: 'ml4', mealType: 'BREAKFAST' }, { id: 'ml5', mealType: 'LUNCH' }, { id: 'ml6', mealType: 'DINNER' }],
                vitalSigns: [{
                    id: 'v2', systolic: 142, diastolic: 88, heartRate: 84,
                    temperature: 100.2, glucose: 118, createdAt: HOY('08:05'),
                }],
                bathLogs: [{ id: 'b2' }],
                pressureUlcers: [],
                posturalChanges: [],
                vitalsOrders: [],
            },
            {
                // Sigue en el censo con el sello "En Hospital". La API vacía sus
                // medicamentos cuando está de salida — el eMAR no se lo pide a
                // nadie mientras no esté en el piso.
                id: 'p4', name: 'Pedro Santana', roomNumber: '103', status: 'TEMPORARY_LEAVE', leaveType: 'HOSPITAL',
                photoUrl: null, colorGroup: 'BLUE', diet: null,
                nortonRisk: false, downtonRisk: true, needsDialysis: false,
                medications: [],
                lifePlans: [],
                mealLogs: [],
                vitalSigns: [],
                bathLogs: [],
                pressureUlcers: [],
                posturalChanges: [],
                vitalsOrders: [],
            },
            {
                // Viene del grupo verde por una ausencia: lleva la etiqueta
                // COBERTURA GREEN y hace que el encabezado diga "4 tuyos ·
                // 1 por cobertura". Su rotación está a punto de vencer (1.8 h
                // de las 2 h), que es el aviso ámbar.
                id: 'p5', name: 'Elena Figueroa', roomNumber: '208', status: 'ACTIVE', leaveType: null,
                photoUrl: null, colorGroup: 'GREEN', diet: null,
                nortonRisk: true, downtonRisk: false, needsDialysis: false,
                overrideInfo: { originalColor: 'GREEN', reason: 'ABSENCE_REDISTRIB' },
                medications: [med('md7', 'Levotiroxina', '75 mcg', '7:00 AM, 7:00 PM')],
                lifePlans: [{
                    id: 'lp5', status: 'ACTIVE',
                    risks: [{ area: 'Piel', finding: 'Encamada, rotación cada 2 h', priority: 'Alta' }],
                    preferences: 'Duerme con la luz del pasillo encendida.',
                    dietDetails: 'Puré',
                    clinicalSummary: null,
                }],
                mealLogs: [{ id: 'ml7', mealType: 'BREAKFAST' }],
                vitalSigns: [{
                    id: 'v3', systolic: 118, diastolic: 70, heartRate: 68,
                    temperature: 97.9, glucose: 96, createdAt: HOY('07:55'),
                }],
                bathLogs: [],
                pressureUlcers: [],
                posturalChanges: [{ id: 'pc2', performedAt: HACE_MIN(108), position: 'Supino' }],
                vitalsOrders: [],
            },
        ],
    },

    // ── Lo que rodea a la lista ───────────────────────────────────────────
    // Nota del supervisor: pinta la franja de color sobre la lista y el botón
    // "Ver todas". `tasks`, no `data`.
    '/api/care/fast-actions': {
        success: true,
        tasks: [{
            id: 'fa1',
            description: '[NOTA][Residente: Luis Ortega] La hija pidió que lo llamen antes del almuerzo.',
            status: 'PENDING',
            createdAt: HACE_MIN(25),
            expiresAt: EN_MIN(35),
            supervisor: { id: 'sup1', name: 'Damaris Soto', role: 'SUPERVISOR' },
        }],
    },

    // Progreso de ronda — el indicador flotante de abajo a la derecha.
    //
    // ESTOS NÚMEROS ESTÁN ELEGIDOS PARA QUE NO SALTE NINGÚN TOAST, y no por
    // gusto: la pantalla celebra con un aviso flotante si `roundsCompleted`
    // sube respecto al poll anterior, y avisa si faltan 3 o menos residentes.
    // Los dos se borran solos a los 5-8 segundos, así que la foto saldría con
    // el aviso o sin él según lo que tardara el disparador. Con la primera
    // ronda en curso (1 de 5, faltan 4) sólo queda el indicador fijo.
    '/api/care/rounds/progress': {
        success: true,
        roundsCompleted: 0,
        residentsInGroup: 5,
        attendedThisRound: 1,
        remainingThisRound: 4,
        pendingResidents: [
            { id: 'p2', name: 'Luis Ortega', room: '112' },
            { id: 'p3', name: 'Carmen Delgado', room: '210' },
            { id: 'p4', name: 'Pedro Santana', room: '103' },
            { id: 'p5', name: 'Elena Figueroa', room: '208' },
        ],
        minutesSinceLastRound: 46,
    },

    // La puntuación propia del topbar. HOY NO SE PIDE: el efecto está detrás de
    // `Z_SCORE_VISIBLE`, que es `false` desde el 09-sep-2026, así que el chip
    // sale con un guion. Se deja el fixture con la forma correcta —`breakdown`
    // y `breakdown.details` campo por campo, que es lo que lee el panel— para
    // el día que el número vuelva a encenderse.
    '/api/care/my-score': {
        success: true,
        score: 86,
        breakdown: {
            base: 70, positives: 14, negatives: 4, rawNegatives: 4,
            observationPenalty: 0, rawObservationPenalty: 0,
            evaluationDelta: 3, extraDelta: 2, roundBonus: 5,
            details: {
                rotationsOnTime: 9, medsAdministered: 41, preventiveAlerts: 2,
                medsOmitted: 1, rotationsLate: 1, fastActionsFailed: 0,
                unclosedSessions: 0, incompleteHandovers: 0, blankShifts: 0,
                appliedObservationsCount: 0, evaluationsCount: 2, extraScoreEventsCount: 3,
            },
        },
    },

    // ORDEN IMPORTANTE: '/api/notifications/unread' va ANTES que
    // '/api/notifications'. El andamio casa por `includes`, y la campana y el
    // poll de visitas comparten prefijo. Si la lista ganara, el poll de
    // FAMILY_VISIT dispararía un toast por cada notificación encima de la foto.
    '/api/notifications/unread': { success: true, notifications: [] },
    '/api/notifications/mark-read': { success: true },
    '/api/notifications': {
        success: true,
        notifications: [
            { id: 'n1', type: 'SHIFT_ALERT', title: 'Vitales de entrada pendientes', message: 'Luis Ortega (112) — la ventana vence en menos de una hora.', isRead: false, createdAt: HACE_MIN(18), link: null },
            { id: 'n2', type: 'HANDOVER', title: 'Relevo recibido', message: 'Yarelis Cruz firmó la entrega del turno de noche.', isRead: true, createdAt: HACE_MIN(190), link: null },
        ],
    },

    // Asistente de entrega de turno (se abre al pulsar "Entregar Turno").
    // Sin `warnings` ni `hardBlockers` el asistente arranca desbloqueado y pide
    // este reporte solo.
    '/api/care/shift/preview': {
        success: true,
        source: 'gpt',
        shiftType: 'MORNING',
        colorGroups: ['BLUE'],
        aiSummaryReport:
            'Turno de mañana del grupo azul, 5 residentes (uno en hospital). Se administraron 41 de 42 medicamentos; queda una omisión justificada de Tamsulosina en Luis Ortega (112) por ausencia en la toma de la mañana.\n\n' +
            'Rosa Medina (204): apósito sacro cambiado a las 9:10 a. m., sin exudado. Rotaciones al día.\n' +
            'Luis Ortega (112): pendiente el baño y los vitales de entrada; la ventana vence esta tarde.\n' +
            'Carmen Delgado (210): temperatura de 100.2 °F a las 8:05 a. m., se notificó a enfermería y se repite la toma en el próximo turno.\n' +
            'Elena Figueroa (208): cubierta del grupo verde, rotación cada 2 h sin atrasos.\n' +
            'Pedro Santana (103): permanece en hospital, sin cambios.',
        patients: [
            { id: 'p1', name: 'Rosa Medina', colorGroup: 'BLUE', roomNumber: '204' },
            { id: 'p2', name: 'Luis Ortega', colorGroup: 'BLUE', roomNumber: '112' },
            { id: 'p3', name: 'Carmen Delgado', colorGroup: 'BLUE', roomNumber: '210' },
            { id: 'p4', name: 'Pedro Santana', colorGroup: 'BLUE', roomNumber: '103' },
            { id: 'p5', name: 'Elena Figueroa', colorGroup: 'GREEN', roomNumber: '208' },
        ],
        activity: {
            medsAdministered: 41, medsOmittedCount: 1, mealCount: 7, bathCount: 2,
            vitalCount: 3, rotations: 9, fallsCount: 0, clinicalAlertsCount: 1,
        },
    },
});

export default function Captura() {
    // El pack vive dentro del modal de Medicamentos de la primera tarjeta.
    // Se abre solo para que la captura salga sin intervencion.
    useEffect(() => {
        const t = setTimeout(() => {
            const b = Array.from(document.querySelectorAll('button'))
                .find(x => (x.textContent ?? '').includes('Medicamentos')) as HTMLButtonElement | undefined;
            b?.click();
        }, 2000);
        return () => clearTimeout(t);
    }, []);

    return <Andamio ancho={1280}><PantallaCare /></Andamio>;
}
