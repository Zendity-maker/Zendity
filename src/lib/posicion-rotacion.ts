/**
 * EL MISMO DECÚBITO, ESCRITO DE DOS MANERAS.
 *
 * `PosturalChangeLog.position` tiene cuatro vocabularios conviviendo, medidos
 * sobre las 5.623 rotaciones de 30 días en Cupey:
 *
 *   4.649  "Rotación General (Pre-programada Zendi)"   ← el botón de Rondas
 *     608  "Supino"      ·   114 "Derecho"   ·   113 "Izquierdo"   ← la tira
 *      45  "SUPINO"      ·    24 "DERECHA"   ·    60 "IZQUIERDA"   ← el modal
 *
 * La tira de la cara escribe en capicular ("Izquierdo") y el modal en mayúscula
 * y femenino ("IZQUIERDA"). Son el mismo lado del cuerpo.
 *
 * ═══ POR QUÉ ESTO EXISTE ═══
 *
 * El 22-sep-2026 se añadió `position` a la guarda anti-duplicado de
 * `/api/care/rounds` para no tragarse una corrección: quien registra
 * "Izquierdo" y se corrige a "Derecha" en el mismo minuto tiene que poder.
 *
 * Pero comparar la cadena EXACTA abrió un agujero en el otro sentido: un doble
 * toque que cruza superficies —la tira y el modal— escribe dos cadenas
 * distintas para el mismo acto y la guarda no lo ve. Medido: la guarda nueva
 * habría atrapado 326 de los pares de 30 días contra los 357 de la vieja. Una
 * guarda que protege menos que la que sustituye es una regresión, por mucho
 * que arregle otra cosa.
 *
 * Aquí se compara por LADO, no por cadena. No se normaliza lo que se escribe:
 * cambiar eso dejaría las filas nuevas sin comparar con las viejas, y el
 * display ya sabe leer las dos formas (`posicionLegible` en care/page.tsx).
 */

/** Los lados que distingue el protocolo. `GENERICA` es la ronda sin decúbito. */
export type LadoRotacion = 'IZQ' | 'SUP' | 'DER' | 'GENERICA';

const VARIANTES: Record<Exclude<LadoRotacion, 'GENERICA'>, string[]> = {
    IZQ: ['Izquierdo', 'IZQUIERDA', 'Izquierda', 'IZQUIERDO'],
    SUP: ['Supino', 'SUPINO'],
    DER: ['Derecho', 'DERECHA', 'Derecha', 'DERECHO'],
};

/** El lado al que pertenece una cadena, sin importar cómo se escribió. */
export function ladoDeRotacion(position?: string | null): LadoRotacion {
    if (!position) return 'GENERICA';
    const p = position.trim().toUpperCase();
    if (/^ROTACI[OÓ]N GENERAL/.test(p)) return 'GENERICA';
    if (p.startsWith('IZQ')) return 'IZQ';
    if (p.startsWith('SUP')) return 'SUP';
    if (p.startsWith('DER')) return 'DER';
    return 'GENERICA';
}

/**
 * Todas las cadenas que significan lo mismo que ésta, para meterlas en un
 * `where: { position: { in: [...] } }`.
 *
 * Para la genérica devuelve la cadena tal cual: es una sola forma y no tiene
 * sinónimos que buscar.
 */
export function variantesDePosicion(position?: string | null): string[] {
    const lado = ladoDeRotacion(position);
    if (lado === 'GENERICA') {
        return [position?.trim() || 'Rotación General (Pre-programada Zendi)'];
    }
    return VARIANTES[lado];
}
