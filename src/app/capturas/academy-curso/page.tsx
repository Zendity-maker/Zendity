'use client';
/**
 * TEMPORAL en producción (404) — captura de /academy: el catálogo de la
 * Academia visto por una empleada.
 *
 * Lo que tiene que verse: las tarjetas con su portada, su categoría y su botón
 * "Comenzar"; un curso ya aprobado al lado de los pendientes; la formación
 * asignada arriba del catálogo y la recomendación de Zendi con su motivo.
 *
 * La empleada es Ana Rivera, la sesión del andamio. Los cursos, sus títulos,
 * duraciones, créditos y portadas son los REALES del catálogo (src/lib/academy-seed.ts
 * y scripts/academy-fase2.ts): aquí no hay nada clínico de nadie, así que la
 * pantalla puede ser fiel hasta el último dato.
 */
import { Andamio, instalar } from '../andamio';
import PantallaAcademy from '@/app/academy/page';

/** Fecha fija: una captura no puede cambiar cada día que se repita. */
const HACE = (dias: number) =>
    new Date(Date.parse('2026-09-11T12:00:00') - dias * 86_400_000).toISOString();

const BASE = { isActive: true, isGlobal: true, targetRole: null, content: null as string | null };

/**
 * Contenido del primer curso — solo el ESQUELETO real: los cinco títulos de
 * sección y sus cinco preguntas cada uno, que es lo único que se lee en el
 * índice de la portada del cuadernillo.
 *
 * Las preguntas van en blanco a propósito: en esta captura nunca se abren, y
 * escribir un examen inventado dentro de un material de formación es pedir que
 * alguien lo cite como si fuera el curso.
 */
const PREGUNTAS = (n: number) =>
    Array.from({ length: n }, (_, i) =>
        `P: Pregunta ${i + 1} de la sección\n*a) Opción correcta\nb) Otra opción\nEXPLICACION: —`
    ).join('\n\n');

const SECCIONES = [
    'Envejecer no es enfermarse',
    'Lo que el residente todavía puede hacer',
    'Tu rol en la cadena clínica: observar y reportar',
    'Seguridad: el entorno también cuida',
    'Hablar con quien está delante',
];

const CONTENIDO_GERIATRICO = [
    `---META---`,
    `TITULO: Cuidado Geriátrico General`,
    `PROMPT_ZENDI: Evalúa si el empleado distingue el envejecimiento normal del deterioro que debe reportarse.`,
    `TERMINOS_CLAVE: envejecimiento normal, deterioro, dignidad, autonomía, observar y reportar`,
    `PREGUNTA_REFLEXION: Una residente que siempre camina sola al comedor hoy se apoya en las paredes y llega tarde. No se queja de nada. ¿Qué haces?`,
    '',
    ...SECCIONES.map((titulo, i) =>
        `---SECCION_${i + 1}---\nLECTURA:\n# ${titulo}\n\nPREGUNTAS:\n${PREGUNTAS(5)}\n`
    ),
].join('\n');

/**
 * El catálogo: los diez cursos de la certificación geriátrica más los del
 * software, en sus categorías reales. El orden de las categorías lo pone la
 * pantalla (CATEGORY_ORDER), no este arreglo.
 */
