import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "./cn";

/**
 * Button — primitive del design system Zéndity.
 *
 * Acento: teal fijo del producto (#0F6B78). NO usa el token --brand-primary
 * (que es re-tematizable por inquilino). Zéndity se ve igual en cualquier
 * tenant — el chrome del producto es estable; el theming de inquilino vive
 * en superficies de cliente (portal familiar, login de sede), no aquí.
 *
 * Variantes:
 *   - primary  → bg teal #0F6B78 + hover #0B545F + texto blanco
 *   - secondary→ bg blanco + borde slate-300 + texto slate-700 + hover slate-100
 *   - danger   → bg #D9534F (critical-red) + texto blanco
 *   - ghost    → transparente + texto slate-600 + hover slate-100
 *
 * Tamaños: sm (h32, 13px), md (h40, 14px — default), lg (h48, 15px).
 * Radio: 12px (rounded-xl). Peso: 600. Transición: 160ms.
 *
 * Estados: disabled (opacity .45, sin hover); loading (spinner + disabled).
 *
 * Polimorfismo: por defecto <button>. Si pasas `asChild` usa el child directo
 * con las clases — útil para envolver Link de Next.js sin perder estilos.
 */
export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

const variantClasses: Record<ButtonVariant, string> = {
    primary: "bg-[var(--color-zendity-teal)] text-white hover:bg-[var(--color-teal-hover)]",
    secondary: "bg-white border border-slate-300 text-slate-700 hover:bg-slate-100",
    danger: "bg-[var(--color-critical-red)] text-white hover:opacity-90",
    ghost: "bg-transparent text-slate-600 hover:bg-slate-100",
};

const sizeClasses: Record<ButtonSize, string> = {
    sm: "h-8 px-3.5 text-[13px] gap-1.5",   // 32px alto, 14px horizontal
    md: "h-10 px-4 text-sm gap-2",           // 40px alto, 18px-ish horizontal (px-4 = 16, conservador)
    lg: "h-12 px-6 text-[15px] gap-2.5",     // 48px alto, 24px horizontal
};

export interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "disabled"> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    /** Muestra spinner + deshabilita. */
    loading?: boolean;
    /** Deshabilita visual y funcionalmente (opacity .45, cursor not-allowed). */
    disabled?: boolean;
    /** Icono Lucide a la izquierda del label. */
    leftIcon?: React.ReactNode;
    /** Icono Lucide a la derecha del label. */
    rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
    {
        variant = "primary",
        size = "md",
        loading = false,
        disabled = false,
        leftIcon,
        rightIcon,
        className,
        children,
        type = "button",
        ...rest
    },
    ref,
) {
    const isDisabled = disabled || loading;

    return (
        <button
            ref={ref}
            type={type}
            disabled={isDisabled}
            className={cn(
                // base
                "inline-flex items-center justify-center rounded-xl font-semibold whitespace-nowrap",
                "transition-colors duration-150 ease-out",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                "focus-visible:ring-[var(--color-zendity-teal)] focus-visible:ring-offset-white",
                "disabled:opacity-45 disabled:cursor-not-allowed disabled:pointer-events-none",
                // variant + size
                variantClasses[variant],
                sizeClasses[size],
                className,
            )}
            {...rest}
        >
            {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
            ) : (
                leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>
            )}
            {children}
            {!loading && rightIcon && <span className="inline-flex shrink-0">{rightIcon}</span>}
        </button>
    );
});

export default Button;
