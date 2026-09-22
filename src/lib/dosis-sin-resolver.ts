import { prisma } from '@/lib/prisma';

/**
 * LAS DOSIS DE SU TURNO QUE NADIE RESOLVIÓ — PARA PREGUNTÁRSELO AL CERRAR.
 *
 * ═══ POR QUÉ AL CERRAR Y NO POR UN AVISO ═══
 *
 * La pregunta de Andrés el 21-sep-2026 fue si se le podía mandar una
 * notificación a la cuidadora para que garantizara si dio los medicamentos.
 * Medido antes de construir nada:
 *
 *   · Las tres cuidadoras del turno de día de ese mismo día tenían el 100% de
 *     sus notificaciones de 48 h sin abrir: 48/48, 31/31, 20/20.
 *   · `VitalsOrder` es exactamente ese flujo, ya construido: enfermería pide,
 *     le llega a la cuidadora, cumple o justifica. De 2.356 con recordatorio
 *     enviado, 2.158 expiraron. Convierte al 8.4%. Y órdenes creadas a mano en
 *     90 días: CERO.
 *   · No hay push del navegador: `layout.tsx` desregistra los service workers
 *     en cada carga, a propósito.
 *   · La bandeja trae 20 filas. A la cuidadora con más volumen le cubren 36
 *     minutos: un aviso de las 9:00 ya no está visible a las 9:36.
 *
 * El cierre de turno, en cambio, es el único punto por el que pasa el piso
 * entero: 258 de 260 turnos cerrados en 30 días, 244 con relevo completado
 * (93.8%), y 227 de 227 relevos individuales ya firmados.
 *
 * Y resuelve sin resolverlo el problema más caro del aviso: **a quién
 * preguntarle**. `ShiftColorAssignment` sobre turnos publicados de hoy son CERO
 * filas, y en 30 días solo 24 de 174 turnos publicados tienen color asignado
 * (13.8%) — para el pack ROJO de las 8:00 el sistema no puede saber quién tenía
 * ese grupo. Al cerrar no hay que averiguarlo: es quien está cerrando.
 *
 * ═══ EL ANCLA ES LA HORA DE LA DOSIS, Y ACOTADA POR ARRIBA ═══
 *
 * Se pregunta por las dosis cuya HORA PAUTADA cayó dentro de su turno. No las
 * del día: las de ella. Así el pack de las 8:00 aparece en el cierre de la
 * mañana y no en el de la tarde, que es de quien es.
 *
 * La cota superior (`hasta`) no es decorativa: sin ella, a las 8:05 de la
 * mañana el cierre reclamaría el pack de las 8:00 PM. Es el mismo defecto que
 * la cobertura de comidas del panel del director, que dividía entre las tres
 * comidas del día a las 8:38 y por eso no podía dejar de sonar.
 *
 * ═══ LO QUE NO ENTRA, Y POR QUÉ CADA EXCLUSIÓN ═══
 *
 *   · `patientMedication.isActive: false` o `status` distinto de ACTIVE. De las
 *     232 dosis MISSED medidas, 77 cuelgan de recetas ya descontinuadas. Una
 *     lista que arranca con filas que nadie puede resolver es una alarma que no
 *     se apaga.
 *   · `scheduledTime: null` — un PRN no pertenece a ninguna franja y no se debe.
 *   · Los residentes los filtra quien llama, con `resolvePatientsByColors`, que
 *     ya acota a ACTIVE y TEMPORARY_LEAVE.
 *
 * ═══ SE AGRUPA POR EL INSTANTE, NO POR LA ETIQUETA DE TEXTO ═══
 *
 * `scheduleTime` es texto ("8:00 AM") y está NULO en todo lo que escribe
 * `/api/emar`. Agrupar por él fue exactamente lo que costó 6 dosis duplicadas
 * el 21-sep: `slotStatusToday` en la tableta casa por ese texto, no vio las 12
 * filas que había escrito el director, mostró el pack abierto, y la segunda
 * firma creó fila nueva encima. `scheduledTime` es la llave única real
 * —`@@unique([patientMedicationId, scheduledTime])`— y es la que se usa aquí.
 */