const CATALOGO = [
    // ── Cuidado Geriátrico — la certificación del oficio (10 cursos) ──────────
    {
        ...BASE, id: 'cg-100', order: 100, category: 'Cuidado Geriátrico',
        title: 'Cuidado Geriátrico General',
        description: 'La base del cuidado del adulto mayor: qué es envejecimiento normal, qué se reporta, cómo preservar autonomía y dónde termina el rol del hogar.',
        durationMins: 40, bonusCompliance: 30,
        imageUrl: '/academy/Cuidado_Geriatrico_General.jpg',
        content: CONTENIDO_GERIATRICO,
    },
    {
        ...BASE, id: 'cg-101', order: 101, category: 'Cuidado Geriátrico',
        title: 'Demencia y Alzheimer: Manejo Diario',
        description: 'Qué es la demencia, por qué la conducta es un mensaje, cómo validar y redirigir en vez de corregir, y qué cambio se reporta de inmediato.',
        durationMins: 35, bonusCompliance: 25,
        imageUrl: '/academy/Demencia_y_Alzheimer_Manejo_Diario.jpg',
    },
    {
        ...BASE, id: 'cg-102', order: 102, category: 'Cuidado Geriátrico',
        title: 'Movilización y Transferencias Seguras',
        description: 'Mover a un residente sin lastimarlo ni lastimarte: mecánica corporal, transferencias paso a paso, reposicionamiento y prevención de caídas.',
        durationMins: 35, bonusCompliance: 25,
        imageUrl: '/academy/Movilizacion_y_Transferencias_Seguras.jpg',
    },
    {
        ...BASE, id: 'cg-103', order: 103, category: 'Cuidado Geriátrico',
        title: 'Higiene, Piel y Control de Infecciones',
        description: 'Asistir en la higiene con dignidad, reconocer y reportar las señales de la piel, y aplicar precauciones estándar que cortan la cadena de infección.',
        durationMins: 35, bonusCompliance: 25,
        imageUrl: '/academy/Higiene_Piel_y_Control_de_Infecciones.jpg',
    },
    {
        ...BASE, id: 'cg-104', order: 104, category: 'Cuidado Geriátrico',
        title: 'Alimentación, Hidratación y Atragantamiento',
        description: 'Asistir a comer con seguridad, reconocer las señales de disfagia y deshidratación, y actuar correctamente ante un atragantamiento.',
        durationMins: 35, bonusCompliance: 25,
        imageUrl: '/academy/Alimentacion_Hidratacion_y_Atragantamiento.jpg',
    },
    {
        ...BASE, id: 'cg-105', order: 105, category: 'Cuidado Geriátrico',
        title: 'Trato Digno, Derechos y Comunicación',
        description: 'Los derechos del residente en el turno real: privacidad, autonomía, confidencialidad, y la obligación de reportar cualquier sospecha de maltrato.',
        durationMins: 35, bonusCompliance: 25,
        imageUrl: '/academy/Trato_Digno_Derechos_y_Comunicacion.jpg',
    },
    {
        ...BASE, id: 'cg-106', order: 106, category: 'Cuidado Geriátrico',
        title: 'Emergencias: Los Primeros Minutos',
        description: 'Reconocer, proteger, activar la ayuda y documentar: caídas, derrame, dolor de pecho, convulsiones y qué entregar cuando llegan los paramédicos.',
        durationMins: 40, bonusCompliance: 30,
        imageUrl: '/academy/Emergencias_Los_Primeros_Minutos.jpg',
    },
    {
        ...BASE, id: 'cg-107', order: 107, category: 'Cuidado Geriátrico',
        title: 'Continuidad del Plan de Cuidado',
        description: 'Tu documentación es lo que el servicio externo lee para decidir: la cadena de escalamiento, los estados del eMAR, y por dónde entra de verdad un cambio de orden.',
        durationMins: 35, bonusCompliance: 25,
        imageUrl: '/academy/Continuidad_del_Plan_de_Cuidado.jpg',
    },
    {
        ...BASE, id: 'cg-108', order: 108, category: 'Cuidado Geriátrico',
        title: 'Piel: Prevención, Observación y Continuidad',
        description: 'Prevenir la lesión por presión, rotar con la posición de hamaca, describir sin clasificar, y saber cuándo se maneja un apósito y cuándo se llama al supervisor.',
        durationMins: 35, bonusCompliance: 25,
        imageUrl: '/academy/Piel_Prevencion_Observacion_y_Continuidad.jpg',
    },
    {
        ...BASE, id: 'cg-109', order: 109, category: 'Cuidado Geriátrico',
        title: 'Signos Vitales, Observación y Escalamiento',
        description: 'Tomar bien cada signo, los umbrales que obligan a llamar, y por qué el cambio respecto a lo habitual dice más que el valor absoluto.',
        durationMins: 35, bonusCompliance: 25,
        imageUrl: '/academy/Signos_Vitales_Observacion_y_Escalamiento.jpg',
    },

    // ── Protocolos Clínicos ───────────────────────────────────────────────────
    {
        ...BASE, id: 'pc-09', order: 9, category: 'Protocolos Clinicos',
        title: 'Proceso de Admision en Zendity',
        description: 'Domina el flujo completo de admision: desde el primer contacto en el CRM hasta la creacion del expediente, Plan de Vida y portal familiar.',
        durationMins: 30, bonusCompliance: 100,
        imageUrl: '/academy/Proceso_de_Admision_en_Zendity.jpg',
    },
    {
        ...BASE, id: 'pc-11', order: 11, category: 'Protocolos Clinicos',
        title: 'Protocolo de Respuesta a Caidas',
        description: 'Aprende el protocolo paso a paso para responder a una caida: evaluacion, documentacion, escalado y prevencion.',
        durationMins: 25, bonusCompliance: 10,
        imageUrl: '/academy/Protocolo_de_Respuesta_a_Caidas.jpg',
    },
    {
        ...BASE, id: 'pc-12', order: 12, category: 'Protocolos Clinicos',
        title: 'Handover de Enfermeria y Relevo de Turno',
        description: 'Domina el proceso de handover entre turnos: comunicacion efectiva, documentacion y continuidad del cuidado.',
        durationMins: 30, bonusCompliance: 10,
        imageUrl: '/academy/Handover_de_Enfermeria_y_Relevo_de_Turno.jpg',
    },

    // ── Operaciones de Piso ───────────────────────────────────────────────────
    {
        ...BASE, id: 'op-04', order: 4, category: 'Operaciones de Piso',
        title: 'El Cuidador en Zendity',
        description: 'Guia completa del rol del cuidador en Zendity: tu workspace, Prologo del Turno, eMAR basico y cierre de turno.',
        durationMins: 30, bonusCompliance: 10,
        imageUrl: '/academy/El_Cuidador_en_Zendity.jpg',
    },
    {
        ...BASE, id: 'op-05', order: 5, category: 'Operaciones de Piso',
        title: 'El Supervisor en Zendity',
        description: 'Domina las herramientas de supervision en tiempo real: dashboard, sesiones zombi, MISSED y redistribucion de personal.',
        durationMins: 30, bonusCompliance: 10,
        imageUrl: '/academy/El_Supervisor_en_Zendity.jpg',
    },
    {
        ...BASE, id: 'op-07', order: 7, category: 'Operaciones de Piso',
        title: 'Turno Nocturno del Cuidador',
        description: 'Protocolo especial del turno nocturno: handover virtual, rondas, incidentes y toma de decisiones sin supervision presencial.',
        durationMins: 25, bonusCompliance: 10,
        imageUrl: '/academy/Turno_Nocturno_del_Cuidador.jpg',
    },

    // ── Roles y Acceso ────────────────────────────────────────────────────────
    {
        ...BASE, id: 'ra-01', order: 1, category: 'Roles y Acceso',
        title: 'Acceso y Roles en Zendity',
        description: 'Aprende a navegar el sistema Zendity, comprender los roles de usuario y aplicar las mejores practicas de seguridad digital en tu facilidad.',
        durationMins: 25, bonusCompliance: 75,
        imageUrl: '/academy/Acceso_y_Roles_en_Zendity.jpg',
    },
    {
        ...BASE, id: 'ra-02', order: 2, category: 'Roles y Acceso',
        title: 'El Director en Zendity',
        description: 'Vision ejecutiva de Zendity para directores: activacion clinica, compliance, CRM y supervision remota.',
        durationMins: 35, bonusCompliance: 10,
        imageUrl: '/academy/El_Director_en_Zendity.jpg',
    },
    {
        ...BASE, id: 'ra-03', order: 3, category: 'Roles y Acceso',
        title: 'El Administrador en Zendity',
        description: 'Funciones administrativas en Zendity: pipeline de admisiones, calendario corporativo, comunicaciones y seguimiento operativo.',
        durationMins: 25, bonusCompliance: 10,
        imageUrl: '/academy/El_Administrador_en_Zendity.jpg',
    },

    // ── Tecnología Zendity ────────────────────────────────────────────────────
    {
        ...BASE, id: 'tz-13', order: 13, category: 'Tecnologia Zendity',
        title: 'Proceso de Cierre de Turno',
        description: 'Aprende a cerrar tu turno correctamente en Zendity: pre-scan, resolucion de pendientes y firma electronica.',
        durationMins: 25, bonusCompliance: 10,
        imageUrl: '/academy/Proceso_de_Cierre_de_Turno.jpg',
    },
    {
        ...BASE, id: 'tz-14', order: 14, category: 'Tecnologia Zendity',
        title: 'Uso de Zendi AI en Zendity',
        description: 'Aprende a usar Zendi AI como herramienta de apoyo: formatos de notas, comunicaciones y sus limites eticos.',
        durationMins: 25, bonusCompliance: 10,
        imageUrl: '/academy/Uso_de_Zendi_AI_en_Zendity.jpg',
    },
    {
        ...BASE, id: 'tz-15', order: 15, category: 'Tecnologia Zendity',
        title: 'Limpieza y Sanitizacion en Zendity',
        description: 'Protocolo de limpieza en Zendity: registro de areas, evidencia fotografica, solicitudes urgentes y metricas de desempeno.',
        durationMins: 20, bonusCompliance: 10,
        imageUrl: '/academy/Limpieza_y_Sanitizacion_en_Zendity.jpg',
    },
];

