"use client";

import { useState } from "react";
import { Button } from "@kletron/ui/components/design-system";
import { AuditContext } from "@kletron/shared/documentContext";

type AuditContextFormProps = {
    initialContext: AuditContext;
    onSave: (context: AuditContext) => void;
    onCancel: () => void;
};

export function AuditContextForm({ initialContext, onSave, onCancel }: AuditContextFormProps) {
    const [context, setContext] = useState<AuditContext>(initialContext || {});

    const handleChange = (key: keyof AuditContext, value: any) => {
        setContext(prev => ({ ...prev, [key]: value }));
    };

    const handleListChange = (key: keyof AuditContext, value: string) => {
        const list = value.split('\n').filter(line => line.trim());
        setContext(prev => ({ ...prev, [key]: list }));
    };

    return (
        <div className="space-y-4 bg-bg-surface p-4 rounded-lg border border-border-subtle">
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="text-xs font-semibold text-text-secondary uppercase">Target Audience</label>
                    <input
                        type="text"
                        className="w-full mt-1 p-2 rounded bg-bg-elevated border border-border-subtle text-sm text-text-primary"
                        value={context.targetAudience || ""}
                        onChange={(e) => handleChange("targetAudience", e.target.value)}
                        placeholder="E.g. founders, platform engineers, finance ops"
                    />
                </div>
                <div>
                    <label className="text-xs font-semibold text-text-secondary uppercase">Time Horizon</label>
                    <input
                        type="text"
                        className="w-full mt-1 p-2 rounded bg-bg-elevated border border-border-subtle text-sm text-text-primary"
                        value={context.timeHorizon || ""}
                        onChange={(e) => handleChange("timeHorizon", e.target.value)}
                        placeholder="E.g. this week, Q3 launch, next 30 days"
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="text-xs font-semibold text-text-secondary uppercase">Quality Level</label>
                    <select
                        className="w-full mt-1 p-2 rounded bg-bg-elevated border border-border-subtle text-sm text-text-primary"
                        value={context.qualityLevel || "standard"}
                        onChange={(e) => handleChange("qualityLevel", e.target.value)}
                    >
                        <option value="draft">Draft</option>
                        <option value="standard">Standard</option>
                        <option value="polished">Polished</option>
                    </select>
                </div>
                <div>
                    <label className="text-xs font-semibold text-text-secondary uppercase">Tone</label>
                    <input
                        type="text"
                        className="w-full mt-1 p-2 rounded bg-bg-elevated border border-border-subtle text-sm text-text-primary"
                        value={context.tone || ""}
                        onChange={(e) => handleChange("tone", e.target.value)}
                        placeholder="E.g. direct, executive, analytical, calm"
                    />
                </div>
            </div>

            <div>
                <label className="text-xs font-semibold text-text-secondary uppercase">Mission</label>
                <textarea
                    className="w-full mt-1 p-2 rounded bg-bg-elevated border border-border-subtle text-sm text-text-primary min-h-[60px]"
                    value={context.mission || ""}
                    onChange={(e) => handleChange("mission", e.target.value)}
                    placeholder="E.g. Build the world's best AI assistant..."
                />
            </div>

            <div>
                <label className="text-xs font-semibold text-text-secondary uppercase">Primary Goal</label>
                <input
                    type="text"
                    className="w-full mt-1 p-2 rounded bg-bg-elevated border border-border-subtle text-sm text-text-primary"
                    value={context.primaryGoal || ""}
                    onChange={(e) => handleChange("primaryGoal", e.target.value)}
                    placeholder="E.g. Launch beta by Q3"
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="text-xs font-semibold text-text-secondary uppercase">Key Objectives (one per line)</label>
                    <textarea
                        className="w-full mt-1 p-2 rounded bg-bg-elevated border border-border-subtle text-sm text-text-primary min-h-[100px]"
                        value={context.keyObjectives?.join('\n') || ""}
                        onChange={(e) => handleListChange("keyObjectives", e.target.value)}
                        placeholder="- Implement auth&#10;- Setup DB"
                    />
                </div>
                <div>
                    <label className="text-xs font-semibold text-text-secondary uppercase">Non-goals (one per line)</label>
                    <textarea
                        className="w-full mt-1 p-2 rounded bg-bg-elevated border border-border-subtle text-sm text-text-primary min-h-[100px]"
                        value={context.nonGoals?.join('\n') || ""}
                        onChange={(e) => handleListChange("nonGoals", e.target.value)}
                        placeholder="- Native mobile app&#10;- Full rebrand"
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="text-xs font-semibold text-text-secondary uppercase">Constraints (one per line)</label>
                    <textarea
                        className="w-full mt-1 p-2 rounded bg-bg-elevated border border-border-subtle text-sm text-text-primary min-h-[100px]"
                        value={context.constraints?.join('\n') || ""}
                        onChange={(e) => handleListChange("constraints", e.target.value)}
                        placeholder="- No external APIs&#10;- TypeScript only"
                    />
                </div>
                <div>
                    <label className="text-xs font-semibold text-text-secondary uppercase">Languages (one per line)</label>
                    <textarea
                        className="w-full mt-1 p-2 rounded bg-bg-elevated border border-border-subtle text-sm text-text-primary min-h-[100px]"
                        value={context.languages?.join('\n') || ""}
                        onChange={(e) => handleListChange("languages", e.target.value)}
                        placeholder="French&#10;English"
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="text-xs font-semibold text-text-secondary uppercase">Frameworks / Stacks (one per line)</label>
                    <textarea
                        className="w-full mt-1 p-2 rounded bg-bg-elevated border border-border-subtle text-sm text-text-primary min-h-[100px]"
                        value={context.frameworks?.join('\n') || ""}
                        onChange={(e) => handleListChange("frameworks", e.target.value)}
                        placeholder="Next.js&#10;Stripe&#10;MongoDB"
                    />
                </div>
                <div>
                    <label className="text-xs font-semibold text-text-secondary uppercase">Hotspots (one per line)</label>
                    <textarea
                        className="w-full mt-1 p-2 rounded bg-bg-elevated border border-border-subtle text-sm text-text-primary min-h-[100px]"
                        value={context.hotspots?.join('\n') || ""}
                        onChange={(e) => handleListChange("hotspots", e.target.value)}
                        placeholder="Billing flow&#10;Sentry triage&#10;Auth"
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="text-xs font-semibold text-text-secondary uppercase">Startup Phase (Legacy)</label>
                    <select
                        className="w-full mt-1 p-2 rounded bg-bg-elevated border border-border-subtle text-sm text-text-primary"
                        value={context.startupPhase || ""}
                        onChange={(e) => handleChange("startupPhase", e.target.value)}
                    >
                        <option value="">Select Phase...</option>
                        <option value="Discovery">Discovery / Prototype</option>
                        <option value="MVP Build">MVP Build</option>
                        <option value="MVP Launch">MVP Launch</option>
                        <option value="Scale-up">Scale-up</option>
                    </select>
                </div>
                <div>
                    <label className="text-xs font-semibold text-text-secondary uppercase">Risk Tolerance (Legacy)</label>
                    <select
                        className="w-full mt-1 p-2 rounded bg-bg-elevated border border-border-subtle text-sm text-text-primary"
                        value={context.riskTolerance || "medium"}
                        onChange={(e) => handleChange("riskTolerance", e.target.value)}
                    >
                        <option value="low">Low (Conservative)</option>
                        <option value="medium">Medium</option>
                        <option value="high">High (Move Fast)</option>
                    </select>
                </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-border-subtle">
                {/* Cancel button is hidden if onCancel is empty/noop, but useful for modal reuse */}
                <Button variant="secondary" onClick={onCancel}>Cancel</Button>
                <Button onClick={() => onSave(context)}>Save Context</Button>
            </div>
        </div>
    );
}