/** Estados que significan "esta dosis todavía espera a alguien". */
const ABIERTOS = ['PENDING', 'MISSED'] as const;

/**
 * LA VENTANA DEL TURNO — Y POR QUÉ NO EMPIEZA EN EL PONCHE.
 *
 * La primera versión de esto anclaba en `session.startTime`, y perdía en
 * silencio justo el caso que vino a resolver. Medido dosis por dosis sobre las
 * 163 abiertas de 30 días: **23 (14%) se quedaban fuera sólo por el ponche
 * tarde**, en cinco días distintos.
 *
 *   · 16-sep, pack de las 8:00 — las tres cuidadoras ponchan 08:53, 08:55 y
 *     08:58. Diez dosis fuera por 53 minutos.
 *   · 19-sep, **pack de las 5:00** — Joaneliz poncha 05:57 y Caridad 05:59.
 *     Seis dosis fuera por 57 minutos, y es el pack que ya tiene su propia
 *     entrada en la memoria del proyecto por nacer tarde y barrerse pronto.
 *   · 21-sep — Joselyn poncha 09:40; cuatro dosis de las 8:00 de Dwight
 *     Santiago, fuera.
 *
 * Nadie poncha antes de que empiece su turno, y las dosis se pautan a la hora
 * del turno, no a la hora en que llegó quien lo cubre. Así que la ventana
 * arranca en el **inicio del turno**, y el ponche sólo la adelanta si fue
 * todavía más temprano. Eso conserva el motivo por el que no se usaba el
 * recorte del día clínico —el turno de noche tiene a su cargo las 20:00 y las
 * 05:00— y recupera las 23.
 *
 * La cota de arriba sigue siendo el cierre: una dosis cuya hora no ha llegado
 * no se le puede reclamar a nadie, y sin ella el cierre de las 08:05 reclamaría
 * el pack de las 8:00 PM.
 */
export function ventanaDeDosisDelTurno(params: {
    ponche: Date;
    /** MORNING | EVENING | NIGHT | FULL_DAY | FULL_NIGHT. Otro → sólo el ponche. */
    tipoDeTurno: string | null | undefined;
    ahora: Date;
    cierre?: Date | null;
}): { desde: Date; hasta: Date } {
    const { ponche, tipoDeTurno, ahora, cierre } = params;

    // AST es UTC-4 todo el año: Puerto Rico no cambia la hora.
    const VENTANA: Record<string, readonly [number, number]> = {
        MORNING: [6, 14], EVENING: [14, 22], NIGHT: [22, 6],
        FULL_DAY: [6, 18], FULL_NIGHT: [18, 6],
    };
    const v = tipoDeTurno ? VENTANA[tipoDeTurno] : undefined;

    /** La hora AST `h` sobre la fecha de calendario AST de `ref`, como instante. */
    const astSobre = (ref: Date, h: number) => {
        const pared = new Date(ref.getTime() - 4 * 60 * 60 * 1000);
        return new Date(Date.UTC(
            pared.getUTCFullYear(), pared.getUTCMonth(), pared.getUTCDate(), h + 4, 0, 0, 0,
        ));
    };

    let desde = ponche;
    let finDelTurno: Date | null = null;
    if (v) {
        // Para un turno de noche ponchado a las 22:08 del 21, el inicio son las
        // 22:00 del 21 — no las del 22.
        const inicio = astSobre(ponche, v[0]);
        if (inicio < desde) desde = inicio;
        finDelTurno = astSobre(ponche, v[1]);
        // NIGHT [22,6] y FULL_NIGHT [18,6] cruzan medianoche: el fin es del día
        // siguiente al del inicio.
        if (finDelTurno <= inicio) finDelTurno = new Date(finDelTurno.getTime() + 24 * 60 * 60 * 1000);
    }

    /**
     * LA COTA DE ARRIBA ES LA MÁS PRONTA DE TRES, Y LAS TRES HACEN FALTA.
     *
     *   · `ahora` — una dosis cuya hora no ha llegado no se le reclama a nadie.
     *   · el cierre — si ya cerró, lo posterior no es suyo.
     *   · **el fin de su turno** — esta faltaba, y la añadió la medición: al
     *     mover el inicio a las 06:00, una cuidadora de mañana que cierra a las
     *     14:08 empezaba a recibir la franja de las **2:00 PM**, que es del
     *     turno de tarde. Medido: aparecía en cuatro turnos de 30 días. Pedirle
     *     cuentas de una franja que no es suya es la otra mitad del error que
     *     este fichero persigue — no basta con no callar; hay que no acusar.
     */
    let hasta = cierre && cierre < ahora ? cierre : ahora;
    if (finDelTurno && finDelTurno < hasta) hasta = finDelTurno;
    return { desde, hasta };
}

