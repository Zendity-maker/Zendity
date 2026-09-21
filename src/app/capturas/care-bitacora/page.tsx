'use client';
/**
 * TEMPORAL en producción (404) — captura de /coordinator/calls, la bitácora de
 * llamadas a familiares.
 *
 * Lo que el pie del curso promete que se ve en la foto, y que la pantalla sí
 * pinta hoy:
 *
 *   a quién se llamó y su parentesco   → familiar + (Hija) / (Hijo) / (Sobrina)
 *   si llamamos nosotros o llamaron    → "Yo llamé" / "Me llamaron"
 *   la fecha y la hora                 → pie de cada tarjeta, con los minutos
 *   lo que se habló                    → la caja azul de Nota
 *   quién lo registró                  → "registrado por ..." en el mismo pie
 *
 * DOS COSAS QUE NO SE FUERZAN:
 *
 *  1. `purpose` (motivo) se guarda en la fila —el modal lo pide y la ruta lo
 *     valida contra un set cerrado— pero NINGUNA pantalla lo pinta. Va en el
 *     fixture porque es lo que devuelve la API de verdad, y NO se pinta aquí
 *     tampoco: la foto enseña lo que la pantalla enseña hoy, no lo que sería
 *     bonito que enseñara.
 *  2. `note` es OPCIONAL en el modelo, y una fila sin nota se pinta sin la caja
 *     azul. Las cinco de aquí la traen a propósito: la nota es justo lo que el
 *     curso quiere enseñar a escribir.
 *
 * Residentes y familiares inventados. El material de formación no lleva PHI
 * (regla 7): ni un nombre de producción, ni un teléfono, ni un dato clínico
 * identificable dentro de las notas.
 */
import { Andamio, instalar } from '../andamio';
import BitacoraDeLlamadas from '@/app/coordinator/calls/page';

/**
 * Fecha FIJA. Con `new Date()` la foto saldría distinta cada vez que se repita
 * la toma, y el pie de la tarjeta imprime día y mes.
 *
 * Se construye en hora LOCAL (sin Z) a propósito: la lista formatea con
 * toLocaleString('es-PR'), así que una hora escrita en UTC saldría corrida y
 * "las 9:15 de la mañana" del guion del curso dejaría de serlo.
 */
const EL_DIA = (hora: string) => new Date(`2026-09-18T${hora}:00`).toISOString();

/**
 * La lista NO ordena: pinta en el orden que llega. La ruta real ordena
 * `contactedAt: 'desc'`, así que el fixture va de la más reciente a la más
 * vieja — todas del mismo jueves, para que la foto se lea como un día de
 * trabajo y no como un histórico suelto.
 *
 * La respuesta va en `logs`, no en `data`: ContactLogList hace
 * setLogs(data.logs) tras comprobar data.success.
 *
 * QUIÉN FIRMA EL "registrado por". Las tres personas del pie son supervisora
 * (Ana Rivera, Damaris Soto) y coordinadora (Zoraida Bonilla), y eso NO es
 * decorado: el POST de /api/corporate/family-contact-logs solo admite
 * DIRECTOR / ADMIN / SUPERVISOR / NURSE / COORDINATOR. Una cuidadora ahí sería
 * una foto de algo que la ruta devuelve 403 — y en el mismo curso sale la foto
 * del panel del supervisor, donde el reparto de cuidadoras tiene nombre y
 * grupo de color. Si alguien repite esta toma, que no meta a una de ellas.
 */
