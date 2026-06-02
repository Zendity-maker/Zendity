/**
 * tone-tokens.ts — catálogo central del vocabulario de tonos del DS.
 *
 * Significados compartidos por StatTile (surface tinted fuerte) y
 * MetricCard (surface neutral o soft, value tinted). Si en el futuro
 * aparece un nuevo consumidor con otro idioma visual, también
 * consume desde aquí — para que "warning" signifique amber en TODAS
 * partes y no derive.
 *
 * Bloques expuestos por tono:
 *   - soft   → surface tinted suave (Card outer del landing): bg-{c}-50/60 + border-{c}-100
 *   - strong → surface tinted fuerte (StatTile actual):       bg-{c}-50 + border-{c}-{200|300 si danger}
 *   - pill   → icon en píldora (Live Stats, Alertas):         bg-{c}-100 + text-{c}-700
 *   - inline → icon plano al lado del label (Social):         text-{c}-500
 *   - text   → variantes por intensidad ({c}-{700|600|500})
 *
 * Los 5 tonos compartidos (neutral, teal, success, warning, danger) están
 * sembrados con los valores EXACTOS de la tabla local actual de StatTile.
 * Cuando StatTile migre a consumir desde aquí (sprint de cleanup futuro),
 * el resultado visual no cambia ni un píxel.
 */

export type Tone =
    | "neutral"
    | "teal"
    | "success"
    | "warning"
    | "danger"
    | "info"
    | "indigo";

export interface ToneTokens {
    soft:   { bg: string; border: string };
    strong: { bg: string; border: string };
    pill:   { bg: string; fg: string };
    inline: string;
    text:   { strong: string; medium: string; soft: string };
}

export const tonePalette: Record<Tone, ToneTokens> = {
    neutral: {
        // soft: en landing el "neutral" no aparece como tinte (es siempre bg-white).
        // Lo dejamos compatible con bg-white por si MetricCard surface='soft' + tone='neutral'.
        soft:   { bg: "bg-white",       border: "border-slate-200" },
        strong: { bg: "bg-white",       border: "border-slate-200" },
        pill:   { bg: "bg-slate-100",   fg: "text-slate-600" },
        inline: "text-slate-500",
        text:   { strong: "text-slate-800", medium: "text-slate-600", soft: "text-slate-500" },
    },
    teal: {
        soft:   { bg: "bg-teal-50/50",  border: "border-teal-100" },     // Live Stats
        strong: { bg: "bg-teal-50",     border: "border-teal-200" },     // StatTile teal
        pill:   { bg: "bg-teal-100",    fg: "text-teal-700" },           // Live Stats píldora
        inline: "text-teal-500",
        text:   { strong: "text-teal-700", medium: "text-teal-600", soft: "text-teal-500" },
    },
    success: {
        soft:   { bg: "bg-emerald-50/60", border: "border-emerald-200" }, // Alertas (ok)
        strong: { bg: "bg-emerald-50",    border: "border-emerald-200" }, // StatTile success
        pill:   { bg: "bg-emerald-100",   fg: "text-emerald-700" },
        inline: "text-emerald-500",
        text:   { strong: "text-emerald-700", medium: "text-emerald-600", soft: "text-emerald-500" },
    },
    warning: {
        soft:   { bg: "bg-amber-50/60", border: "border-amber-100" },
        strong: { bg: "bg-amber-50",    border: "border-amber-200" },     // StatTile warning
        pill:   { bg: "bg-amber-100",   fg: "text-amber-700" },
        inline: "text-amber-500",
        text:   { strong: "text-amber-700", medium: "text-amber-600", soft: "text-amber-500" },
    },
    danger: {
        soft:   { bg: "bg-rose-50/60",  border: "border-rose-200" },      // Alertas (alert)
        strong: { bg: "bg-rose-50",     border: "border-rose-300" },      // StatTile danger
        pill:   { bg: "bg-rose-100",    fg: "text-rose-700" },
        inline: "text-rose-500",
        text:   { strong: "text-rose-700", medium: "text-rose-600", soft: "text-rose-500" },
    },
    // ─── tonos nuevos introducidos por MetricCard (no usados por StatTile hoy) ───
    info: {
        soft:   { bg: "bg-blue-50/60",  border: "border-blue-100" },      // Estado de Residentes "Licencia"
        strong: { bg: "bg-blue-50",     border: "border-blue-200" },
        pill:   { bg: "bg-blue-100",    fg: "text-blue-700" },
        inline: "text-blue-500",
        text:   { strong: "text-blue-700", medium: "text-blue-600", soft: "text-blue-500" },
    },
    indigo: {
        // Estético (no semántico). Diferencia visual cuando un strip tiene 4 categorías
        // neutras y se quiere variedad de color. Ver: Estado de Residentes "Activos".
        soft:   { bg: "bg-indigo-50/60", border: "border-indigo-100" },
        strong: { bg: "bg-indigo-50",    border: "border-indigo-200" },
        pill:   { bg: "bg-indigo-100",   fg: "text-indigo-700" },
        inline: "text-indigo-500",
        text:   { strong: "text-indigo-700", medium: "text-indigo-600", soft: "text-indigo-500" },
    },
};
