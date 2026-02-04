"use client";

import { Panel } from "@/src/components/design-system";
import type { Finding } from "../services/chainTypes";

interface HotspotHeatmapProps {
    findings: Finding[];
}

export function HotspotHeatmap({ findings }: HotspotHeatmapProps) {
    // Group findings by file
    const fileStats = findings.reduce((acc, f) => {
        if (!acc[f.file]) {
            acc[f.file] = {
                file: f.file,
                count: 0,
                bloquant: 0,
                warning: 0,
                info: 0,
                stages: new Set<string>(),
            };
        }
        acc[f.file].count++;
        acc[f.file].stages.add(f.stageId);
        if (f.type === "BLOQUANT") acc[f.file].bloquant++;
        else if (f.type === "WARNING") acc[f.file].warning++;
        else acc[f.file].info++;
        return acc;
    }, {} as Record<string, { file: string; count: number; bloquant: number; warning: number; info: number; stages: Set<string> }>);

    const sortedHotspots = Object.values(fileStats)
        .sort((a, b) => b.count - a.count || b.bloquant - a.bloquant)
        .slice(0, 10);

    if (findings.length === 0) return null;

    return (
        <Panel className="space-y-4 p-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-text-primary">Top 10 Code Hotspots</h3>
                <span className="text-[10px] text-text-muted uppercase">Ranked by issue frequency</span>
            </div>

            <div className="space-y-2">
                {sortedHotspots.map((spot, idx) => {
                    const intensity = Math.min(spot.count * 10, 100);
                    const severityColor = spot.bloquant > 0
                        ? "bg-rose-500/20 text-rose-400 border-rose-500/30"
                        : spot.warning > 0
                            ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                            : "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";

                    return (
                        <div key={idx} className="group relative overflow-hidden rounded border border-border-subtle bg-bg-surface p-2 transition hover:border-border-strong">
                            {/* Intensity background indicator */}
                            <div
                                className="absolute inset-y-0 left-0 bg-state-selected opacity-10 transition-all group-hover:opacity-20"
                                style={{ width: `${intensity}%` }}
                            />

                            <div className="relative flex items-center justify-between gap-4">
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-mono text-text-muted">#{idx + 1}</span>
                                        <p className="truncate text-xs font-medium text-text-primary">{spot.file}</p>
                                    </div>
                                    <div className="mt-1 flex items-center gap-3">
                                        <span className="text-[10px] text-text-muted">
                                            {spot.stages.size} stages flagged this file
                                        </span>
                                        <div className="flex gap-1">
                                            {spot.bloquant > 0 && <span className="text-[9px] text-rose-400">{spot.bloquant}B</span>}
                                            {spot.warning > 0 && <span className="text-[9px] text-amber-400">{spot.warning}W</span>}
                                            {spot.info > 0 && <span className="text-[9px] text-zinc-400">{spot.info}I</span>}
                                        </div>
                                    </div>
                                </div>

                                <div className={`flex h-8 w-12 items-center justify-center rounded border text-xs font-bold ${severityColor}`}>
                                    {spot.count}
                                </div>
                            </div>
                        </div>
                    );
                })}

                {sortedHotspots.length === 0 && (
                    <div className="py-8 text-center text-xs text-text-muted">
                        No significant hotspots detected.
                    </div>
                )}
            </div>
        </Panel>
    );
}