/**
 * Tres cursos aprobados de los diez de la certificación — 30% en la barra.
 *
 * `id` es la matrícula, y es lo que el botón "Imprimir certificado" necesita
 * para pedirle el código al servidor: sin él la tarjeta aprobada sale con el
 * botón apagado y la captura enseñaría un botón muerto.
 */
const MATRICULAS = [
    { id: 'uc-101', employeeId: 'demo-user', courseId: 'cg-101', status: 'COMPLETED', score: 92, completedAt: HACE(38), attemptsCount: 0, lockedUntil: null },
    { id: 'uc-103', employeeId: 'demo-user', courseId: 'cg-103', status: 'COMPLETED', score: 88, completedAt: HACE(21), attemptsCount: 0, lockedUntil: null },
    { id: 'uc-105', employeeId: 'demo-user', courseId: 'cg-105', status: 'COMPLETED', score: 96, completedAt: HACE(9), attemptsCount: 0, lockedUntil: null },
];

/**
 * Formación asignada: uno por la ruta de certificación y otro por un incidente.
 * Dos motivos distintos a propósito — es lo que distingue un plan de estudios
 * de una biblioteca opcional.
 */
const ASIGNADOS = [
    { id: 'as-1', courseId: 'cg-102', title: 'Movilización y Transferencias Seguras', durationMins: 35, emoji: null, category: 'Cuidado Geriátrico', reason: 'Certificación geriátrica', assignedAt: HACE(12), status: 'PENDING' },
    { id: 'as-2', courseId: 'cg-108', title: 'Piel: Prevención, Observación y Continuidad', durationMins: 35, emoji: null, category: 'Cuidado Geriátrico', reason: 'Incidente de cuidado del residente', assignedAt: HACE(3), status: 'PENDING' },
];