export interface DosisAbierta {
    /** id de la fila MedicationAdministration — es lo que se va a firmar. */
    id: string;
    patientMedicationId: string;
    patientId: string;
    residente: string;
    medicamento: string;
    /** PENDING = nadie la tocó. MISSED = el barrido ya la dio por omitida. */
    estado: string;
}

export interface FranjaSinResolver {
    /** Estable y derivado del instante: sobrevive a un refresco de pantalla. */
    id: string;
    /** El instante pautado exacto, que es la llave única de la dosis. */
    instante: string;
    /** "8:00 AM" — para la persona, no para casar filas. */
    etiqueta: string;
    dosis: DosisAbierta[];
}

/** "8:00 AM" desde un instante, en hora de Puerto Rico. */
function etiquetaAST(d: Date): string {
    return d.toLocaleTimeString('es-PR', {
        timeZone: 'America/Puerto_Rico',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    });
}

/**
 * Las franjas de este turno con dosis todavía abiertas, más recientes al final.
 *
 * `hasta` debe ser el momento del cierre (o el fin del turno, el que llegue
 * primero). Una dosis cuya hora no ha llegado no se le puede reclamar a nadie.
 */
export async function dosisSinResolverDelTurno(params: {
    patientIds: string[];
    desde: Date;
    hasta: Date;
}): Promise<FranjaSinResolver[]> {
    const { patientIds, desde, hasta } = params;
    if (patientIds.length === 0) return [];
    if (hasta.getTime() <= desde.getTime()) return [];

    const filas = await prisma.medicationAdministration.findMany({
        where: {
            status: { in: ABIERTOS as unknown as string[] as any },
            // Por la hora de la DOSIS, no por la de escritura. Ver el prólogo y
            // src/lib/emar-dia.ts.
            scheduledTime: { gte: desde, lt: hasta },
            patientMedication: {
                patientId: { in: patientIds },
                // Una receta descontinuada deja dosis que nadie puede resolver.
                isActive: true,
                status: 'ACTIVE',
            },
        },
        // El select lleva TODO lo que se lee después. Un campo que no se pide
        // vuelve null en todas las filas y se lee igual que "ninguna lo tiene".
        select: {
            id: true,
            status: true,
            scheduledTime: true,
            patientMedicationId: true,
            patientMedication: {
                select: {
                    patientId: true,
                    medication: { select: { name: true } },
                    patient: { select: { name: true } },
                },
            },
        },
        orderBy: { scheduledTime: 'asc' },
    });

    const porInstante = new Map<string, FranjaSinResolver>();
    for (const f of filas) {
        // No puede ser null: el where exige gte/lt. El guard es para el tipo.
        if (!f.scheduledTime) continue;
        const clave = f.scheduledTime.toISOString();
        if (!porInstante.has(clave)) {
            porInstante.set(clave, {
                id: `meds:${clave}`,
                instante: clave,
                etiqueta: etiquetaAST(f.scheduledTime),
                dosis: [],
            });
        }
        porInstante.get(clave)!.dosis.push({
            id: f.id,
            patientMedicationId: f.patientMedicationId,
            patientId: f.patientMedication.patientId,
            residente: f.patientMedication.patient?.name || 'Residente',
            medicamento: f.patientMedication.medication?.name || 'Medicamento',
            estado: f.status,
        });
    }

    return Array.from(porInstante.values());
}

