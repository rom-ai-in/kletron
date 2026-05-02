"use client";

import type { ThreadApprovalMode } from "@kletron/shared/threadApprovalTypes";
import { Selector } from "../ui/Selector";

const OPTIONS: { id: ThreadApprovalMode; label: string; sub?: string }[] = [
    { id: "inherit", label: "Workspace defaults", sub: "Use org tool policy" },
    { id: "confirm_everything", label: "Confirm each tool", sub: "Ask before running tools" },
    { id: "full_auto_thread", label: "Full auto (this chat)", sub: "Runs tools without prompts" },
];

export type ThreadApprovalModeSelectorProps = {
    value: ThreadApprovalMode;
    onSelect: (mode: ThreadApprovalMode) => void;
    disabled?: boolean;
    disabledReason?: string;
};

export function ThreadApprovalModeSelector({
    value,
    onSelect,
    disabled,
    disabledReason,
}: ThreadApprovalModeSelectorProps) {
    return (
        <div title={disabled ? disabledReason : undefined} className={disabled ? "opacity-60 pointer-events-none" : undefined}>
            <Selector
                label="Approvals"
                value={value}
                options={OPTIONS}
                onSelect={(id) => onSelect(id as ThreadApprovalMode)}
                size="sm"
                direction="up"
            />
        </div>
    );
}
