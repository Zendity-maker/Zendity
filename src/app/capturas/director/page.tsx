'use client';
/** TEMPORAL en producción (404) — captura de /corporate (Dashboard Gerencial). */
import { Andamio, instalar, comoSi } from '../andamio';
import CorporateDashboard from '@/app/corporate/page';

/**
 * El panel de dirección es la pantalla más cargada de Zendity y lo que hay que
 * enseñar de ella son DOS cosas, no quince:
 *
 *  1. El briefing de Zendi: qué pasó en el hogar hoy, en frases, con prioridad
 *     y con un enlace a donde se arregla. Es lo que Celia lee cada mañana.
 *  2. Las pastillas en vivo: contadores que se pulsan y abren el detalle de
 *     quién está detrás del número.
 *
 * El briefing NO se genera aquí: se sirve ya escrito, como lo sirve la ruta real
 * (que lo guarda en caché por día clínico). Las frases del fixture son del mismo
 * tipo que las reales, con residentes inventados.
 *
 * `priority` es un enum de cuatro valores y la pantalla pinta un color por cada
 * uno: se incluyen CRITICAL, HIGH y MEDIUM para que la foto enseñe la escala.
 */
const HOY = new Date();
const AYER_N = (n: number) => {
    const d = new Date(HOY.getTime() - n * 86_400_000);
    return d.toISOString().slice(0, 10);
};
const SERIE = (n: number, f: (i: number) => any) => Array.from({ length: n }, (_, i) => ({ date: AYER_N(n - 1 - i), ...f(i) }));

instalar({
    // Ojo al orden: el andamio devuelve el PRIMER patrón que case por `includes`,
    // así que las rutas más específicas van ANTES que '/api/corporate'.
    '/api/corporate/director-briefing': {
        success: true,
        briefing: {
            id: 'b1', scope: 'HQ', clinicalDay: AYER_N(0),
            generatedAt: new Date(HOY.getTime() - 40 * 60_000).toISOString(),
            model: 'gpt-4o',
            summary: 'El piso va al día. Hay dos cosas que piden una decisión tuya hoy: una úlcera que lleva nueve días sin curación registrada y un relevo de anoche sin firmar.',
            bullets: [
                {
                    priority: 'CRITICAL',
                    title: 'Úlcera sin curación registrada en 9 días',
                    description: 'Rosa Medina (204), UPP sacro estadio 3. La última curación consta del 2 de septiembre.',
                    action: 'Abrir la pantalla de piel y decidir si se cura hoy o se deriva.',
                    link: '/care/nursing',
                },
                {
                    priority: 'HIGH',
                    title: 'Relevo de la noche sin firmar',
                    description: 'El turno de noche cerró a las 6:12 y nadie ha firmado la recepción.',
                    action: 'Pedir la firma al turno de mañana antes del mediodía.',
                    link: '/care/supervisor',
                },
                {
                    priority: 'MEDIUM',
                    title: 'Comidas sin registrar',
                    description: 'Desayuno 28/31. Faltan tres residentes por registrar.',
                    action: 'Recordar al piso que el registro se hace al servir, no al final del turno.',
                },
            ],
        },
    },
    '/api/corporate/live': {
        success: true,
        timestamp: new Date().toISOString(),
        totals: { activePatients: 31, handoversToday: 3 },
        chips: {
            activeCaregivers: 4, bathsToday: 12, mealsToday: 28, incidentsWeek: 2,
            triageOpen: 1, handoversPending: 1, zombiePatients: 0, onHospitalLeave: 1,
        },
        details: {},
    },
    '/api/corporate/modules': { success: true, openTriage: 1, unreadFamily: 2, draftSchedules: 1 },
    '/api/corporate/trends': {
        success: true, days: 7, activePatients: 31,
        series: {
            emar: SERIE(7, i => ({ compliance: [96, 98, 94, 99, 97, 98, 99][i], total: 300 + i })),
            handovers: SERIE(7, i => ({ total: 3, signed: [3, 3, 2, 3, 3, 3, 2][i], pending: [0, 0, 1, 0, 0, 0, 1][i], avgLatencyHours: 1.2 })),
            vitals: SERIE(7, i => ({ total: 60, abnormal: [3, 2, 4, 1, 2, 2, 3][i] })),
            triage: SERIE(7, i => ({ opened: [1, 0, 2, 1, 0, 1, 1][i], resolved: [1, 1, 1, 1, 0, 1, 0][i], avgMttrHours: 5.4 })),
            baths: SERIE(7, i => ({ total: 20 + i, perPatient: 0.7 })),
            meals: SERIE(7, i => ({ total: 90, uniquePatientMeals: 88, coverage: [95, 97, 92, 98, 96, 97, 94][i] })),
        },
        totals: {
            emarCurrent: 97, emarPrev: 95,
            handoversCurrentSigned: 19, handoversPrevSigned: 18, handoversCurrentTotal: 21,
            vitalsCurrentAbnormal: 17, vitalsPrevAbnormal: 21,
            triageCurrent: 6, triagePrev: 8,
            bathsCurrent: 149, bathsPrev: 141,
            mealsCurrent: 630, mealsPrev: 618,
        },
        deltas: {
            deltaMeds: 2, deltaHandoversSigned: 1, deltaVitalsAbnormal: -4,
            deltaTriage: -2, deltaBaths: 8, deltaMeals: 12,
        },
    },
    '/api/corporate': {
        success: true,
        facilities: [{ id: 'demo-hq', name: 'Hogar Demostración' }],
        kpis: {
            activeHqs: 1, totalCapacity: 36, totalPatients: 31,
            totalCriticalIncidents: 2, globalMedCompliance: 97, ventanaDias: 7,
        },
        ranking: [
            { id: 'demo-hq', name: 'Hogar Demostración', complianceScore: 92, totalPatients: 31, criticalIncidents: 2 },
        ],
    },
}, comoSi({ name: 'Celia Sierra', role: 'DIRECTOR', secondaryRoles: ['NURSE'] }));

export default function CapturaDirector() {
    return (
        <Andamio ancho={1440}>
            <CorporateDashboard />
        </Andamio>
    );
}