/**
 * LAS RESPUESTAS POSIBLES, Y POR QUÉ LA PRIMERA ES "SÍ SE DIERON".
 *
 * El cierre ya tenía tres botones para una tarea sin hacer —"Rehusó",
 * "Durmió", "Trasladar al próximo turno"— y los tres significan que NO se
 * hizo. Para un medicamento eso deja fuera **el caso más frecuente**: el del
 * 21-sep, 45 de 45 dosis administradas de verdad y no anotadas, con la
 * cuidadora ocho horas en el piso y doce baños registrados.
 *
 * Una lista cerrada sin la salida honesta hace que la persona elija la opción
 * menos equivocada, y entonces el registro miente en la dirección contraria:
 * diría que once residentes rehusaron su medicación.
 *
 * `NO_PUEDO_GARANTIZAR` es la otra salida honesta, y es deliberadamente
 * distinta de una omisión: no afirma que no se dio. Deja la dosis como está y
 * guarda que se le preguntó y no pudo confirmarlo. Sin ella, quien no se
 * acuerda tiene que acusar a alguien —al residente o a sí misma— para poder
 * cerrar el turno.
 */
export const RESPUESTAS_DOSIS = [
    {
        codigo: 'SE_DIERON',
        etiqueta: 'Sí, se dieron',
        ayuda: 'Se administraron y no se alcanzó a registrar',
        /** Firma las dosis. La hora que se declara es la de la franja. */
        efecto: 'FIRMAR' as const,
    },
    {
        codigo: 'NO_SE_DIERON',
        etiqueta: 'No se dieron',
        ayuda: 'Hay que decir por qué',
        /** Abre los motivos de src/lib/omision-medicamento.ts. */
        efecto: 'PEDIR_MOTIVO' as const,
    },
    {
        codigo: 'NO_PUEDO_GARANTIZAR',
        etiqueta: 'No puedo garantizarlo',
        ayuda: 'Queda anotado así, sin afirmar nada',
        /** No toca la dosis. Solo deja constancia en el relevo. */
        efecto: 'SOLO_CONSTANCIA' as const,
    },
] as const;

export type CodigoRespuesta = typeof RESPUESTAS_DOSIS[number]['codigo'];

export interface ResultadoCierre {
    firmadas: number;
    omitidas: number;
    sinGarantia: number;
    /** Ya las había resuelto alguien entre que se mostró el aviso y el cierre. */
    yaResueltas: number;
    /**
     * Claves cuyo instante NO cae en la ventana de este turno. No es un error
     * del que responde: pasa cuando el supervisor fuerza el cierre a media
     * respuesta y la tableta conserva las claves del turno anterior. Se cuentan
     * para que se vean en vez de aplicarse.
     */
    fueraDeVentana: number;
}

