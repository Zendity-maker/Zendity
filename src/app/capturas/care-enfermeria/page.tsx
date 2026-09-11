'use client';
/**
 * TEMPORAL en producción (404) — captura de enfermería con residentes inventados.
 *
 * SE MONTAN LAS DOS PANTALLAS, y es a propósito.
 *
 * El encargo decía "/care/enfermeria: piel, úlceras y rotación, con un residente
 * con úlcera activa y su plan, y una rotación pendiente". Son dos pantallas
 * distintas:
 *
 *   /care/enfermeria  es la LISTA DE TRABAJO — números y enlaces, la puerta.
 *                     No enseña ninguna úlcera ni ninguna rotación: solo dice
 *                     cuántas hay y a dónde ir.
 *   /care/nursing     es «Piel, úlceras y rotación» — el cuarto. Ahí viven los
 *                     reportes de piel sin decidir, los seis estados de
 *                     rotación, las etiquetas de úlcera que abren la curación y
 *                     el plan del home care.
 *
 * Fotografiar solo la primera habría dado una pantalla de cifras sin nada de lo
 * que el encargo pedía que se viera. Van las dos en el mismo andamio, cada una
 * en su envoltorio con id, y cada toma recorta la suya.
 *
 * LOS NÚMEROS DE LAS DOS CUADRAN ENTRE SÍ: las 2 rotaciones vencidas de la lista
 * son Rosa Medina (3 h 25 min) y Carmen Delgado (sin registro), y la única
 * úlcera sin curación es la sacra de Rosa. Un curso donde la puerta dice 2 y el
 * cuarto enseña 5 enseña a desconfiar del sistema.
 */
import { Suspense } from 'react';
import { Andamio, instalar } from '../andamio';
import ListaDeTrabajo from '@/app/care/enfermeria/page';
import PielUlcerasRotacion from '@/app/care/nursing/page';

/**
 * Fecha fija. Con `new Date()` a secas la foto cambia cada día que se repita la
 * captura y el curso deja de cuadrar con la imagen que lo ilustra.
 */
const REFERENCIA = '2026-09-11T09:40:00';
const HACE_DIAS = (dias: number, hora = '09:00') => {
    const d = new Date(REFERENCIA);
    d.setDate(d.getDate() - dias);
    const [h, m] = hora.split(':');
    d.setHours(Number(h), Number(m), 0, 0);
    return d.toISOString();
};
const HACE_H = (horas: number) =>
    new Date(Date.parse(REFERENCIA) - horas * 3_600_000).toISOString();
const HACE_MIN = (minutos: number) =>
    new Date(Date.parse(REFERENCIA) - minutos * 60_000).toISOString();

/**
 * La úlcera que se ve en la foto del modal: sacra, estadio 3, con el plan del
 * home care escrito y nueve días sin la curación del plan. Debajo, dos cambios
 * de apósito del piso en 24 h — que NO son curación y por eso el reloj sigue
 * corriendo. Ese contraste es justo lo que el curso tiene que enseñar.
 */
const ULCERA_ROSA = {
    id: 'u1',
    bodyLocation: 'Sacro',
    stage: 3,
    status: 'ACTIVE',
    identifiedAt: HACE_DIAS(41, '10:00'),
    planTratamiento:
        'Limpieza con solución salina al 0.9%. Apósito de espuma con plata cada 48 horas. '
        + 'No aplicar povidona ni alcohol. Alivio de presión cada 2 horas y cojín de aire en la silla.',
    planEstablecidoPor: 'Home Care Caribe — enfermera Wanda Colón',
    ultimaCuracionAt: HACE_DIAS(9, '14:20'),
    ultimoTratamiento: 'Salina + apósito de espuma con plata',
    diasSinCuracion: 9,
    ultimaValoracionAt: HACE_DIAS(9, '14:20'),
    diasSinValoracion: 9,
    ultimoCambioAposito: { at: HACE_H(6), motivo: 'EXCREMENTO' },
    cambiosEnUnDia: 2,
    historial: [
        {
            id: 'h1', at: HACE_H(6), tipo: 'CAMBIO_APOSITO', motivo: 'EXCREMENTO',
            tratamiento: null,
            notas: 'Se ensució de madrugada. Limpié con salina y volví a tapar. Queda esperando a la enfermera.',
            medida: null, tieneFoto: false, porQuien: 'Yarelis Cruz',
        },
        {
            id: 'h2', at: HACE_H(17), tipo: 'CAMBIO_APOSITO', motivo: 'SECRECION',
            tratamiento: null,
            notas: 'El apósito estaba empapado. No huele mal.',
            medida: null, tieneFoto: false, porQuien: 'Damaris Soto',
        },
        {
            id: 'h3', at: HACE_DIAS(9, '14:20'), tipo: 'CURACION', motivo: null,
            tratamiento: 'Salina + apósito de espuma con plata',
            notas: 'Bordes definidos, sin olor. Lecho rojo con islotes amarillos.',
            medida: '3x2 cm', tieneFoto: true, porQuien: 'Wanda Colón — Home Care Caribe',
        },
        {
            id: 'h4', at: HACE_DIAS(24, '11:05'), tipo: 'VALORACION', motivo: null,
            tratamiento: null,
            notas: 'Sin cambios respecto a la semana pasada. Se mantiene el plan.',
            medida: '3x2 cm', tieneFoto: false, porQuien: 'Mildred Santiago',
        },
    ],
};

