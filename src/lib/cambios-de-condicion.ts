/**
 * LO QUE EL PISO NOTA QUE CAMBIÓ
 * ──────────────────────────────
 * Catálogo de áreas y de cierres para `CambioDeCondicion`.
 *
 * POR QUÉ EXISTE. La tableta de la cuidadora tiene botón para lo que se repite
 * —baño, comida, rotación, medicamentos— y para lo grave —caída, traslado—.
 * Entre las dos cosas hay un hueco: lo que cambió y todavía no es una
 * emergencia. Camina distinto. Come menos hace tres días. Está más callado. Un
 * talón enrojecido.
 *
 * Eso, cuando se registra, termina en una nota de turno. Ejemplo real de Cupey:
 *
 *     "Presenta dificultad para caminar y lo hace inclinado. Es necesario
 *      trasladarlo en silla de ruedas para evitar caídas."
 *
 * Esa frase cambia el nivel de movilidad del expediente, cambia el riesgo de
 * caídas y cambia el PAI. Se quedó donde se escribió. `IntakeData.mobilityLevel`
 * siguió diciendo lo de antes, y el chequeo que compara el PAI contra el
 * expediente siguió comparando contra el dato viejo.
 *
 * LO QUE HACÍA FALTA NO ERA GUARDAR EL TEXTO. Eso ya se podía. Hacía falta que
 * alguien lo cerrara: quien lo ve no puede actualizar el expediente, y quien
 * puede actualizarlo no estaba en el pasillo. Por eso cada reporte tiene una
 * respuesta y un responsable, y mientras no la tenga cuenta en el badge de
 * enfermería. Una notificación se lee una vez y se va; un contador insiste.
 * Es la misma lección de las dos observaciones de personal que llevaban 56 y 45
 * días paradas, habiendo disparado su notificación.
 */

export interface AreaDeCambio {
    codigo: string;
    etiqueta: string;
    /** Lo que la cuidadora lee debajo, para no tener que adivinar qué cabe aquí. */
    ejemplo: string;
    /** Dónde vive ese dato en el expediente, cuando enfermería vaya a actualizarlo. */
    campoDelExpediente?: string;
}

export const AREAS_DE_CAMBIO: AreaDeCambio[] = [
    {
        codigo: 'MOVILIDAD', etiqueta: 'Se mueve distinto',
        ejemplo: 'Camina inclinado, se cansa antes, necesita silla, ya no se levanta solo',
        campoDelExpediente: 'IntakeData.mobilityLevel',
    },
    {
        codigo: 'APETITO', etiqueta: 'Come o bebe distinto',
        ejemplo: 'Lleva días comiendo poco, rechaza lo que antes aceptaba, toma menos agua',
    },
    {
        codigo: 'COGNICION', etiqueta: 'Más confundido',
        ejemplo: 'No reconoce, se pierde en el pasillo, repite, no sabe qué día es',
        campoDelExpediente: 'LifePlan.cognitiveLevel',
    },
    {
        codigo: 'ANIMO', etiqueta: 'Ánimo o conducta',
        ejemplo: 'Más callado, llora, se agita al bañarlo, no quiere salir del cuarto',
    },
    {
        codigo: 'PIEL', etiqueta: 'Piel',
        ejemplo: 'Enrojecimiento que no cede, humedad, una herida nueva',
    },
    {
        codigo: 'DOLOR', etiqueta: 'Dolor',
        ejemplo: 'Se queja al moverlo, protege un lado, gesticula al tocarlo',
    },
    {
        codigo: 'SUENO', etiqueta: 'Duerme distinto',
        ejemplo: 'No duerme de noche, duerme todo el día, se levanta a caminar',
    },
    {
        codigo: 'CONTINENCIA', etiqueta: 'Continencia',
        ejemplo: 'Empezó a mojarse, ya no avisa, más episodios que antes',
        campoDelExpediente: 'IntakeData.continenceLevel',
    },
    // La salida honesta. Sin ella, lo que no cabe en las ocho de arriba se
    // fuerza en la que menos se equivoca — y eso es exactamente el problema que
    // este modelo viene a resolver, no a repetir.
    {
        codigo: 'OTRO', etiqueta: 'Otra cosa',
        ejemplo: 'Algo cambió y no entra en ninguna de las anteriores',
    },
];

