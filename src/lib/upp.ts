/**
 * ÚLCERAS: CUATRO ACTOS DISTINTOS, NO UNO
 * ───────────────────────────────────────
 * Andrés lo explicó el 06-sep-2026 y cambia el modelo entero:
 *
 *   1. EL HOME CARE ESTABLECE EL TRATAMIENTO. No es personal del hogar. El plan
 *      viene de fuera y el hogar hace continuidad.
 *   2. LA ENFERMERA DE SERVICIOS EXTERNOS viene y hace LA curación, según ese
 *      plan. Es el acto clínico formal.
 *   3. LAS CUIDADORAS LIMPIAN Y TAPAN, solo cuando hace falta: el apósito está
 *      sucio, se ensució con excremento, hay exceso de secreción. NO aplican el
 *      tratamiento — esperan a la enfermera.
 *   4. ENFERMERÍA Y DIRECCIÓN VERIFICAN la úlcera cuando les toca mirarla.
 *
 * HASTA HOY LOS CUATRO CABÍAN EN EL MISMO HUECO, y eso hacía que el expediente
 * mintiera en las DOS direcciones:
 *
 *   · Si el cambio de apósito de una cuidadora contaba como curación, el reloj
 *     de 7 días se reiniciaba y Enfermería se callaba — el sistema decía que la
 *     herida se trató cuando nadie con criterio clínico la miró. Esa es la
 *     dirección peligrosa.
 *   · Si no contaba —que es lo que pasaba, porque las cuidadoras no podían
 *     escribir nada— el trabajo real era invisible. Luz M. Ríos aparecía con 77
 *     días sin curación y el apósito pudo cambiarse treinta veces.
 *
 * POR ESO HAY DOS RELOJES, no uno:
 *
 *   · ¿cuándo se hizo LA CURACIÓN del plan?      → el que ya alertaba
 *   · ¿cuándo MIRÓ alguien con criterio clínico? → nuevo; es el que habría
 *                                                   cantado a los 77 días en un
 *                                                   estadio 4
 *
 * Y un tercer dato que no es reloj: CUÁNTOS cambios de apósito y POR QUÉ. Tres
 * cambios por excremento en un día sobre una sacra estadio 4 es información
 * clínica —dice que la herida se está contaminando y que el plan no aguanta—
 * y hasta hoy no existía en ningún sitio.
 *
 * PENDIENTE, aparcado por Andrés: que la enfermera de servicios externos
 * registre su curación desde la tableta. El módulo ya existe
 * (ExternalServiceVisit + ExternalServiceVisitPatient + ExternalKioskDevice con
 * piso y aprobación del director), así que la curación se colgará de su visita
 * registrada. Se activa cuando se active la tableta.
 */

/**
 * EN QUÉ ESTADO ESTÁ UNA ÚLCERA — Y POR QUÉ HAY DOS FORMAS DE CERRARLA
 *
 * Wilfredo Matos Marchany falleció. Sus dos úlceras llevaban 85 días abiertas y
 * seguían contando en Enfermería, porque los únicos estados eran ACTIVE,
 * HEALING y RESOLVED — y marcar "resuelta" la úlcera de alguien que murió es
 * escribir en un expediente clínico que la herida sanó. No sanó: el residente
 * se fue.
 *
 * Es la lista cerrada sin salida honesta otra vez: sin un estado que diga la
 * verdad, la opción era mentir o dejarlo abierto para siempre. Se dejó abierto,
 * y el conteo mintió hacia arriba durante tres meses.
 *
 * ABIERTAS SE DEFINE EN POSITIVO, y es a propósito. Media docena de consultas
 * filtraban `status != 'RESOLVED'`, así que CUALQUIER estado nuevo entraba solo
 * en todas ellas. Con una lista blanca, añadir un estado no puede colar una
 * úlcera cerrada en una pantalla que nadie recordaba tocar.
 */
export const ESTADOS_ABIERTOS = ['ACTIVE', 'HEALING'] as const;
export const ESTADOS_UPP = ['ACTIVE', 'HEALING', 'RESOLVED', 'CERRADA_SIN_RESOLVER'] as const;

/** El `where` de Prisma para "sigue abierta". Se usa en TODAS las consultas. */
export const ULCERA_ABIERTA = { status: { in: [...ESTADOS_ABIERTOS] } };

/**
 * Por qué se cerró sin sanar. Obligatorio: un cierre sin motivo es un hueco con
 * fecha, y dentro de un año nadie sabrá si la herida sanó o el residente murió.
 */
export const MOTIVOS_CIERRE = [
    { codigo: 'FALLECIMIENTO', etiqueta: 'El residente falleció' },
    { codigo: 'EGRESO', etiqueta: 'El residente salió del hogar' },
    { codigo: 'HOSPITALIZACION', etiqueta: 'Pasó a manos del hospital' },
    { codigo: 'OTRO', etiqueta: 'Otra razón — la escribo abajo' },
] as const;

export function etiquetaDeCierre(codigo: string | null | undefined): string {
    return MOTIVOS_CIERRE.find(m => m.codigo === codigo)?.etiqueta ?? (codigo ?? '—');
}

export type TipoRegistroUpp = 'CURACION' | 'CAMBIO_APOSITO' | 'VALORACION';