/**
 * APLICA LAS RESPUESTAS DEL CIERRE. Se llama DENTRO de la transacción de
 * `/api/care/shift/end`, con la firma del relevo.
 *
 * ═══ POR QUÉ AQUÍ Y NO AVISO POR AVISO ═══
 *
 * La dosis firmada y el relevo firmado son un solo acto: o los dos o ninguno.
 * Escribiendo cada respuesta en el momento de pulsarla, una red que se cae a
 * mitad del cierre deja dosis firmadas colgando de un relevo que no existe — y
 * entonces la firma no es de ningún documento.
 *
 * ═══ LA FIRMA DEL RELEVO ES LA FIRMA DE LAS DOSIS, Y ES LITERAL ═══
 *
 * No es un atajo: lo que firma es el reporte que dice que las dio. El pack en
 * la tableta pide firma con el dedo (`meds/bulk:73`) porque allí no hay otro
 * documento; aquí sí lo hay, y es el mismo trazo.
 *
 * ═══ NUNCA SE CREE AL CLIENTE QUÉ FILAS SON ═══
 *
 * La tableta manda el INSTANTE de la franja, no ids de filas. Las filas se
 * vuelven a buscar aquí, con el mismo filtro de residentes que resolvió el
 * cierre. Un id de fila que viniera del cliente permitiría firmar la dosis de
 * cualquier residente de la casa.
 *
 * ═══ Y SI ALGUIEN YA LAS RESOLVIÓ, NO SE PISAN ═══
 *
 * Solo se toca lo que sigue en PENDING o MISSED. El 21-sep-2026 esto costó
 * exactamente 6 dosis contadas dos veces: dirección registró 12 a las 17:14 y
 * una cuidadora firmó el mismo pack a las 20:35 sobre filas que no las veían.
 * Aquí una dosis ya resuelta cuenta como `yaResueltas` y el cierre sigue: éxito
 * con lo que hay, nunca un error rojo al final de un turno de ocho horas.
 *
 * ═══ LA HORA QUE QUEDA, Y POR QUÉ NO PASA POR `resolverHoraReal` ═══
 *
 * Queda el instante pautado de la propia dosis. `MAX_ATRAS_HORAS` (19 h) existe
 * para acotar una hora que alguien TECLEA, y aquí nadie teclea ninguna: es el
 * `scheduledTime` que ya está en la fila. Un turno de noche que cierra a las
 * 6:30 declarando la franja de las 20:00 son 10 h y pasaría el tope; pero la
 * regla correcta no es que quepa por casualidad, es que este valor no es una
 * declaración libre.
 *
 * ═══ LO QUE ESTA FASE NO PUEDE HACER ═══
 *
 * La procedencia va en `notes`, que es texto libre, porque no hay dónde más:
 * `MedicationAdministration` no tiene `updatedAt` ni campo de origen, y
 * `createdAt` dejó de significar "cuándo se registró" el 15-sep-2026 (es la
 * hora del cron en el 90% de las filas del día).
 *
 * Y ojo con lo que este comentario decía antes: que la respuesta "queda
 * recuperable de verdad en `ShiftHandover.justifications`, que es JSON
 * consultable". Consultable lo es, pero **NADIE LA CONSULTA**: `justifications`
 * no tiene ni un lector en todo el repo. O sea que "No puedo garantizarlo" se
 * guardaba donde nadie mira, y este comentario afirmaba una recuperación que no
 * existe — el patrón de promete-y-no-entrega, dentro de la documentación del
 * fichero que vino a cerrarlo.
 *
 * Lo que SÍ llega hoy a una persona es el conteo: `ResultadoCierre` vuelve al
 * cierre y se pinta en la pantalla de "Turno Entregado". Falta que el panel del
 * supervisor lea `sinGarantia` con su detalle, y eso está pendiente a
 * propósito, dicho y no disimulado. Un campo de origen y el código del motivo
 * piden cambio de schema y van aparte.
 */
