"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "./cn";

/**
 * Modal — primitiva de overlay con a11y batería de Radix.
 *
 * Por qué Radix: focus-trap, Escape, aria-modal, scroll-lock, restore-focus
 * salen automáticos. La envolvemos en el chrome de Zéndity. Los call-sites NO
 * ven Radix — solo nuestra API.
 *
 * Z-index: usamos z-[1100] para quedar POR ENCIMA de los modales legacy
 * (algunos llegan a z-[1000]). Una vez migrados todos, normalizamos.
 *
 * Animaciones: respetan prefers-reduced-motion vía clase Tailwind
 * `motion-reduce:` (la transición se anula si el usuario lo pidió).
 */

export type ModalSize = "sm" | "md" | "lg" | "xl";
export type ModalVariant = "light" | "dark";

export interface ModalProps {
    open: boolean;
    onClose: () => void;
    /** Header — aria-labelledby. */
    title?: React.ReactNode;
    /** Subtítulo opcional — aria-describedby. */
    description?: React.ReactNode;
    /** Slot lead-in en el header (icono o badge). */
    icon?: React.ReactNode;
    children?: React.ReactNode;
    /** Slot para botones de acción debajo del body. */
    footer?: React.ReactNode;
    /** Tamaño max-w. Default 'md'. */
    size?: ModalSize;
    /** Light (default) o dark (slate-800 sobre slate-900 más opaco). */
    variant?: ModalVariant;
    /** Cerrar con Escape y click backdrop. Default true. */
    dismissable?: boolean;
    /** Mostrar botón X arriba derecha. Default true. */
    showCloseButton?: boolean;
    /** Si lo pasas, ese elemento recibe focus al abrir (vs default Radix). */
    initialFocusRef?: React.RefObject<HTMLElement | null>;
    className?: string;
}

const sizeMap: Record<ModalSize, string> = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-xl",
    xl: "max-w-2xl",
};

