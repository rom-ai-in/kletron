"use client";

import { Panel } from "@/src/components/ui/Panel";
import { Layers } from "lucide-react";

export default function CampaignsPage() {
    return (
        <div className="flex h-full items-center justify-center p-8 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="max-w-md space-y-4">
                <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-xl bg-bg-elevated text-text-muted">
                    <Layers className="h-6 w-6" />
                </div>
                <div className="space-y-2">
                    <h2 className="text-lg font-semibold text-text-primary">No Campaign Selected</h2>
                    <p className="text-sm text-text-muted">
                        Select a campaign from the sidebar to view details, execution history, and configuration.
                    </p>
                </div>
                <div className="text-xs text-text-muted/50 pt-4">
                    Press <kbd className="font-mono bg-bg-elevated px-1 py-0.5 rounded border border-border-subtle">Cmd+K</kbd> to search globally
                </div>
            </div>
        </div>
    );
}