const AREAS = new Map(AREAS_DE_CAMBIO.map(a => [a.codigo, a]));

export function esAreaValida(codigo: string | null | undefined): boolean {
    return !!codigo && AREAS.has(codigo);
}

export function etiquetaArea(codigo: string | null | undefined): string {
    return (codigo && AREAS.get(codigo)?.etiqueta) || 'Sin clasificar';
}

/* ───────────────────────────── El cierre ────────────────────────────────── */

export interface ResultadoDeRevision {
    codigo: string;
    etiqueta: string;
    /** Lo que lee quien REVISA, al escoger el botón. */
    descripcion: string;
    /**
     * Lo que le llega a QUIEN LO REPORTÓ, y va siempre — se escriba o no una
     * respuesta a mano.
     *
     * Antes el aviso decía solo la etiqueta: "Andrés Flores: Referido a
     * médico." Cierto, y vacío para quien está en el pasillo: no dice qué pasa
     * ahora ni si tiene que hacer algo. Medido el 08-sep-2026, los nueve
     * reportes de piel se cerraron sin una sola respuesta escrita — no por
     * descuido, sino porque escribir nueve veces lo mismo no lo hace nadie.
     * Si la frase es siempre la misma, la escribe el sistema.
     *
     * La respuesta a mano no desaparece: se añade detrás cuando la hay.
     */
    paraQuienReporto: string;
    /**
     * Lo escribe el sistema, no se ofrece como botón.
     *
     * Un cierre que dice "declaré la úlcera" sin úlcera declarada sería la misma
     * mentira con otra etiqueta. Estos resultados solo existen como consecuencia
     * de haber hecho de verdad la cosa que dicen.
     */
    automatico?: boolean;
}

/** Los que una persona puede escoger. El resto los pone el sistema. */
export const RESULTADOS_ELEGIBLES = () => RESULTADOS.filter(r => !r.automatico);

export const RESULTADOS: ResultadoDeRevision[] = [
    {
        codigo: 'ACTUALIZADO_EXPEDIENTE', etiqueta: 'Actualicé el expediente',
        descripcion: 'El cambio era real y el expediente ya lo refleja.',
        paraQuienReporto: 'Tenías razón: el cambio era real y el expediente ya lo recoge.',
    },
    {
        codigo: 'EN_OBSERVACION', etiqueta: 'Queda en observación',
        descripcion: 'Todavía no hay suficiente para cambiar nada. Se vigila.',
        paraQuienReporto: 'Se está vigilando. Todavía no hay suficiente para cambiar nada — si lo ves distinto, vuelve a reportarlo.',
    },
    {
        codigo: 'DERIVADO_MEDICO', etiqueta: 'Referido a médico',
        // Cómo funciona de verdad, contado por Andrés el 08-sep-2026:
        // enfermería o administración manda la consulta al médico POR CORREO,
        // y él responde con instrucciones, con tratamiento, o lo deja anotado
        // para verlo en su próxima visita. No es una derivación abstracta.
        descripcion: 'Se le manda la consulta al médico por correo. Contesta con instrucciones o lo deja para su próxima visita.',
        paraQuienReporto: 'Se le consultó al médico por correo. Cuando conteste —con instrucciones, con tratamiento, o dejándolo para su próxima visita— se aplica aquí.',
    },
    {
        /**
         * DECLARAR LA ÚLCERA — el cierre que faltaba.
         *
         * Un cambio de PIEL cerrado con "actualicé el expediente" deja la nota
         * resuelta y la úlcera sin existir. Medido en Cupey el 06-sep-2026: once
         * residentes tenían úlceras escritas en notas de turno y CERO fichas en
         * el módulo, que enseñaba dos. Uno de ellos se fue al hospital por una
         * úlcera que el sistema no sabía que existía.
         *
         * Este resultado NO se puede elegir a mano: lo escribe el sistema cuando
         * de verdad se creó la ficha, en el mismo gesto. Un cierre que dice
         * "declaré la úlcera" sin úlcera declarada sería la misma mentira con
         * otra etiqueta.
         */
        codigo: 'ULCERA_DECLARADA', etiqueta: 'Declaré la úlcera',
        descripcion: 'Crea la ficha en el módulo de UPP, con su plan y sus dos relojes.',
        paraQuienReporto: 'Lo que reportaste es una úlcera. Ya está en el módulo, con su plan y su seguimiento.',
        /** No sale en la lista de botones: lo escribe el sistema al crear la ficha. */
        automatico: true,
    },
    {
        codigo: 'SIN_CAMBIO', etiqueta: 'Revisado, sin cambio',
        descripcion: 'Se miró y no procede. Vale registrarlo: el próximo turno no lo vuelve a reportar.',
        paraQuienReporto: 'Se miró y no procede. Hiciste bien en reportarlo: ahora queda constancia de que se revisó.',
    },
];