export async function aplicarRespuestasDeCierre(
    tx: {
        medicationAdministration: {
            findMany: (a: any) => Promise<any[]>;
            updateMany: (a: any) => Promise<{ count: number }>;
            update: (a: any) => Promise<any>;
        };
    },
    params: {
        justifications: Record<string, string>;
        patientIds: string[];
        caregiverId: string;
        caregiverName: string;
        firma: string;
        ahora: Date;
        /**
         * LA VENTANA DEL TURNO. NO ES OPCIONAL, Y ESTE ES EL PORQUÉ.
         *
         * La clave del aviso (`meds:<ISO>`) la elige el CLIENTE, y sin esta
         * ventana el servidor la aceptaba tal cual. Medido: 93 dosis viejas
         * quedaban firmables en un solo POST.
         *
         * El camino no es teórico. Una cuidadora responde tres avisos, el
         * supervisor le fuerza el cierre antes de que firme (11 veces en 30
         * días), su POST falla, vuelve a ponchar sin recargar la tableta — y
         * `justifications` conserva las claves del turno anterior. Al cerrar el
         * turno nuevo se aplicarían sin volver a mostrarse: administraciones
         * fechadas hace días, con la firma de hoy, sin error y sin aviso.
         *
         * Y la puerta estaba abierta a mano: un POST a /api/care/shift/end con
         * las claves que se quisieran. El prólogo de este fichero decía "nunca
         * se cree al cliente qué filas son" y la desconfianza estaba a medias:
         * el ámbito de residentes sí se recalculaba, el de tiempo no.
         */
        desde: Date;
        hasta: Date;
        /** Traducción código → etiqueta, para la nota. Inyectada para no acoplar. */
        etiquetaDeMotivo: (codigo: string) => string | null;
        /** Código → PENDING/REFUSED/HELD/OMITTED. Inyectada por lo mismo. */
        estadoDeMotivo: (codigo: string) => 'REFUSED' | 'HELD' | 'OMITTED';
    },
): Promise<ResultadoCierre> {
    const out: ResultadoCierre = {
        firmadas: 0, omitidas: 0, sinGarantia: 0, yaResueltas: 0, fueraDeVentana: 0,
    };
    if (params.patientIds.length === 0) return out;

    for (const [clave, respuesta] of Object.entries(params.justifications || {})) {
        if (!clave.startsWith('meds:')) continue;
        /**
         * `meds:<ISO>` o `meds:<ISO>|<patientId>`.
         *
         * La forma con residente es la que manda la tableta desde que la unidad
         * de la afirmación es el residente y no la franja: una rehusó, otra
         * estaba en el hospital, y con una sola respuesta por franja el
         * expediente decía lo mismo de las dos.
         *
         * La forma sin residente se conserva porque es la que resuelve "todas
         * se dieron" cuando no hay nada que separar, y porque no hay datos
         * viejos que migrar: `ShiftHandover.justifications` estaba vacío en los
         * 294 relevos de 30 días.
         */
        const resto = clave.slice('meds:'.length);
        const corte = resto.indexOf('|');
        const iso = corte >= 0 ? resto.slice(0, corte) : resto;
        const soloResidente = corte >= 0 ? resto.slice(corte + 1) : null;
        // Un residente que no esté en el ámbito resuelto no se toca. Sin esto,
        // la clave del cliente elegiría a quién firmar.
        if (soloResidente && !params.patientIds.includes(soloResidente)) {
            out.fueraDeVentana++;
            continue;
        }
        const instante = new Date(iso);
        if (isNaN(instante.getTime())) continue;
        // La ventana del turno, antes de tocar nada. Ver el comentario de
        // `desde`/`hasta` arriba: sin esto una clave rancia firma dosis de
        // hace días.
        if (instante < params.desde || instante >= params.hasta) {
            out.fueraDeVentana++;
            continue;
        }

        // "No puedo garantizarlo" NO toca la dosis, y eso es el punto: no
        // afirma que se dio ni que no. Queda en `justifications` y en el
        // reporte del relevo, que es donde una duda pertenece.
        if (respuesta === 'NO_PUEDO_GARANTIZAR') {
            out.sinGarantia++;
            continue;
        }

        const abiertas = await tx.medicationAdministration.findMany({
            where: {
                scheduledTime: instante,
                status: { in: ABIERTOS as unknown as string[] },
                patientMedication: {
                    patientId: soloResidente ? soloResidente : { in: params.patientIds },
                    isActive: true,
                    status: 'ACTIVE',
                },
            },
            // `notes` va en el select porque hay que CONSERVARLO. Sin pedirlo,
            // un campo vuelve null y se lee igual que "no tenia nada".
            select: { id: true, notes: true },
        });
        if (abiertas.length === 0) { out.yaResueltas++; continue; }
        // Las que ya traen nota se actualizan una por una para anteponerla; las
        // demas —la inmensa mayoria— van en un solo updateMany.
        const conNota = abiertas.filter(a => a.notes && String(a.notes).trim());
        const sinNota = abiertas.filter(a => !(a.notes && String(a.notes).trim()));
        const sello = `Confirmado al cerrar turno (${params.caregiverName},`
            + ` ${params.ahora.toISOString()}).`;

        if (respuesta === 'SE_DIERON') {
            const comun = {
                status: 'ADMINISTERED',
                administeredById: params.caregiverId,
                // El instante pautado de la propia dosis. Ver el prólogo.
                administeredAt: instante,
                signatureBase64: params.firma,
                /**
                 * LA ETIQUETA DEL SLOT, QUE SE HABÍA QUEDADO SIN ESCRIBIR.
                 *
                 * `slotStatusToday` en la tableta casa por este campo de TEXTO
                 * (care/page.tsx:248). Sin él, el pack que ella acaba de firmar
                 * le sigue apareciendo ABIERTO al turno siguiente — y la
                 * segunda firma crea fila nueva encima. Es el mecanismo exacto
                 * de las 6 dosis duplicadas del 21-sep, reintroducido por mí en
                 * el sitio que venía a cerrarlo.
                 */
                scheduleTime: etiquetaAST(instante),
            };
            if (sinNota.length > 0) {
                const r = await tx.medicationAdministration.updateMany({
                    // `status` va en el where, no solo en el findMany: así es un
                    // compare-and-swap y la carrera de milisegundos con quien
                    // firme a la vez se convierte en un conteo honesto en vez de
                    // en una firma que pisa otra.
                    where: { id: { in: sinNota.map(a => a.id) }, status: { in: ABIERTOS as unknown as string[] } },
                    data: { ...comun, notes: sello },
                });
                out.firmadas += r.count;
            }
            // La nota que ya estaba NO se pisa. Las que alcanza este camino son
            // justo las exculpatorias —"no hubo ventana para firmarla"— y
            // reemplazarlas por "Confirmado al cerrar turno" borraría la
            // explicación de por qué la dosis era infirmable. No hay `updatedAt`
            // ni historial de la fila: lo que se pisa aquí no vuelve.
            for (const a of conNota) {
                await tx.medicationAdministration.update({
                    where: { id: a.id },
                    data: { ...comun, notes: `${String(a.notes).trim()} · ${sello}` },
                });
                out.firmadas++;
            }
            continue;
        }

        if (respuesta.startsWith('NO_SE_DIERON:')) {
            const codigo = respuesta.slice('NO_SE_DIERON:'.length);
            const etiqueta = params.etiquetaDeMotivo(codigo);
            // Un código que no se reconoce no se convierte en "OMITTED" por
            // defecto: eso escribiría una omisión que nadie declaró. Se deja la
            // dosis como está y cuenta como sin garantía.
            if (!etiqueta) { out.sinGarantia++; continue; }
            const comun = {
                status: params.estadoDeMotivo(codigo),
                // No se administró: no hay hora de administración.
                administeredAt: null,
                /**
                 * `administeredById` NO SE TOCA — es "quién la dio", y aquí
                 * nadie la dio. Escribir su nombre en una dosis no administrada
                 * la deja indistinguible de una que sí, y el precedente del
                 * propio schema es `prnEfectoPorId`: quien responde puede no ser
                 * quien administró. Quién declaró la omisión queda en
                 * `ShiftHandover.justifications`, con la clave `meds:<ISO>`.
                 */
                scheduleTime: etiquetaAST(instante),
            };
            if (sinNota.length > 0) {
                const r = await tx.medicationAdministration.updateMany({
                    where: { id: { in: sinNota.map(a => a.id) }, status: { in: ABIERTOS as unknown as string[] } },
                    data: { ...comun, notes: `Omitido: ${etiqueta}. ${sello}` },
                });
                out.omitidas += r.count;
            }
            for (const a of conNota) {
                await tx.medicationAdministration.update({
                    where: { id: a.id },
                    data: { ...comun, notes: `${String(a.notes).trim()} · Omitido: ${etiqueta}. ${sello}` },
                });
                out.omitidas++;
            }
            continue;
        }
    }

    return out;
}
