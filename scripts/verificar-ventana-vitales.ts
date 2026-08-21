/**
 * Comprueba que acortar el plazo de vitales no movió el umbral de penalidad.
 *
 * El 19-ago-2026 el plazo bajó de 4h a 3h por decisión de la enfermera del hogar.
 * Si la penalidad hubiera seguido al plazo, todo el personal habría perdido puntos
 * de un día para otro: el 17% de las tomas completadas ocurren entre la hora 3 y
 * la 4. La gracia mantiene el umbral donde estaba.
 *
 * Uso: npx tsx scripts/verificar-ventana-vitales.ts
 */
import { VITALS_WINDOW_MS, PENALTY_GRACE_MS, PENALTY_THRESHOLD_MS } from '../src/lib/vitals-window';

const UMBRAL_ANTERIOR_H = 4;
const h = (ms: number) => ms / 3_600_000;

console.log(`Plazo que ve el cuidador : ${h(VITALS_WINDOW_MS)}h`);
console.log(`Gracia antes de penalizar: ${h(PENALTY_GRACE_MS)}h`);
console.log(`Umbral real de penalidad : ${h(PENALTY_THRESHOLD_MS)}h   (antes: ${UMBRAL_ANTERIOR_H}h)`);

if (h(PENALTY_THRESHOLD_MS) === UMBRAL_ANTERIOR_H) {
    console.log('\n✅ Nadie pierde un punto que no perdiera antes del cambio.');
} else {
    console.log('\n⚠️  El umbral de penalidad se movió. Si es intencional, actualiza');
    console.log('    UMBRAL_ANTERIOR_H en este script y avisa a RRHH: cambia el Z-Score.');
    process.exit(1);
}
