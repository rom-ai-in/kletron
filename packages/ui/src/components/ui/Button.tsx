import React from "react";
import { cva, type VariantProps } from "class-variance-authority";

// =============================================================================
// CVA VARIANT DEFINITIONS
// =============================================================================

const buttonVariants = cva(
    "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:pointer-events-none disabled:opacity-50",
    {
        variants: {
            variant: {
                primary: "bg-state-selected text-text-primary hover:bg-state-active border border-border-subtle",
                secondary: "bg-bg-elevated text-text-primary border border-border-subtle hover:bg-state-hover",
                ghost: "text-text-secondary hover:text-text-primary hover:bg-state-hover",
                danger: "bg-status-error-bg text-status-error-text border border-status-error-border hover:bg-status-error-bg",
            },
            size: {
                xs: "h-6 px-2 text-[10px]",
                sm: "h-7 px-3 text-[11px]",
                md: "h-9 px-4 text-xs",
                lg: "h-11 px-6 text-sm",
                icon: "h-8 w-8",
            },
        },
        defaultVariants: {
            variant: "secondary",
            size: "md",
        },
    }
);

export { buttonVariants };

// =============================================================================
// BUTTON COMPONENT
// =============================================================================

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
        VariantProps<typeof buttonVariants> {
    loading?: boolean;
    /** Stretch button to fill its container width */
    fullWidth?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className = "", variant, size, loading, fullWidth, children, ...props }, ref) => {
        // For icon-only buttons, require an aria-label if no visible text
        const isIconOnly = size === "icon";
        const resolvedClassName = `${fullWidth ? "w-full" : ""} ${className}`.trim();

        return (
            <button
                ref={ref}
                disabled={props.disabled || loading}
                className={buttonVariants({ variant, size, className: resolvedClassName })}
                {...(isIconOnly && !props["aria-label"] && !props["aria-labelledby"]
                    ? { "aria-label": typeof children === "string" ? children : "Button" }
                    : {})}
                {...props}
            >
                {loading && (
                    <div className="mr-2 h-3 w-3 animate-spin rounded-full border-2 border-border-subtle border-t-text-muted" aria-hidden="true" />
                )}
                {children}
            </button>
        );
    }
);

Button.displayName = "Button";