/** La de Carmen sí está al día: la etiqueta sale gris, no roja. */
const ULCERA_CARMEN = {
    id: 'u2',
    bodyLocation: 'Talón derecho',
    stage: 2,
    status: 'HEALING',
    identifiedAt: HACE_DIAS(16, '08:30'),
    planTratamiento: 'Apósito hidrocoloide cada 72 horas. Talonera de descarga día y noche.',
    planEstablecidoPor: 'Home Care Caribe',
    ultimaCuracionAt: HACE_DIAS(2, '15:10'),
    ultimoTratamiento: 'Hidrocoloide + talonera',
    diasSinCuracion: 2,
    ultimaValoracionAt: HACE_DIAS(2, '15:10'),
    diasSinValoracion: 2,
    ultimoCambioAposito: null,
    cambiosEnUnDia: 0,
    historial: [
        {
            id: 'h5', at: HACE_DIAS(2, '15:10'), tipo: 'CURACION', motivo: null,
            tratamiento: 'Hidrocoloide + talonera',
            notas: 'Reduciendo. Piel perilesional íntegra.',
            medida: '1x1 cm', tieneFoto: true, porQuien: 'Wanda Colón — Home Care Caribe',
        },
    ],
};

instalar({
    /**
     * PLANA, no envuelta: la pantalla hace `setData(json)` y lee `json.counts`,
     * `json.patients` y `json.thresholdsMin` directo. Meter esto dentro de
     * `{ data: … }` deja los seis contadores en 0 y la lista vacía.
     */
    '/api/care/nursing/rotation': {
        success: true,
        generatedAt: REFERENCIA,
        hqId: 'demo-hq',
        hogar: {
            nombre: 'Hogar Demostración',
            telefono: '(787) 555-0142',
            direccion: 'Calle Loíza 128, San Juan, PR 00911',
            logo: null,
        },
        thresholdsMin: { target: 120, breach: 135 },
        // Uno de cada estado: los seis chips de la cabecera salen con número.
        counts: { OVERDUE: 1, DUE: 1, NEVER: 1, OK: 1, SIN_ORDEN: 1, FUERA: 1 },
        total: 6,
        patients: [
            {
                patientId: 'p1', name: 'Rosa Medina', roomNumber: '204', status: 'ACTIVE',
                requiresPosturalChanges: true, nortonRisk: true,
                enrolledBy: { flag: true, norton: true, ulcer: true },
                activeUlcers: [ULCERA_ROSA],
                lastRotation: {
                    performedAt: HACE_MIN(205), position: 'Decúbito lateral izquierdo',
                    nurseId: 'c3', nurseName: 'Yarelis Cruz',
                },
                minutesSince: 205, tier: 'OVERDUE',
                fuera: false, sinOrden: false, motivoFuera: null,
            },
            {
                patientId: 'p4', name: 'Pedro Santana', roomNumber: '103', status: 'ACTIVE',
                requiresPosturalChanges: true, nortonRisk: false,
                enrolledBy: { flag: true, norton: false, ulcer: false },
                activeUlcers: [],
                lastRotation: {
                    performedAt: HACE_MIN(128), position: 'Supino',
                    nurseId: 'c4', nurseName: 'Damaris Soto',
                },
                minutesSince: 128, tier: 'DUE',
                fuera: false, sinOrden: false, motivoFuera: null,
            },
            {
                // Sin un solo registro de rotación: no es que vaya tarde, es que
                // nadie ha anotado nunca que la giraran.
                patientId: 'p3', name: 'Carmen Delgado', roomNumber: '210', status: 'ACTIVE',
                requiresPosturalChanges: false, nortonRisk: true,
                enrolledBy: { flag: false, norton: true, ulcer: true },
                activeUlcers: [ULCERA_CARMEN],
                lastRotation: null, minutesSince: null, tier: 'NEVER',
                fuera: false, sinOrden: false, motivoFuera: null,
            },
            {
                patientId: 'p2', name: 'Luis Ortega', roomNumber: '112', status: 'ACTIVE',
                requiresPosturalChanges: true, nortonRisk: true,
                enrolledBy: { flag: true, norton: true, ulcer: false },
                activeUlcers: [],
                lastRotation: {
                    performedAt: HACE_MIN(40), position: 'Decúbito lateral derecho',
                    nurseId: 'c1', nurseName: 'Joaneliz Pérez',
                },
                minutesSince: 40, tier: 'OK',
                fuera: false, sinOrden: false, motivoFuera: null,
            },
            {
                // Norton positivo y nadie mandó rotarla: la fila trae los dos
                // botones que cierran la decisión sin salir de la pantalla.
                patientId: 'p5', name: 'Elena Figueroa', roomNumber: '208', status: 'ACTIVE',
                requiresPosturalChanges: false, nortonRisk: true,
                enrolledBy: { flag: false, norton: true, ulcer: false },
                activeUlcers: [],
                lastRotation: {
                    performedAt: HACE_H(5), position: 'Sentada en silla',
                    nurseId: 'c2', nurseName: 'Marisol Vega',
                },
                minutesSince: null, tier: 'SIN_ORDEN',
                fuera: false, sinOrden: true, motivoFuera: null,
            },
            {
                // En el hospital. Gris y fuera del conteo: no se puede girar a
                // quien no está en el edificio.
                patientId: 'p6', name: 'Ramón Quiñones', roomNumber: '115', status: 'TEMPORARY_LEAVE',
                requiresPosturalChanges: true, nortonRisk: false,
                enrolledBy: { flag: true, norton: false, ulcer: false },
                activeUlcers: [],
                lastRotation: {
                    performedAt: HACE_DIAS(2, '07:30'), position: 'Supino',
                    nurseId: 'c4', nurseName: 'Damaris Soto',
                },
                minutesSince: null, tier: 'FUERA',
                fuera: true, sinOrden: false, motivoFuera: 'HOSPITAL',
            },
        ],
    },

    /**
     * Lo que el piso vio en la piel y nadie ha decidido si es úlcera.
     * La pantalla lee `d.cambios` y filtra `area === 'PIEL'` ella misma — por eso
     * va también una de otra área: si no, el filtro no se estaría probando.
     */
    '/api/care/cambio-condicion': {
        success: true,
        patrones: [],
        cambios: [
            {
                id: 'cc1', area: 'PIEL', areaEtiqueta: 'Piel',
                descripcion: 'Enrojecimiento en el talón izquierdo que no se aclara al quitar la presión.',
                reportadoAt: HACE_DIAS(3, '21:10'), reportadoPor: 'Joaneliz Pérez', diasEsperando: 3,
                revisadoAt: null, revisadoPor: null, resultado: null, resultadoEtiqueta: '—', respuesta: null,
                residente: { id: 'p5', nombre: 'Elena Figueroa', habitacion: '208' },
            },
            {
                id: 'cc2', area: 'PIEL', areaEtiqueta: 'Piel',
                descripcion: 'Piel morada del tamaño de una moneda en el codo derecho. No se queja de dolor.',
                reportadoAt: HACE_DIAS(1, '06:45'), reportadoPor: 'Marisol Vega', diasEsperando: 1,
                revisadoAt: null, revisadoPor: null, resultado: null, resultadoEtiqueta: '—', respuesta: null,
                residente: { id: 'p2', nombre: 'Luis Ortega', habitacion: '112' },
            },
            {
                id: 'cc3', area: 'ALIMENTACION', areaEtiqueta: 'Alimentación',
                descripcion: 'Lleva tres días dejando casi todo el almuerzo.',
                reportadoAt: HACE_DIAS(2, '13:00'), reportadoPor: 'Damaris Soto', diasEsperando: 2,
                revisadoAt: null, revisadoPor: null, resultado: null, resultadoEtiqueta: '—', respuesta: null,
                residente: { id: 'p1', nombre: 'Rosa Medina', habitacion: '204' },
            },
        ],
    },

    /** La pantalla lee `d.residentes`, no `d.data`. */
    '/api/care/nursing/senales': {
        success: true,
        residentes: [
            {
                patientId: 'p1', nombre: 'Rosa Medina',
                senales: [{
                    codigo: 'INGESTA_BAJA', gravedad: 'REVISAR',
                    titulo: 'Comió la mitad o menos en 4 de los últimos 7 días',
                    evidencia: [
                        '05-sep 25% · 07-sep 50% · 09-sep 40% · 10-sep 30%',
                        'Peso: 138 lb el 20-ago → 133 lb el 09-sep',
                    ],
                }],
            },
            {
                patientId: 'p4', nombre: 'Pedro Santana',
                senales: [{
                    codigo: 'TEMP_SOSTENIDA', gravedad: 'VIGILAR',
                    titulo: 'Tres noches seguidas por encima de 99.5 °F',
                    evidencia: [
                        '08-sep 99.8 °F · 09-sep 100.1 °F · 10-sep 99.7 °F',
                        'Sin antibiótico pautado en el eMAR',
                    ],
                }],
            },
        ],
        resumen: { total: 2, revisar: 1 },
    },

    /** Solo alimenta el selector de "Declarar úlcera". Lee `d.patients`. */
    '/api/corporate/patients': {
        success: true,
        patients: [
            { id: 'p1', name: 'Rosa Medina' },
            { id: 'p2', name: 'Luis Ortega' },
            { id: 'p3', name: 'Carmen Delgado' },
            { id: 'p4', name: 'Pedro Santana' },
            { id: 'p5', name: 'Elena Figueroa' },
            { id: 'p6', name: 'Ramón Quiñones' },
        ],
    },

    /**
     * La lista de trabajo. Va ya ORDENADA como la devolvería la API —ALTA por
     * total descendente, luego MEDIA, luego BAJA— porque la pantalla pinta el
     * array tal cual llega y no vuelve a ordenarlo.
     */
    '/api/care/enfermeria/pendientes': {
        success: true,
        revisado: 8,
        total: 20,
        pendientes: [
            {
                codigo: 'CAMBIOS_PISO', titulo: 'Cambios del piso que pasaron el plazo',
                detalle: '2 llevan más de 48 horas esperando. El más viejo, 3 días.',
                total: 4, urgencia: 'ALTA', href: '/care/cambios',
            },
            {
                codigo: 'PRN_SIN_RESPUESTA', titulo: 'PRN sin saber si hizo efecto',
                detalle: 'Se administró por razón necesaria y falta decir qué pasó.',
                total: 3, urgencia: 'ALTA', href: '/care',
            },
            {
                codigo: 'ROTACION_VENCIDA', titulo: 'Rotaciones vencidas',
                detalle: 'Pasaron más de 2 horas desde el último cambio de posición.',
                total: 2, urgencia: 'ALTA', href: '/care/nursing',
            },
            {
                codigo: 'CURACION_VENCIDA', titulo: 'Úlceras sin curación registrada',
                detalle: 'Más de 7 días sin el tratamiento del plan, o de alguien que ya no está en el hogar. Un cambio de apósito no cuenta.',
                total: 1, urgencia: 'ALTA', href: '/care/nursing',
            },
            {
                codigo: 'UPP_SIN_VALORAR', titulo: 'Úlceras que nadie ha mirado',
                detalle: 'Más de 7 días sin que enfermería o dirección la valoren.',
                total: 1, urgencia: 'ALTA', href: '/care/nursing',
            },
            {
                codigo: 'RIESGO_CAIDA_PENDIENTE', titulo: 'Riesgo de caída sin evaluar o vencido',
                detalle: 'Pasaron los 6 meses desde la última evaluación.',
                total: 2, urgencia: 'MEDIA', href: '/care/caidas',
            },
            {
                codigo: 'RELEVOS_PENDIENTES', titulo: 'Relevos de turno sin aceptar',
                detalle: 'El turno entrante todavía no los firmó.',
                total: 2, urgencia: 'MEDIA', href: '/care/reports',
            },
            {
                codigo: 'PAI_PENDIENTE', titulo: 'Planes de cuido sin resolver',
                detalle: 'Falta firmarlos, hacerlos, enviarlos o revisarlos.',
                total: 5, urgencia: 'BAJA', href: '/cuidadores',
            },
        ],
    },
});

export default function Captura() {
    return (
        <Andamio ancho={1280}>
            {/* Arriba «Piel, úlceras y rotación»: así las tomas de esta pantalla
                salen sin tener que bajar, y su cabecera pegajosa no se cuela
                encima de la lista de trabajo. */}
            <div id="pantalla-piel">
                {/* La pantalla real lee ?patientId= para señalar a un residente
                    concreto cuando se llega desde el inbox del supervisor.
                    useSearchParams necesita su frontera de Suspense. */}
                <Suspense fallback={null}>
                    <PielUlcerasRotacion />
                </Suspense>
            </div>
            <div id="pantalla-pendientes">
                <ListaDeTrabajo />
            </div>
        </Andamio>
    );
}
