/**
 * Merge condicional de className.
 *
 * Versión mínima — el repo no tiene clsx ni tailwind-merge instalados, así
 * que componemos a mano. Acepta strings, arrays, false/null/undefined
 * (descartados) y objetos { clase: condición }.
 *
 * Sin dedupe de utilidades Tailwind (no resuelve conflictos como "p-2 p-4");
 * el orden importa, la última gana en HTML. En la práctica, las primitivas
 * pasan sus defaults primero y className del consumidor al final.
 */
export type ClassValue = string | number | false | null | undefined | ClassValue[] | { [k: string]: unknown };

export function cn(...inputs: ClassValue[]): string {
    const out: string[] = [];
    const push = (v: ClassValue): void => {
        if (!v && v !== 0) return;
        if (typeof v === "string" || typeof v === "number") {
            out.push(String(v));
            return;
        }
        if (Array.isArray(v)) {
            v.forEach(push);
            return;
        }
        if (typeof v === "object") {
            for (const k of Object.keys(v)) {
                if ((v as Record<string, unknown>)[k]) out.push(k);
            }
        }
    };
    inputs.forEach(push);
    return out.join(" ");
}
