/**
 * LA PANTALLA DE DIRECCIÓN — lo que Andrés abre por la mañana.
 *
 * Nace el 14-sep-2026 de una frase suya: "lo siento desordenado y poco
 * funcional. botones innecesarios. que realmente se vea la operación diaria del
 * hogar en una sola pantalla."
 *
 * La auditoría de ese día encontró por qué: el panel gerencial era el panel del
 * supervisor repintado. Los mismos cuatro indicadores, las mismas ausencias, y
 * dos enlaces del briefing que apuntaban literalmente a /care/supervisor. No
 * tenía un solo bloque que contestara una pregunta de dirección.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * EL CRITERIO, SACADO DEL CÓDIGO Y NO DE UN ESLOGAN
 *
 * Zéndity existe para que lo que una cuidadora ve en el pasillo llegue a quien
 * puede decidir sobre ello, y para que se note cuando no llegó. Guardar el
 * registro ya se podía; lo que faltaba era el cierre.
 *
 * De ahí sale el reparto con el supervisor, que ya tiene su regla escrita:
 * SOLO LO RESOLUBLE EN UNA O DOS HORAS. A dirección le toca lo contrario — lo
 * que lleva días parado, lo que solo ella puede decidir, y lo que se rompe por
 * un lado que el piso no ve.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * CUATRO FRANJAS, Y POR QUÉ EN ESE ORDEN
 *
 *   1. ¿Pasó algo anoche?     lo que cambió desde que cerró el día
 *   2. Esperando tu decisión  la cola viva, con los días que lleva parada
 *   3. El piso ahora mismo    una sola vez, de un solo sitio
 *   4. Lo que lleva días      lo que el supervisor no puede resolver
 *
 * Ordenadas por la única pregunta que importa a las siete de la mañana: ¿hay
 * algo que solo yo pueda resolver?
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ESTO COMPONE, NO CALCULA
 *
 * Las franjas 2 y 3 salen de motores que ya existían y están bien hechos:
 * `reporte-direccion.ts` ya ordena por lo que pasa si nadie lo mira, y
 * `estado-operativo.ts` nació explícitamente para que el director y el
 * supervisor no calculen lo mismo de dos formas — que es el fallo que la
 * auditoría encontró vivo: el chip decía "Baños 31" y la barra de encima
 * "30/30", desde dos endpoints distintos.
 *
 * Lo único nuevo es la franja 1 y la parte de la 4 que nadie vigilaba.
 */
import { prisma } from '@/lib/prisma';
import { estadoOperativo, type EstadoOperativo } from '@/lib/estado-operativo';
import { construirReporteDireccion } from '@/lib/reporte-direccion';

/** Una cosa que pasó y que dirección debería saber. */
export interface Novedad {
    /** Qué pasó, en una línea que se lee sin abrir nada. */
    que: string;
    /** Cuándo. */
    cuando: Date;
    /** A dónde se va a verlo. */
    enlace: string;
    /** Lo que pide una decisión va marcado; lo que solo informa, no. */
    pideDecision: boolean;
}

/** Algo parado, con los días que lleva. */
export interface Parado {
    que: string;
    /** Días esperando. Es el dato que convierte una lista en una urgencia. */
    dias: number;
    cuantos: number;
    enlace: string;
}

export interface PantallaDireccion {
    sede: { id: string; nombre: string };
    /** Desde cuándo se mira "anoche". */
    desde: Date;
    anoche: Novedad[];
    decisiones: { que: string; porque: string; quien: string }[];
    piso: EstadoOperativo;
    parado: Parado[];
}

const dias = (d: Date) => Math.floor((Date.now() - d.getTime()) / 86400000);

/**
 * LA VENTANA DE "ANOCHE".
 *
 * Catorce horas, no veinticuatro. A las siete de la mañana eso cubre la noche
 * entera y el final de la tarde; con veinticuatro entraría la mañana de ayer,
 * que ya se miró ayer. Lo que se pregunta es "¿pasó algo desde que dejé de
 * mirar?", no "¿qué pasó en un día".
 */
