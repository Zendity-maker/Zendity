"use client";

import { useState, useRef, useEffect } from "react";
import { Info } from "lucide-react";

interface InfoTooltipProps {
    text: string;
    position?: "top" | "right" | "left";
}

export default function InfoTooltip({ text, position = "top" }: InfoTooltipProps) {
    const [visible, setVisible] = useState(false);
    const ref = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        if (!visible) return;
        const handleOutside = (e: MouseEvent | TouchEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setVisible(false);
            }
        };
        document.addEventListener("mousedown", handleOutside);
        document.addEventListener("touchstart", handleOutside);
        return () => {
            document.removeEventListener("mousedown", handleOutside);
            document.removeEventListener("touchstart", handleOutside);
        };
    }, [visible]);

    const positionClasses =
        position === "right"
            ? "left-full top-1/2 -translate-y-1/2 ml-2"
            : position === "left"
              ? "right-full top-1/2 -translate-y-1/2 mr-2"
              : "bottom-full left-1/2 -translate-x-1/2 mb-2";

    return (
        <span ref={ref} className="relative inline-flex items-center align-middle">
            <Info
                className="w-4 h-4 text-slate-400 cursor-help shrink-0"
                onMouseEnter={() => setVisible(true)}
                onMouseLeave={() => setVisible(false)}
                onClick={() => setVisible((v) => !v)}
            />
            <span
                className={`absolute ${positionClasses} z-50 max-w-xs px-3 py-2.5 bg-slate-800 text-white text-xs font-medium leading-relaxed rounded-lg shadow-lg pointer-events-none transition-opacity duration-100 whitespace-normal ${visible ? "opacity-100" : "opacity-0"}`}
            >
                {text}
            </span>
        </span>
    );
}