/**
 * EL ORDEN DE ESTAS CLAVES IMPORTA.
 *
 * El andamio casa por `url.includes(patron)` y devuelve la PRIMERA que encaja.
 * La pantalla pide dos veces la misma ruta —`/api/academy?hqId=…` para el
 * catálogo y `…&employeeId=…` para el historial— y cada una espera una forma
 * distinta. Si la del catálogo se evaluara antes, el historial recibiría
 * `{catalog}`, `histData.enrollments` sería undefined y la pantalla se quedaría
 * en `loading` para siempre, sin decir por qué.
 *
 * La tercera clave es la del historial otra vez, con los parámetros al revés:
 * así la pide cada tarjeta para saber si ese curso ya está aprobado.
 */
instalar({
    '/api/academy/recomendacion': {
        success: true,
        recomendacion: {
            courseId: 'pc-11',
            titulo: 'Protocolo de Respuesta a Caidas',
            minutos: 25,
            motivo: 'El mes pasado atendiste 3 caídas.',
        },
        formacion: { aprobados: 3, meta: 4, porcentaje: 75, mesesConAcceso: 4, disponibles: 19 },
    },
    '/api/academy?hqId=demo-hq&employeeId=': { success: true, enrollments: MATRICULAS, assignments: ASIGNADOS },
    '/api/academy?employeeId=': { success: true, enrollments: MATRICULAS, assignments: ASIGNADOS },
    '/api/academy?hqId=': { success: true, catalog: CATALOGO },
});

export default function Captura() {
    // El p-8 es el del marco real de la app (AppLayout: `p-4 md:p-8`). Las
    // rutas del andamio son públicas, así que se renderizan SIN ese marco y sin
    // su padding: sin esto las tarjetas salen pegadas al borde de la foto.
    return (
        <Andamio ancho={1440}>
            <div className="p-8">
                <PantallaAcademy />
            </div>
        </Andamio>
    );
}
