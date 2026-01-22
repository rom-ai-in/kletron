import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "primary" | "secondary" | "ghost" | "danger";
    size?: "xs" | "sm" | "md" | "lg" | "icon";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className = "", variant = "secondary", size = "md", children, ...props }, ref) => {
        const baseStyles = "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:pointer-events-none disabled:opacity-50";

        const variants = {
            primary: "bg-state-selected text-text-primary hover:bg-state-active border border-border-strong",
            secondary: "bg-bg-elevated text-text-primary border border-border-subtle hover:bg-state-hover",
            ghost: "text-text-secondary hover:text-text-primary hover:bg-state-hover",
            danger: "bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20",
        };

        const sizes = {
            xs: "h-6 px-2 text-[10px]",
            sm: "h-7 px-3 text-[11px]",
            md: "h-9 px-4 text-xs",
            lg: "h-11 px-6 text-sm",
            icon: "h-8 w-8",
        };

        return (
            <button
                ref={ref}
                className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
                {...props}
            >
                {children}
            </button>
        );
    }
);

Button.displayName = "Button";