export interface DefinicionTipo {
    etiqueta: string;
    /** La frase que marca la raya. Se enseña en la pantalla, no en un manual. */
    queEs: string;
    /** Quién puede escribir este tipo de registro. */
    roles: string[];
    pideTratamiento: boolean;
    pideMotivo: boolean;
    puedeCambiarEstadio: boolean;
    reiniciaCuracion: boolean;
    reiniciaValoracion: boolean;
}

export const TIPOS_UPP: Record<TipoRegistroUpp, DefinicionTipo> = {
    CURACION: {
        etiqueta: 'Curación',
        queEs: 'El tratamiento del plan del home care. Lo hace la enfermera.',
        roles: ['NURSE', 'DIRECTOR', 'ADMIN'],
        pideTratamiento: true,
        pideMotivo: false,
        puedeCambiarEstadio: true,
        reiniciaCuracion: true,
        // Quien cura, mira. No hace falta una valoración aparte el mismo día.
        reiniciaValoracion: true,
    },
    CAMBIO_APOSITO: {
        etiqueta: 'Cambié el apósito',
        queEs:
            'Esto no es la curación. La curación la hace la enfermera según el plan del home care. '
            + 'Esto es para cuando hay que limpiar y tapar antes de que ella venga.',
        roles: ['CAREGIVER', 'NURSE', 'SUPERVISOR', 'DIRECTOR', 'ADMIN'],
        // NO se pregunta qué aplicó. La cuidadora limpia y tapa; no sigue el
        // tratamiento. Preguntárselo la obligaría a inventarse una respuesta y
        // el expediente se llenaría de tratamientos que nadie indicó.
        pideTratamiento: false,
        pideMotivo: true,
        puedeCambiarEstadio: false,
        reiniciaCuracion: false,
        reiniciaValoracion: false,
    },
    VALORACION: {
        etiqueta: 'Verifiqué la úlcera',
        queEs: 'Alguien con criterio clínico la miró y dice cómo va. No implica haberla curado.',
        roles: ['NURSE', 'DIRECTOR', 'ADMIN'],
        pideTratamiento: false,
        pideMotivo: false,
        puedeCambiarEstadio: true,
        reiniciaCuracion: false,
        reiniciaValoracion: true,
    },
};

export function puedeRegistrar(tipo: TipoRegistroUpp, roles: (string | null | undefined)[]): boolean {
    const permitidos = TIPOS_UPP[tipo].roles;
    return roles.some(r => !!r && permitidos.includes(r));
}

/**
 * Por qué se cambió el apósito.
 *
 * Lista cerrada CON SALIDA: sin "otra cosa" el personal escoge la opción menos
 * equivocada y el registro miente. La salida pide escribirlo, que es lo único
 * que hace que un motivo raro llegue a alguien.
 */
export const MOTIVOS_CAMBIO = [
    { codigo: 'SUCIO', etiqueta: 'El apósito estaba sucio o mojado' },
    { codigo: 'EXCREMENTO', etiqueta: 'Se ensució con excremento u orina' },
    { codigo: 'SECRECION', etiqueta: 'Exceso de secreción' },
    { codigo: 'DESPEGADO', etiqueta: 'Se despegó o se movió' },
    { codigo: 'SANGRADO', etiqueta: 'Había sangrado' },
    { codigo: 'OTRO', etiqueta: 'Otra cosa — la escribo abajo' },
] as const;

export type MotivoCambio = typeof MOTIVOS_CAMBIO[number]['codigo'];

export function etiquetaDeMotivo(codigo: string | null | undefined): string {
    return MOTIVOS_CAMBIO.find(m => m.codigo === codigo)?.etiqueta ?? (codigo ?? '—');
}

/**
 * LOS DOS RELOJES.
 *
 * Siete días es lo que ya usaba el sistema para la curación; la valoración
 * hereda el mismo número. NO es un estándar clínico: es un valor de producto
 * que Celia debería confirmar o corregir. Queda escrito para que nadie lo
 * confunda con una guía.
 */
export const DIAS_SIN_CURACION = 7;
export const DIAS_SIN_VALORACION = 7;

/**
 * Cuándo el piso tiene que avisar a enfermería.
 *
 * Dos señales, las dos medibles y las dos del piso:
 *
 *   · excremento sobre una úlcera profunda — contaminación fecal de un estadio
 *     3 o 4 no espera a la próxima visita
 *   · tres cambios en 24 horas — a ese ritmo el plan no está aguantando, y eso
 *     lo decide una enfermera, no la cuidadora que va por el tercero
 *
 * Devuelve el texto del aviso, o null si no hace falta. Nunca bloquea el
 * registro: la cuidadora anota y sigue; el aviso viaja solo.
 */
export function avisoAEnfermeria(
    motivo: string | null | undefined,
    estadio: number,
    cambiosEnUnDia: number,
): string | null {
    if (motivo === 'EXCREMENTO' && estadio >= 3) {
        return `Contaminación fecal sobre una úlcera estadio ${estadio}.`;
    }
    if (cambiosEnUnDia >= 3) {
        return `${cambiosEnUnDia} cambios de apósito en 24 horas.`;
    }
    return null;
}