const RES = new Map(RESULTADOS.map(r => [r.codigo, r]));

export function esResultadoValido(codigo: string | null | undefined): boolean {
    return !!codigo && RES.has(codigo);
}

export function etiquetaResultado(codigo: string | null | undefined): string | null {
    return (codigo && RES.get(codigo)?.etiqueta) || null;
}

/** Lo que se le dice a quien reportó. Siempre hay algo que decirle. */
export function respuestaParaQuienReporto(codigo: string | null | undefined): string {
    return (codigo && RES.get(codigo)?.paraQuienReporto) || 'Tu reporte fue revisado.';
}

/** Quién puede reportar: quien está en el pasillo. */
export const PUEDEN_REPORTAR_CAMBIO = ['CAREGIVER', 'NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN'];
/** Quién puede cerrar: quien puede tocar el expediente. */
export const PUEDEN_REVISAR_CAMBIO = ['NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN'];

/**
 * EL COMPROMISO: 48 HORAS PARA MIRAR LO QUE REPORTA EL PISO.
 *
 * Decidido el 10-sep-2026 por Andrés y Celia, sobre esto, medido:
 *
 *     22 cambios reportados en 30 días
 *     11 revisados · 11 SIN REVISAR
 *     mediana hasta revisar: 123 horas — cinco días
 *
 * Y de los once resueltos, DIEZ fueron accionables (cuatro al médico, cuatro a
 * observación, dos al expediente). Uno solo resultó no ser nada. El piso
 * reporta bien; lo que falla es que la mitad de lo que reporta no lo mira
 * nadie.
 *
 * Por qué 48 y no 24: un cambio de condición no es una emergencia —para eso
 * están la alerta clínica y el traslado—, es un aviso temprano. 48 horas son
 * dos turnos y margen, y siguen siendo temprano. Y por qué no 72: a los cinco
 * días el aviso ya no es temprano, que es exactamente donde estábamos.
 *
 * SIN CONSECUENCIA NO ES UN COMPROMISO. Pasadas las 48 horas:
 *   - la línea de enfermería sube de MEDIA a ALTA y dice cuánto lleva el más
 *     viejo esperando;
 *   - y entra en el reporte semanal de dirección.
 *
 * Si esto hay que moverlo, se mueve aquí. Un número, un sitio.
 */
export const HORAS_PARA_REVISAR_CAMBIO = 48;

/** Horas que lleva esperando un cambio sin revisar. */
export function horasEsperando(reportadoAt: Date, ahora = new Date()): number {
    return (ahora.getTime() - reportadoAt.getTime()) / 3_600_000;
}

export function pasoElCompromiso(reportadoAt: Date, ahora = new Date()): boolean {
    return horasEsperando(reportadoAt, ahora) > HORAS_PARA_REVISAR_CAMBIO;
}

