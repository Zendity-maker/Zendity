'use client';
/** TEMPORAL en producción (404) — captura del panel del supervisor. */
import { Andamio, instalar } from '../andamio';
import PanelSupervisor from '@/app/care/supervisor/page';

const HOY = (hora: string) => {
    const d = new Date('2026-09-11T12:00:00');
    const [h, m] = hora.split(':');
    d.setHours(Number(h), Number(m), 0, 0);
    return d.toISOString();
};
/**
 * RELATIVO A AHORA, no a un dia fijo.
 *
 * Estaba anclado a 2026-09-11T12:00 y la pantalla pinta "hace Xm" restando
 * contra Date.now() por dentro: la foto decia "hace 448m" en un ticket que el
 * fixture describe como de hace dos horas, y cada vez que se repitiera la
 * captura diria otra cosa. Anclando el DESFASE el texto sale igual siempre.
 */
const HACE_H = (horas: number) => new Date(Date.now() - horas * 3600_000).toISOString();

instalar({
    // La respuesta de /live va PLANA: la pantalla hace setLiveData(data), no
    // data.data. Envolverla en {data:...} deja liveStats undefined y la
    // pantalla revienta al pintar el contador de baños.
    '/api/care/supervisor/live': {
        success: true,
        activeCaregivers: 4,
        currentShift: 'MORNING',
        liveStats: { baths: 11, meals: { BREAKFAST: 31, LUNCH: 14 }, incidents: 1, triageInbox: 3 },
        activeSessions: [
            { id: 's1', caregiverId: 'c1', startTime: HOY('06:00'), caregiver: { id: 'c1', name: 'Joaneliz Pérez', role: 'CAREGIVER' }, colorGroup: 'RED' },
            { id: 's2', caregiverId: 'c2', startTime: HOY('06:00'), caregiver: { id: 'c2', name: 'Marisol Vega', role: 'CAREGIVER' }, colorGroup: 'BLUE' },
            { id: 's3', caregiverId: 'c3', startTime: HOY('06:05'), caregiver: { id: 'c3', name: 'Yarelis Cruz', role: 'CAREGIVER' }, colorGroup: 'GREEN' },
            { id: 's4', caregiverId: 'c4', startTime: HOY('06:00'), caregiver: { id: 'c4', name: 'Damaris Soto', role: 'CAREGIVER' }, colorGroup: 'YELLOW' },
        ],
        zombieSessions: [],
        /**
         * VACIO A PROPOSITO, Y NO ES UN OLVIDO.
         *
         * El bloque "Brechas — turnos cerrados sin handover" existe en la
         * pantalla pero en produccion NO PUEDE mostrar nada: en
         * src/app/api/care/supervisor/live/route.ts:537 `missingHandovers` es
         * un array vacio literal, con el comentario de que se derivaba del
         * modelo legacy ShiftSchedule y esta pendiente de migrar a
         * ScheduledShift. Rellenarlo aqui daria una foto de algo que ninguna
         * supervisora ha visto nunca — justo lo que hizo viejos los cursos.
         *
         * Lo que SI existe y se fotografia es el bloque de abajo:
         * "Esperando tu firma", que sale de handoversFeed.
         */
        missingHandovers: [],
        handoversFeed: [
            { id: 'hf1', shiftType: 'NIGHT', status: 'PENDING', derivedStatus: 'PENDING_SUPERVISOR',
              createdAt: HACE_H(6), signedOutAt: HACE_H(6), supervisorSignedAt: null, handoverCompleted: true,
              outgoingName: 'Ivelisse Ramos', outgoingId: 'c9', incomingName: null, supervisorName: null,
              colorGroups: ['RED', 'YELLOW'], patientCount: 8, aiSummaryReport: null, dupCount: 1 },
            { id: 'hf2', shiftType: 'MORNING', status: 'ACCEPTED', derivedStatus: 'SUPERVISOR_SIGNED',
              createdAt: HACE_H(2), signedOutAt: HACE_H(2), supervisorSignedAt: HACE_H(1.5), handoverCompleted: true,
              outgoingName: 'Joaneliz Pérez', outgoingId: 'c1', incomingName: 'Marisol Vega', supervisorName: 'Ana Rivera',
              colorGroups: ['BLUE'], patientCount: 7, aiSummaryReport: null, dupCount: 1 },
        ],
        pendingComplaints: [],
        triageFeed: [
            { id: 't1', sourceId: 'd1', sourceType: 'DAILY_LOG', category: 'CLINICAL_ALERT', title: 'Piquiña y enrojecimiento', description: 'Se queja de picazón en la espalda y los brazos. Piel enrojecida, sin herida abierta.', patientId: 'p1', patientName: 'Rosa Medina', authorId: 'c1', authorName: 'Joaneliz Pérez', authorRole: 'CAREGIVER', urgency: 'INMINENTE', createdAt: HACE_H(2) },
            { id: 't2', sourceId: 'd2', sourceType: 'DAILY_LOG', category: 'CLINICAL_ALERT', title: 'Comió el 25% del almuerzo', description: 'Tercer día seguido dejando casi todo. No se queja de nada.', patientId: 'p2', patientName: 'Luis Ortega', authorId: 'c2', authorName: 'Marisol Vega', authorRole: 'CAREGIVER', urgency: 'ATENCION', createdAt: HACE_H(4) },
            { id: 't3', sourceId: 'u1', sourceType: 'UPP_SLA', category: 'UPP_SLA', title: 'Rotación vencida', description: 'Lleva 3h 40min sin cambio de posición. El plan indica cada 2 horas.', patientId: 'p4', patientName: 'Pedro Santana', patientIdParaRotar: 'p4', ultimaRotacion: HACE_H(3.7), urgency: 'INMINENTE', createdAt: HACE_H(1) },
        ],
        activeFastActions: [],
        fallIncidents: [],
        morningBriefing: 'Turno de mañana con los cuatro colores cubiertos. Dos avisos clínicos abiertos y una rotación vencida en la 103. Rosa Medina (204) sigue en riesgo alto de caída: se cayó hace tres días de madrugada.',
        lastBriefingAt: HOY('06:30'),
        vitalsFeed: [],
        vitalsByCaregiver: [],
        vitalsTotals: { tomados: 26, esperados: 31, pct: 84 },
        medsProgress: { shift: 'MORNING', completed: 48, total: 50, pct: 96 },
        teamScores: [],
        observationsFeed: [],
        incidentAppeals: [],
        roundsSummary: { completedSlots: 2, totalSlots: 3 },
        inboxHistory: [],
    },
    '/api/care/supervisor/caregiver-rounds': {
        success: true,
        isNightShift: false,
        floorsConfigured: true,
        activeFloors: ['1', '2'],
        unassignedFloorPatientsCount: 0,
        caregivers: [
            { caregiverId: 'c1', name: 'Joaneliz Pérez', colorGroup: 'RED', colorGroups: ['RED'], floors: ['2'], roundsCompleted: 2, residentsInGroup: 8, attendedThisRound: 8, remainingThisRound: 0, pendingResidents: [], minutesSinceLastRound: 25, isNightShift: false, shiftStartedAt: HOY('06:00'), hasUnmappedFloor: false, coverageCount: 8 },
            { caregiverId: 'c2', name: 'Marisol Vega', colorGroup: 'BLUE', colorGroups: ['BLUE'], floors: ['2'], roundsCompleted: 2, residentsInGroup: 8, attendedThisRound: 5, remainingThisRound: 3, pendingResidents: [{ id: 'p2', name: 'Luis Ortega', roomNumber: '112' }, { id: 'p6', name: 'Ana Colón', roomNumber: '206' }, { id: 'p7', name: 'Julio Ruiz', roomNumber: '211' }], minutesSinceLastRound: 95, isNightShift: false, shiftStartedAt: HOY('06:00'), hasUnmappedFloor: false, coverageCount: 8 },
            { caregiverId: 'c3', name: 'Yarelis Cruz', colorGroup: 'GREEN', colorGroups: ['GREEN'], floors: ['1'], roundsCompleted: 2, residentsInGroup: 7, attendedThisRound: 7, remainingThisRound: 0, pendingResidents: [], minutesSinceLastRound: 40, isNightShift: false, shiftStartedAt: HOY('06:05'), hasUnmappedFloor: false, coverageCount: 7 },
            { caregiverId: 'c4', name: 'Damaris Soto', colorGroup: 'YELLOW', colorGroups: ['YELLOW'], floors: ['1'], roundsCompleted: 1, residentsInGroup: 8, attendedThisRound: 8, remainingThisRound: 0, pendingResidents: [], minutesSinceLastRound: 15, isNightShift: false, shiftStartedAt: HOY('06:00'), hasUnmappedFloor: false, coverageCount: 8 },
        ],
    },
    '/api/care/supervisor/uncovered-colors': { success: true, data: { uncovered: [], assignments: [] } },
    '/api/hr/schedule/draft-status': { success: true, hasDraft: false },
    '/api/care/supervisor': { success: true, data: { tasks: [] } },
});

export default function Captura() {
    return <Andamio ancho={1280}><PanelSupervisor /></Andamio>;
}