const HORAS_DE_ANOCHE = 14;

export async function construirPantallaDireccion(hqId: string, hqNombre: string): Promise<PantallaDireccion> {
    const desde = new Date(Date.now() - HORAS_DE_ANOCHE * 3600 * 1000);
    const hace30d = new Date(Date.now() - 30 * 86400000);

    const [
        caidas, alertasNuevas, cambiosNuevos, ingresos, egresos, hospitalizados,
        dosisNoDadas,
        alertasViejas, relevosSinFirmar, obsAbiertas, ausenciasSinMotivo,
        piso, reporte,
    ] = await Promise.all([
        prisma.fallIncident.findMany({
            // `reportedAt`, no createdAt: este modelo no tiene createdAt, y
            // `incidentDate` admite fecha retroactiva — para "¿pasó algo
            // anoche?" interesa cuándo se supo, no cuándo ocurrió.
            where: { patient: { headquartersId: hqId }, reportedAt: { gte: desde } },
            select: { id: true, reportedAt: true },
        }),
        prisma.dailyLog.findMany({
            where: { patient: { headquartersId: hqId }, isClinicalAlert: true, createdAt: { gte: desde } },
            select: { id: true, createdAt: true },
        }),
        prisma.cambioDeCondicion.findMany({
            where: { headquartersId: hqId, reportadoAt: { gte: desde } },
            select: { id: true, reportadoAt: true, revisadoAt: true },
        }),
        prisma.patient.findMany({
            where: { headquartersId: hqId, createdAt: { gte: desde } },
            select: { id: true, createdAt: true },
        }),
        prisma.patient.findMany({
            where: { headquartersId: hqId, dischargeDate: { gte: desde } },
            select: { id: true, dischargeDate: true },
        }),
        prisma.patient.findMany({
            where: { headquartersId: hqId, leaveType: 'HOSPITAL', leaveDate: { gte: desde } },
            select: { id: true, leaveDate: true },
        }),
        /**
         * EL MEDICAMENTO QUE NO SE DIO.
         *
         * Hasta el 14-sep-2026 esto no se podía preguntar: el cron que
         * materializa las dosis del día las firmaba con un usuario que no
         * existe, la escritura fallaba en silencio y no había ni una fila
         * PENDING ni MISSED en toda la historia. Con eso arreglado, esta línea
         * es la primera vez que el hogar puede ver una dosis omitida.
         */
        prisma.medicationAdministration.count({
            where: {
                status: { in: ['MISSED', 'OMITTED'] },
                patientMedication: { patient: { headquartersId: hqId } },
                createdAt: { gte: desde },
            },
        }),

        // ── Lo que lleva días parado ──────────────────────────────────────
        /**
         * Alertas clínicas abiertas. Medido el 13-sep-2026: once, la más vieja
         * de dieciocho días, y una de un residente ya fallecido. Nadie las
         * vigilaba: no tenían pantalla.
         */
        prisma.dailyLog.findMany({
            where: {
                patient: { headquartersId: hqId, status: 'ACTIVE' },
                isClinicalAlert: true, isResolved: false,
            },
            select: { createdAt: true },
            orderBy: { createdAt: 'asc' },
        }),
        /**
         * El relevo de noche es el que menos se firma: 1 de 65 en 30 días. Es
         * el turno con menos ojos encima y el que menos se revisa.
         */
        prisma.shiftHandover.findMany({
            where: {
                headquartersId: hqId, isDailyPrologue: false,
                supervisorSignedAt: null, createdAt: { gte: hace30d },
            },
            select: { createdAt: true },
            orderBy: { createdAt: 'asc' },
        }),
        prisma.incidentReport.findMany({
            where: {
                headquartersId: hqId,
                status: { in: ['PENDING_EXPLANATION', 'EXPLANATION_RECEIVED'] },
            },
            select: { createdAt: true },
            orderBy: { createdAt: 'asc' },
        }),
        /**
         * Una ausencia sin motivo no se puede gestionar: no se sabe si avisó,
         * si está enferma o si no apareció. Las seis del mes lo tenían nulo.
         */
        prisma.scheduledShift.count({
            where: {
                schedule: { headquartersId: hqId }, isAbsent: true,
                absentMarkedAt: { gte: hace30d }, absenceReason: null,
            },
        }),

        estadoOperativo(hqId),
        construirReporteDireccion(hqId, hqNombre),
    ]);

    // ── Franja 1 ──────────────────────────────────────────────────────────
    const anoche: Novedad[] = [];
    const suma = (n: number, uno: string, varios: string, enlace: string, cuando: Date, pideDecision: boolean) => {
        if (n > 0) anoche.push({ que: n === 1 ? uno : varios.replace('{n}', String(n)), cuando, enlace, pideDecision });
    };
    suma(caidas.length, 'Una caída', '{n} caídas', '/corporate/incidents', caidas[0]?.reportedAt ?? desde, true);
    suma(alertasNuevas.length, 'Una alerta clínica nueva', '{n} alertas clínicas nuevas', '/care/supervisor', alertasNuevas[0]?.createdAt ?? desde, true);
    suma(dosisNoDadas, 'Un medicamento sin administrar', '{n} medicamentos sin administrar', '/corporate/medical/emar', desde, true);
    suma(hospitalizados.length, 'Un residente al hospital', '{n} residentes al hospital', '/corporate/patients', hospitalizados[0]?.leaveDate ?? desde, true);
    suma(cambiosNuevos.filter(c => !c.revisadoAt).length, 'Un cambio de condición sin revisar', '{n} cambios de condición sin revisar', '/care/cambios', cambiosNuevos[0]?.reportadoAt ?? desde, true);
    suma(ingresos.length, 'Un ingreso', '{n} ingresos', '/corporate/patients', ingresos[0]?.createdAt ?? desde, false);
    suma(egresos.length, 'Un egreso', '{n} egresos', '/corporate/patients', egresos[0]?.dischargeDate ?? desde, false);

    // ── Franja 4 ──────────────────────────────────────────────────────────
    const parado: Parado[] = [];
    const parar = (filas: { createdAt: Date }[], uno: string, varios: string, enlace: string) => {
        if (filas.length === 0) return;
        parado.push({
            que: filas.length === 1 ? uno : varios.replace('{n}', String(filas.length)),
            dias: dias(filas[0].createdAt),
            cuantos: filas.length,
            enlace,
        });
    };
    parar(alertasViejas, 'Una alerta clínica sin cerrar', '{n} alertas clínicas sin cerrar', '/care/supervisor');
    parar(relevosSinFirmar, 'Un relevo sin firmar', '{n} relevos sin firmar', '/care/reports');
    parar(obsAbiertas, 'Una observación esperando decisión', '{n} observaciones esperando decisión', '/hr/incidents');
    if (ausenciasSinMotivo > 0) {
        parado.push({
            que: ausenciasSinMotivo === 1 ? 'Una ausencia sin motivo anotado' : `${ausenciasSinMotivo} ausencias sin motivo anotado`,
            dias: 0, cuantos: ausenciasSinMotivo, enlace: '/hr/schedule',
        });
    }
    parado.sort((a, b) => b.dias - a.dias);

    return {
        sede: { id: hqId, nombre: hqNombre },
        desde,
        anoche,
        // El motor del correo del lunes, en vivo. `orden` menor va primero:
        // es "lo que pasa si nadie lo mira", ya pensado y ya medido.
        /**
         * El bloque 1 del correo del lunes, en vivo. Ya viene ordenado por
         * `orden` —lo que pasa si nadie lo mira— y cada línea trae el número
         * que la justifica y de quién es. Se toman seis: la pantalla es para
         * decidir, no para leerlo todo.
         */
        decisiones: (reporte.bloques.find(b => b.numero === 1)?.lineas ?? [])
            .slice(0, 6)
            .map(l => ({
                que: l.texto,
                porque: (l.casos[0] ?? '').replace(/^Por qué: /, ''),
                quien: (l.casos[1] ?? '').replace(/^Le toca a: /, ''),
            })),
        piso,
        parado,
    };
}