/**
 * ─────────────────────────────────────────────────────────────────────────
 * CUANDO NO ES UNO, ES UN PATRÓN.
 *
 * El 10-sep-2026, a las 14:44, Joaneliz reportó "piquiña y enrojecimiento" en
 * ONCE residentes distintos en dos minutos. Los once del segundo piso. Los once
 * del grupo BLUE.
 *
 * El sistema lo guardó como once líneas iguales en una lista, y once líneas
 * iguales se leen como once cosas pequeñas. Nadie las habría juntado hasta que
 * alguien se parara delante de la pantalla y lo notara con el ojo.
 *
 * Once personas con lo mismo el mismo día en la misma planta no son once
 * observaciones: es sarna, o un detergente nuevo, o algo de la lavandería, o
 * un producto de limpieza. Cuál sea lo dice enfermería. Que HAY algo lo puede
 * decir el sistema, y ese aviso no puede esperar 48 horas.
 *
 * EL UMBRAL SON TRES, y no es un número inventado. Sobre los 28 cambios del
 * histórico: 17 fueron de un solo residente en su área, dos veces coincidieron
 * dos, y de tres para arriba NO HABÍA PASADO NUNCA. La primera vez que este
 * detector se dispara es hoy. Así se ve una alarma que sirve: rara, y cuando
 * suena, pasa algo.
 * ─────────────────────────────────────────────────────────────────────────
 */
export const RESIDENTES_PARA_SER_PATRON = 3;

export interface PatronDeCambios {
    area: string;
    residentes: { nombre: string; habitacion: string | null; grupo: string | null }[];
    /** Lo que comparten, si comparten algo. Es por donde se empieza a buscar. */
    enComun: string | null;
    desde: Date;
}

interface CambioParaPatron {
    area: string;
    patientId: string;
    reportadoAt: Date;
    patient: { name: string; roomNumber: string | null; colorGroup: string | null };
}

/**
 * Devuelve las áreas donde coinciden RESIDENTES_PARA_SER_PATRON o más
 * residentes distintos dentro de la ventana.
 *
 * `enComun` es la mitad del valor del aviso: "once residentes" es un número,
 * "once residentes, todos del grupo BLUE, todos en el segundo piso" es una
 * pista. Se mira el grupo de color y el prefijo de la habitación, que en este
 * hogar es la planta.
 */
export function detectarPatrones(
    cambios: CambioParaPatron[],
    ahora = new Date(),
): PatronDeCambios[] {
    const ini = ahora.getTime() - HORAS_PARA_REVISAR_CAMBIO * 3_600_000;
    const recientes = cambios.filter(c => c.reportadoAt.getTime() >= ini);

    const porArea = new Map<string, CambioParaPatron[]>();
    recientes.forEach(c => porArea.set(c.area, [...(porArea.get(c.area) ?? []), c]));

    const patrones: PatronDeCambios[] = [];
    for (const [area, lista] of porArea) {
        const porResidente = new Map<string, CambioParaPatron>();
        lista.forEach(c => { if (!porResidente.has(c.patientId)) porResidente.set(c.patientId, c); });
        if (porResidente.size < RESIDENTES_PARA_SER_PATRON) continue;

        const gente = [...porResidente.values()];
        const residentes = gente.map(c => ({
            nombre: c.patient.name.trim(),
            habitacion: c.patient.roomNumber,
            grupo: c.patient.colorGroup,
        }));

        const grupos = new Set(residentes.map(r => r.grupo).filter(Boolean));
        // "2-05" -> "2". Si todos comparten prefijo, comparten planta.
        const plantas = new Set(residentes.map(r => (r.habitacion ?? '').split('-')[0]).filter(Boolean));

        const pistas: string[] = [];
        if (grupos.size === 1 && residentes.length > 1) pistas.push(`todos del grupo ${[...grupos][0]}`);
        if (plantas.size === 1 && residentes.length > 1) pistas.push(`todos en la planta ${[...plantas][0]}`);

        patrones.push({
            area,
            residentes,
            enComun: pistas.length > 0 ? pistas.join(', ') : null,
            desde: gente.reduce((min, c) => c.reportadoAt < min ? c.reportadoAt : min, gente[0].reportadoAt),
        });
    }
    return patrones.sort((a, b) => b.residentes.length - a.residentes.length);
}