export function Modal({
    open, onClose,
    title, description, icon, children, footer,
    size = "md",
    variant = "light",
    dismissable = true,
    showCloseButton = true,
    initialFocusRef,
    className,
}: ModalProps) {
    const isDark = variant === "dark";

    const overlayBg = isDark
        ? "bg-slate-950/80"        // dark: backdrop más opaco
        : "bg-slate-900/60";       // light

    const contentSurface = isDark
        ? "bg-slate-800 border border-slate-700 text-slate-100"
        : "bg-white border border-slate-200 text-slate-800";

    const closeBtnStyle = isDark
        ? "text-slate-400 hover:text-white hover:bg-white/10"
        : "text-slate-500 hover:text-slate-800 hover:bg-slate-100";

    // Radix exige Dialog.Title como descendiente de Dialog.Content para a11y
    // (si falta, tira console.error y no pone aria-modal). Si el call-site no
    // pasa title, lo renderizamos sr-only con un fallback genérico.
    const titleText = title ?? "Diálogo";
    const hasVisibleTitle = !!title;

    // Restore-focus al disparador: Radix solo lo hace si el trigger vive en
    // <Dialog.Trigger>. Como nuestra API es controlada con `open`, capturamos
    // el activeElement antes de abrir y se lo damos a Radix vía onCloseAutoFocus.
    const triggerElementRef = React.useRef<HTMLElement | null>(null);
    React.useEffect(() => {
        if (open) {
            const a = document.activeElement;
            if (a && a instanceof HTMLElement && a !== document.body) {
                triggerElementRef.current = a;
            }
        }
    }, [open]);

    return (
        <Dialog.Root
            open={open}
            onOpenChange={(o) => {
                // Si el usuario cierra via Escape o click backdrop, Radix llama
                // onOpenChange(false). Bloqueamos cierre si !dismissable.
                if (!o) {
                    if (dismissable) onClose();
                    // si no es dismissable, no hacemos nada — el modal queda abierto.
                }
            }}
        >
            <Dialog.Portal>
                {/* Backdrop */}
                <Dialog.Overlay
                    className={cn(
                        "fixed inset-0 z-[1100] backdrop-blur-sm",
                        overlayBg,
                        // Animación: fade in/out, respeta reduced-motion
                        "data-[state=open]:animate-in data-[state=closed]:animate-out",
                        "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
                        "motion-reduce:transition-none motion-reduce:animate-none",
                    )}
                />

                {/* Container — Radix setea aria-labelledby / aria-describedby
                    automáticamente vía contexto cuando Dialog.Title /
                    Dialog.Description están presentes; no los pasamos a mano. */}
                <Dialog.Content
                    onOpenAutoFocus={(e) => {
                        if (initialFocusRef?.current) {
                            e.preventDefault();
                            initialFocusRef.current.focus();
                        }
                    }}
                    onCloseAutoFocus={(e) => {
                        if (triggerElementRef.current) {
                            e.preventDefault();
                            triggerElementRef.current.focus();
                        }
                    }}
                    onEscapeKeyDown={(e) => { if (!dismissable) e.preventDefault(); }}
                    onPointerDownOutside={(e) => { if (!dismissable) e.preventDefault(); }}
                    onInteractOutside={(e) => { if (!dismissable) e.preventDefault(); }}
                    className={cn(
                        "fixed left-1/2 top-1/2 z-[1100] -translate-x-1/2 -translate-y-1/2",
                        "w-[calc(100vw-2rem)]", sizeMap[size],
                        "max-h-[90vh] overflow-hidden flex flex-col",
                        "rounded-2xl shadow-2xl",
                        contentSurface,
                        // Animación: fade + scale leve, respeta reduced-motion
                        "data-[state=open]:animate-in data-[state=closed]:animate-out",
                        "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
                        "data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95",
                        "data-[state=open]:duration-200 data-[state=closed]:duration-150",
                        "motion-reduce:transition-none motion-reduce:animate-none",
                        className,
                    )}
                >
                    {/* Dialog.Title SIEMPRE va presente (sr-only si no se pasa title) */}
                    {!hasVisibleTitle && (
                        <Dialog.Title className="sr-only">{titleText}</Dialog.Title>
                    )}

                    {(hasVisibleTitle || icon || showCloseButton) && (
                        <div className={cn(
                            "flex items-start gap-3 px-6 py-5 border-b",
                            isDark ? "border-slate-700" : "border-slate-100",
                        )}>
                            {icon && <div className="flex-shrink-0 mt-0.5">{icon}</div>}
                            <div className="flex-1 min-w-0">
                                {hasVisibleTitle && (
                                    <Dialog.Title
                                        className={cn(
                                            "text-lg font-bold leading-tight",
                                            isDark ? "text-white" : "text-slate-900",
                                        )}
                                    >
                                        {titleText}
                                    </Dialog.Title>
                                )}
                                {description && (
                                    <Dialog.Description
                                        className={cn(
                                            "mt-1 text-sm",
                                            isDark ? "text-slate-400" : "text-slate-500",
                                        )}
                                    >
                                        {description}
                                    </Dialog.Description>
                                )}
                            </div>
                            {showCloseButton && (
                                <Dialog.Close
                                    asChild
                                    onClick={(e) => {
                                        // Si no es dismissable, también suprimimos el botón X.
                                        // Pero showCloseButton=true + dismissable=false sería
                                        // raro — lo dejamos coherente.
                                        if (!dismissable) e.preventDefault();
                                    }}
                                >
                                    <button
                                        type="button"
                                        aria-label="Cerrar"
                                        className={cn(
                                            "flex items-center justify-center w-8 h-8 rounded-lg transition-colors",
                                            closeBtnStyle,
                                            !dismissable && "opacity-30 cursor-not-allowed",
                                        )}
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </Dialog.Close>
                            )}
                        </div>
                    )}

                    <div className="flex-1 overflow-y-auto px-6 py-5">
                        {children}
                    </div>

                    {footer && (
                        <div className={cn(
                            "flex items-center justify-end gap-3 px-6 py-4 border-t",
                            isDark ? "border-slate-700 bg-slate-900/50" : "border-slate-100 bg-slate-50/60",
                        )}>
                            {footer}
                        </div>
                    )}
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}

export default Modal;
