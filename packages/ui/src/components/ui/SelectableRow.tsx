import React from "react";

interface SelectableRowProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    isActive?: boolean;
    label: React.ReactNode;
    subLabel?: React.ReactNode;
    rightElement?: React.ReactNode;
}

export function SelectableRow({
    isActive,
    label,
    subLabel,
    rightElement,
    className = "",
    ...props
}: SelectableRowProps) {
    return (
        <button
            type="button"
            className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left transition ${isActive
                    ? "bg-state-selected text-text-primary"
                    : "text-text-secondary hover:bg-state-hover hover:text-text-primary"
                } ${className}`}
            {...props}
        >
            <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium leading-none">{label}</div>
                {subLabel && <div className="mt-1 truncate text-[10px] text-text-muted">{subLabel}</div>}
            </div>
            {rightElement && <div className="ml-2 flex-shrink-0">{rightElement}</div>}
        </button>
    );
}
