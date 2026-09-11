/**
 * CUÁNTAS COMIDAS DEBERÍAN ESTAR SERVIDAS A ESTA HORA.
 *
 * Andrés, 11-sep-2026: "en el panel del director dice que la cobertura de comida
 * está en 0, cosa que no ha sucedido."
 *
 * Tenía razón, y el cero no era un fallo de datos: era la cuenta.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * QUÉ ESTABA PASANDO
 *
 * El briefing dividía las comidas registradas entre `residentes × 3` — las TRES
 * del día — y se genera por la mañana. Hoy corrió a las 8:38 AM. A esa hora, en
 * el mejor de los casos posibles, la cobertura no puede pasar del 33%: el
 * almuerzo y la cena todavía no han ocurrido.
 *
 * Y la regla avisa cuando baja del 70%. O sea: una alarma que NO PUEDE dejar de
 * sonar, todas las mañanas, diga lo que diga el piso.
 *
 * Encima, `timeLogged` es la hora REAL de la comida, no la de registro — la
 * cuidadora la declara. Hoy el desayuno se sirvió a las 7:25 y se registró
 * después de las 8:38, así que cuando el briefing miró no había ni una fila.
 * Cero de verdad, en una mañana en la que se desayunó con normalidad.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LAS HORAS NO ME LAS INVENTÉ
 *
 * Salen de las 1.272 comidas registradas en la sede en los últimos 14 días:
 *
 *              p10      mediana    p90
 *   Desayuno   07:47    08:51      09:34
 *   Almuerzo   11:43    12:59      13:38
 *   Cena       17:21    17:59      18:27
 *
 * El corte de cada comida es su p90 redondeado hacia arriba: la hora a la que,
 * si esa comida no está registrada, ya no es que sea pronto. Nueve de cada diez
 * veces ya se sirvió.
 */

/** Comidas del día, con la hora (local de PR) a la que se da por vencida. */
export const COMIDAS = [
    { tipo: 'BREAKFAST', etiqueta: 'Desayuno', venceALas: 10 },
    { tipo: 'LUNCH', etiqueta: 'Almuerzo', venceALas: 14 },
    { tipo: 'DINNER', etiqueta: 'Cena', venceALas: 19 },
] as const;

/** Hora local de Puerto Rico (AST, UTC-4 todo el año: no hay horario de verano). */
function horaEnPR(momento: Date): number {
    return (momento.getUTCHours() - 4 + 24) % 24 + momento.getUTCMinutes() / 60;
}

/**
 * Las comidas cuyo plazo ya pasó a esta hora.
 *
 * A las 8:38 de la mañana no ha vencido ninguna, y esa es la respuesta correcta:
 * no es que la cobertura sea mala, es que todavía no hay nada que medir.
 */
export function comidasVencidas(momento = new Date()) {
    const h = horaEnPR(momento);
    return COMIDAS.filter(c => h >= c.venceALas);
}

export interface CoberturaComidas {
    /** null = todavía no vence ninguna comida; no hay nada que medir. */
    porcentaje: number | null;
    servidas: number;
    esperadas: number;
    /** Las comidas cuyo plazo pasó, con lo que falta de cada una. */
    detalle: { etiqueta: string; servidas: number; esperadas: number }[];
    /** Frase lista para el panel, con su referencia. Nunca un número solo. */
    resumen: string;
}

/**
 * Cobertura contra lo que DEBERÍA estar servido, no contra el día entero.
 *
 * `registradas` son los pares (residente, tipo de comida) únicos de hoy.
 */
export function calcularCobertura(
    registradas: { patientId: string; mealType: string }[],
    residentes: number,
    momento = new Date(),
): CoberturaComidas {
    const vencidas = comidasVencidas(momento);

    if (residentes === 0 || vencidas.length === 0) {
        return {
            porcentaje: null, servidas: 0, esperadas: 0, detalle: [],
            resumen: vencidas.length === 0
                ? 'Todavía no vence ninguna comida del día.'
                : 'Sin residentes activos.',
        };
    }

    const vistos = new Set(registradas.map(m => `${m.patientId}::${m.mealType}`));
    const detalle = vencidas.map(c => ({
        etiqueta: c.etiqueta,
        servidas: [...vistos].filter(k => k.endsWith(`::${c.tipo}`)).length,
        esperadas: residentes,
    }));

    const servidas = detalle.reduce((a, d) => a + d.servidas, 0);
    const esperadas = residentes * vencidas.length;

    return {
        porcentaje: Math.round((servidas / esperadas) * 100),
        servidas,
        esperadas,
        detalle,
        resumen: detalle.map(d => `${d.etiqueta} ${d.servidas}/${d.esperadas}`).join(' · '),
    };
}