instalar({
    '/api/corporate/family-contact-logs': {
        success: true,
        logs: [
            {
                id: 'fcl-1',
                channel: 'PHONE',
                direction: 'OUTBOUND',
                purpose: 'PLANNING',      // se guarda; ninguna pantalla lo pinta
                outcome: 'SPOKE',
                note: 'Se le avisó que mañana no baja al comedor a las 8:00 porque le toca terapia. Pidió que la llamemos al terminar para saber cómo le fue.',
                durationMin: 8,
                coordinatedAppointment: false,
                contactedAt: EL_DIA('16:20'),
                patient: { id: 'p5', name: 'Elena Figueroa', roomNumber: '208' },
                familyMember: { id: 'f5', name: 'Nilda Figueroa', phone: null, relationship: 'Hija' },
                loggedBy: { id: 'u1', name: 'Ana Rivera' },
            },
            {
                id: 'fcl-2',
                channel: 'PHONE',
                direction: 'INBOUND',
                purpose: 'PLANNING',
                outcome: 'SPOKE',
                note: 'Llamó él para avisar que el sábado lo recoge a las 10:00 y lo trae antes de la cena. Se anotó la salida y se le recordó traer de vuelta el bulto.',
                durationMin: 5,
                coordinatedAppointment: false,
                contactedAt: EL_DIA('14:05'),
                patient: { id: 'p4', name: 'Pedro Santana', roomNumber: '103' },
                familyMember: { id: 'f4', name: 'Ramón Santana Colón', phone: null, relationship: 'Hijo' },
                loggedBy: { id: 'u2', name: 'Zoraida Bonilla' },
            },
            {
                /**
                 * La única con "Coordinó cita": la pastilla teal solo sale
                 * cuando coordinatedAppointment es true. Con todas en true el
                 * chip deja de significar nada en la foto.
                 */
                id: 'fcl-3',
                channel: 'PHONE',
                direction: 'OUTBOUND',
                purpose: 'FOLLOWUP',
                outcome: 'SPOKE',
                note: 'Quedó coordinada la cita del 25 por la mañana. Ella la lleva y la trae; pasa por el hogar a las 9:00 y avisa al llegar.',
                durationMin: 12,
                coordinatedAppointment: true,
                contactedAt: EL_DIA('11:30'),
                patient: { id: 'p1', name: 'Rosa Medina', roomNumber: '204' },
                familyMember: { id: 'f1', name: 'Marisol Medina Vázquez', phone: null, relationship: 'Hija' },
                loggedBy: { id: 'u1', name: 'Ana Rivera' },
            },
            {
                /**
                 * Un intento que no llegó a hablar. Va en la foto a propósito:
                 * el curso tiene que enseñar que la llamada que NO se contestó
                 * también se registra —si no, el próximo turno la repite sin
                 * saber que ya se intentó— y que la nota sirve igual.
                 */
                id: 'fcl-4',
                channel: 'PHONE',
                direction: 'OUTBOUND',
                purpose: 'UPDATE',
                outcome: 'NO_ANSWER',
                note: 'No contestó. Era para confirmar la ropa que trae el fin de semana. Se intenta otra vez en la tarde.',
                durationMin: null,
                coordinatedAppointment: false,
                contactedAt: EL_DIA('09:15'),
                patient: { id: 'p3', name: 'Carmen Delgado', roomNumber: '210' },
                familyMember: { id: 'f3', name: 'Yadira Colón Rivera', phone: null, relationship: 'Sobrina' },
                loggedBy: { id: 'u3', name: 'Damaris Soto' },
            },
            {
                /**
                 * VIDEO, no llamada: la bitácora no es solo del teléfono, y el
                 * icono y la etiqueta cambian con el canal. Una foto con las
                 * cinco tarjetas idénticas no enseña esa columna.
                 */
                id: 'fcl-5',
                channel: 'VIDEO',
                direction: 'INBOUND',
                purpose: 'UPDATE',
                outcome: 'SPOKE',
                note: 'Videollamada con la hija, que vive fuera. Hablaron un rato largo y él la reconoció enseguida. Pidió repetirla los domingos a esta misma hora.',
                durationMin: 15,
                coordinatedAppointment: false,
                contactedAt: EL_DIA('08:40'),
                patient: { id: 'p2', name: 'Luis Ortega', roomNumber: '112' },
                familyMember: { id: 'f2', name: 'Ivelisse Ortega', phone: null, relationship: 'Hija' },
                loggedBy: { id: 'u2', name: 'Zoraida Bonilla' },
            },
        ],
    },
});

export default function Captura() {
    // La pantalla es una columna max-w-3xl centrada; la toma recorta a esa
    // columna, así que el ancho del marco solo tiene que dejarla respirar.
    return <Andamio ancho={1100}><BitacoraDeLlamadas /></Andamio>;
}
