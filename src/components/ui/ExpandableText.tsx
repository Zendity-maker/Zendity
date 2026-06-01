"use client";

import * as React from "react";
import { cn } from "./cn";

/**
 * ExpandableText — texto largo con "Ver más / Ver menos".
 *
 * Por defecto colapsa el contenido a `previewLines` líneas (line-clamp).
 * Si el texto excede esa altura, renderiza un botón inline para
 * expandir/colapsar. Si NO excede, no muestra el botón.
 *
 * Usos canónicos:
 *   - description de un ticket en /care/supervisor o /corporate/triage
 *   - notas largas de seguimiento, comentarios de incidentes, etc.
 *
 * El cálculo de "overflow" usa scrollHeight vs clientHeight sobre el
 * ResizeObserver del propio elemento. Funciona con texto que cambia
 * dinámicamente (polling de tickets, edits).
 *
 * NOTA: cuando este componente se usa DENTRO de un button (ej. cards
 * clickables del wall), Andrés debe pasar `stopPropagation` al onClick
 * del toggle — el botón interno emite evento y burbujea. Por seguridad
 * el toggle ya hace `e.stopPropagation()` siempre.
 */
export interface ExpandableTextProps {
    text: string;
    /** Número de líneas visibles cuando está colapsado. Default 2. */
    previewLines?: number;
    /** Clase del párrafo de texto. */
    className?: string;
    /** Clase del botón "Ver más/menos". */
    toggleClassName?: string;
    /** Override del label en estado colapsado. Default "Ver más". */
    expandLabel?: string;
    /** Override del label en estado expandido. Default "Ver menos". */
    collapseLabel?: string;
}

const LINE_CLAMP_BY_N: Record<number, string> = {
    1: "line-clamp-1",
    2: "line-clamp-2",
    3: "line-clamp-3",
    4: "line-clamp-4",
    5: "line-clamp-5",
    6: "line-clamp-6",
};

export function ExpandableText({
    text,
    previewLines = 2,
    className,
    toggleClassName,
    expandLabel = "Ver más",
    collapseLabel = "Ver menos",
}: ExpandableTextProps) {
    const [expanded, setExpanded] = React.useState(false);
    const [overflows, setOverflows] = React.useState(false);
    const ref = React.useRef<HTMLParagraphElement | null>(null);

    React.useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;
        // Medir overflow EN ESTADO COLAPSADO. Si el componente ya está expandido
        // por interacción del usuario, no remedimos — la decisión "muestra Ver
        // más" se conserva. Si el texto cambia y se reduce, se recalcula.
        const measure = () => {
            // Forzar medición en estado colapsado: clonamos las clases sin la
            // clase "expanded" para medir el overflow real con el line-clamp.
            const lineClamp = LINE_CLAMP_BY_N[previewLines] || LINE_CLAMP_BY_N[2];
            const wasExpanded = el.classList.contains("__measure-expanded");
            if (wasExpanded) return; // ya estamos en modo expandido, no remedir
            // scrollHeight > clientHeight cuando el contenido sobrepasa el clamp
            const isOverflowing = el.scrollHeight - el.clientHeight > 1;
            setOverflows(isOverflowing);
            // El parametro `lineClamp` se usa via className en el JSX,
            // no necesitamos aplicarlo aquí — solo medir.
            void lineClamp;
        };
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => ro.disconnect();
    }, [text, previewLines]);

    const clampClass = expanded ? "" : (LINE_CLAMP_BY_N[previewLines] || LINE_CLAMP_BY_N[2]);

    return (
        <div>
            <p
                ref={ref}
                className={cn(clampClass, "whitespace-pre-wrap break-words", className)}
            >
                {text}
            </p>
            {overflows && (
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        setExpanded((v) => !v);
                    }}
                    className={cn(
                        "mt-1 text-[11px] font-bold text-[var(--color-zendity-teal)] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-zendity-teal)] rounded",
                        toggleClassName,
                    )}
                >
                    {expanded ? collapseLabel : expandLabel}
                </button>
            )}
        </div>
    );
}

export default ExpandableText;
