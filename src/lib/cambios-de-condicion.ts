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
    descripcion: string;
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
    },
    {
        codigo: 'EN_OBSERVACION', etiqueta: 'Queda en observación',
        descripcion: 'Todavía no hay suficiente para cambiar nada. Se vigila.',
    },
    {
        codigo: 'DERIVADO_MEDICO', etiqueta: 'Referido a médico',
        descripcion: 'Necesita evaluación externa. Queda constancia de que se refirió.',
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
        /** No sale en la lista de botones: lo escribe el sistema al crear la ficha. */
        automatico: true,
    },
    {
        codigo: 'SIN_CAMBIO', etiqueta: 'Revisado, sin cambio',
        descripcion: 'Se miró y no procede. Vale registrarlo: el próximo turno no lo vuelve a reportar.',
    },
];

const RES = new Map(RESULTADOS.map(r => [r.codigo, r]));

export function esResultadoValido(codigo: string | null | undefined): boolean {
    return !!codigo && RES.has(codigo);
}

export function etiquetaResultado(codigo: string | null | undefined): string | null {
    return (codigo && RES.get(codigo)?.etiqueta) || null;
}

/** Quién puede reportar: quien está en el pasillo. */
export const PUEDEN_REPORTAR_CAMBIO = ['CAREGIVER', 'NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN'];
/** Quién puede cerrar: quien puede tocar el expediente. */
export const PUEDEN_REVISAR_CAMBIO = ['NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN'];
