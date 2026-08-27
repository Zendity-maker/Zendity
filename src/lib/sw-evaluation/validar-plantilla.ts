/**
 * Validación de una plantilla de evaluación de trabajo social.
 *
 * POR QUÉ EXISTE
 *
 * La plantilla "Evaluación Psicosocial Inicial" tenía la clave `observations`
 * repetida ONCE veces — una por cada sección de la IV a la XVII. Como el
 * formulario guarda los valores en un objeto plano indexado por `field.key`,
 * los once campos escribían en la MISMA casilla: la trabajadora social
 * escribía las observaciones de Salud Mental y aparecían idénticas en
 * Comunicación, Educación, Datos Económicos y ocho secciones más.
 *
 * Con un formulario de 46 campos, eso se abandona a los dos minutos. Y así
 * fue: una evaluación en toda la historia del módulo.
 *
 * Nada fallaba. El formulario cargaba, guardaba y no daba error — solo hacía
 * algo distinto de lo que aparentaba. Por eso hace falta una comprobación
 * explícita: un duplicado de clave no se ve leyendo el archivo, que tiene 400
 * líneas y las secciones están lejos unas de otras.
 */
import type { SWFormTemplateSchema } from './template-types';

export interface ProblemaPlantilla {
    tipo: 'CLAVE_CAMPO_DUPLICADA' | 'CLAVE_SECCION_DUPLICADA' | 'CAMPO_SIN_CLAVE' | 'SECCION_SIN_CAMPOS';
    detalle: string;
}

/**
 * Devuelve los problemas de una plantilla. Vacío = la plantilla es válida.
 *
 * No lanza: quien llama decide si aborta (el seed) o solo avisa (una pantalla).
 */
export function validarPlantilla(schema: SWFormTemplateSchema): ProblemaPlantilla[] {
    const problemas: ProblemaPlantilla[] = [];

    const vistasSeccion = new Map<string, number>();
    // Dónde vive cada clave de campo, para que el mensaje diga QUÉ secciones
    // chocan y no solo que hay un choque.
    const vistasCampo = new Map<string, string[]>();

    for (const seccion of schema.sections ?? []) {
        vistasSeccion.set(seccion.key, (vistasSeccion.get(seccion.key) ?? 0) + 1);

        const campos = seccion.fields ?? [];
        if (campos.length === 0) {
            problemas.push({
                tipo: 'SECCION_SIN_CAMPOS',
                detalle: `La sección "${seccion.key}" no tiene ningún campo.`,
            });
        }

        for (const campo of campos) {
            if (!campo.key) {
                problemas.push({
                    tipo: 'CAMPO_SIN_CLAVE',
                    detalle: `Un campo de la sección "${seccion.key}" no tiene clave.`,
                });
                continue;
            }
            vistasCampo.set(campo.key, [...(vistasCampo.get(campo.key) ?? []), seccion.key]);
        }
    }

    for (const [clave, secciones] of vistasCampo) {
        if (secciones.length > 1) {
            problemas.push({
                tipo: 'CLAVE_CAMPO_DUPLICADA',
                detalle: `La clave "${clave}" se repite en ${secciones.length} secciones (${secciones.join(', ')}). `
                    + 'Todas escribirían en el mismo dato: lo que se teclee en una aparecerá en las demás. '
                    + 'Dale a cada una una clave propia, por ejemplo "' + clave + '_' + secciones[0] + '".',
            });
        }
    }

    for (const [clave, veces] of vistasSeccion) {
        if (veces > 1) {
            problemas.push({
                tipo: 'CLAVE_SECCION_DUPLICADA',
                detalle: `La sección "${clave}" está declarada ${veces} veces.`,
            });
        }
    }

    return problemas;
}

/** Igual, pero aborta. Para el seed: una plantilla rota no debe llegar a la base. */
export function exigirPlantillaValida(schema: SWFormTemplateSchema, nombre: string): void {
    const problemas = validarPlantilla(schema);
    if (problemas.length === 0) return;
    const lista = problemas.map(p => `  · [${p.tipo}] ${p.detalle}`).join('\n');
    throw new Error(`La plantilla "${nombre}" tiene ${problemas.length} problema(s):\n${lista}`);
}
