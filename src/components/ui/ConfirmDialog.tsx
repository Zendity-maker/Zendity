"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { Modal, type ModalVariant } from "./Modal";
import { cn } from "./cn";

/**
 * ConfirmDialog — compone Modal size="sm" con título + mensaje + 2 botones.
 *
 * Reemplaza `window.confirm()` con un dialog estilizado y a11y completa
 * (vía Modal → Radix). Soporta tone primary/danger; en danger el foco
 * inicial cae en CANCELAR (defensive default), no en confirmar.
 *
 * onConfirm async:
 *   - pending → loading (botones disabled, spinner en confirm, Escape +
 *     click backdrop bloqueados).
 *   - throw → para loading y deja el modal ABIERTO. El error display lo
 *     muestra el call-site (toast/banner).
 *   - resolve → loading queda en false. El cierre lo decide el call-site
 *     vía su propio estado `open` (pattern: setLoading(true) → await onConfirm
 *     → setLoading(false) + setOpen(false)).
 */

export type ConfirmTone = "primary" | "danger";

export interface ConfirmDialogProps {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void | Promise<void>;
    title: string;
    message: React.ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    tone?: ConfirmTone;
    /** Forward el variant del Modal (light o dark). Default light. */
    variant?: ModalVariant;
    /** Si lo controlas tú; si no, el componente lo maneja interno con onConfirm async. */
    loading?: boolean;
}

export function ConfirmDialog({
    open, onClose, onConfirm,
    title, message,
    confirmLabel = "Confirmar",
    cancelLabel = "Cancelar",
    tone = "primary",
    variant = "light",
    loading: controlledLoading,
}: ConfirmDialogProps) {
    const [internalLoading, setInternalLoading] = React.useState(false);
    const loading = controlledLoading ?? internalLoading;

    const cancelBtnRef = React.useRef<HTMLButtonElement>(null);
    const confirmBtnRef = React.useRef<HTMLButtonElement>(null);

    // Si tone es 'danger', el foco inicial cae en Cancelar (defensive).
    // Si es 'primary', en Confirmar.
    const initialFocusRef = tone === "danger" ? cancelBtnRef : confirmBtnRef;

    const handleConfirm = async () => {
        if (loading) return;
        try {
            if (controlledLoading === undefined) setInternalLoading(true);
            await onConfirm();
        } catch {
            // Para loading y deja el modal abierto — el call-site muestra el error.
            if (controlledLoading === undefined) setInternalLoading(false);
            return;
        }
        if (controlledLoading === undefined) setInternalLoading(false);
        // Cierre lo decide el call-site (no llamamos onClose aquí).
    };

    const isDark = variant === "dark";

    const confirmStyles = tone === "danger"
        ? "bg-rose-600 hover:bg-rose-700 text-white focus-visible:ring-rose-400"
        : "bg-teal-600 hover:bg-teal-700 text-white focus-visible:ring-teal-400";

    const cancelStyles = isDark
        ? "bg-white/10 hover:bg-white/15 text-slate-100 focus-visible:ring-white/40"
        : "bg-slate-100 hover:bg-slate-200 text-slate-700 focus-visible:ring-slate-400";

    const baseBtn = "px-5 py-2.5 rounded-lg font-bold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";

    return (
        <Modal
            open={open}
            onClose={onClose}
            title={title}
            size="sm"
            variant={variant}
            dismissable={!loading}
            showCloseButton={!loading}
            initialFocusRef={initialFocusRef as React.RefObject<HTMLElement | null>}
            footer={
                <>
                    <button
                        ref={cancelBtnRef}
                        type="button"
                        onClick={onClose}
                        disabled={loading}
                        className={cn(baseBtn, cancelStyles)}
                    >
                        {cancelLabel}
                    </button>
                    <button
                        ref={confirmBtnRef}
                        type="button"
                        onClick={handleConfirm}
                        disabled={loading}
                        className={cn(baseBtn, confirmStyles, "inline-flex items-center gap-2")}
                    >
                        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                        {confirmLabel}
                    </button>
                </>
            }
        >
            <div className={cn("text-sm leading-relaxed", isDark ? "text-slate-300" : "text-slate-600")}>
                {message}
            </div>
        </Modal>
    );
}

export default ConfirmDialog;
