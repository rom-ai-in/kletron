"use client";

import { Panel } from "@/src/components/design-system";
import type { Finding, AuditStageConfig } from "../services/chainTypes";

interface LLMComparisonTableProps {
    stages: AuditStageConfig[];
    findings: Finding[];
}

export function LLMComparisonTable({ stages, findings }: LLMComparisonTableProps) {
    // Unique files flagged
    const files = Array.from(new Set(findings.map(f => f.file))).sort();

    // Map stage visibility for findings
    const getStageResult = (file: string, stageId: string) => {
        const stageFindings = findings.filter(f => f.file === file && f.stageId === stageId);
        if (stageFindings.length === 0) return null;

        const highestSeverity = stageFindings.some(f => f.type === "BLOQUANT")
            ? "BLOQUANT"
            : stageFindings.some(f => f.type === "WARNING")
                ? "WARNING"
                : "INFO";

        return {
            count: stageFindings.length,
            severity: highestSeverity
        };
    };

    if (files.length === 0) return null;

    return (
        <Panel className="overflow-hidden">
            <div className="border-b border-border-subtle bg-bg-elevated px-4 py-2">
                <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider">
                    LLM Finding Consensus Matrix
                </h3>
            </div>

            <div className="overflow-x-auto scrollbar-elegant">
                <table className="w-full border-collapse text-[10px]">
                    <thead>
                        <tr className="border-b border-border-subtle bg-bg-surface">
                            <th className="px-4 py-2 text-left font-medium text-text-muted uppercase">Target File</th>
                            {stages.map(stage => (
                                <th key={stage.id} className="px-4 py-2 text-center font-medium text-text-muted uppercase min-w-[100px]">
                                    <div>{stage.name}</div>
                                    <div className="text-[8px] opacity-70">({stage.llmProvider})</div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {files.slice(0, 20).map((file, idx) => (
                            <tr key={idx} className="border-b border-border-subtle hover:bg-state-hover transition-colors">
                                <td className="px-4 py-2 font-mono text-text-primary truncate max-w-[300px]" title={file}>
                                    {file.split('/').pop()}
                                    <div className="text-[8px] text-text-muted mt-0.5 truncate">{file}</div>
                                </td>
                                {stages.map(stage => {
                                    const result = getStageResult(file, stage.id);
                                    let cellClass = "bg-transparent";
                                    let dotClass = "bg-text-muted/20";

                                    if (result?.severity === "BLOQUANT") {
                                        cellClass = "bg-rose-500/5";
                                        dotClass = "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]";
                                    } else if (result?.severity === "WARNING") {
                                        cellClass = "bg-amber-500/5";
                                        dotClass = "bg-amber-500";
                                    } else if (result?.severity === "INFO") {
                                        cellClass = "bg-zinc-500/5";
                                        dotClass = "bg-zinc-500";
                                    }

                                    return (
                                        <td key={stage.id} className={`px-4 py-2 text-center transition-colors ${cellClass}`}>
                                            <div className="flex flex-col items-center justify-center gap-1">
                                                <div className={`h-2.5 w-2.5 rounded-full ${dotClass}`} />
                                                {result && <span className="text-[8px] font-bold">{result.count}</span>}
                                            </div>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
                {files.length > 20 && (
                    <div className="px-4 py-2 text-center text-[10px] text-text-muted bg-bg-elevated/30">
                        Showing top 20 of {files.length} flagged files.
                    </div>
                )}
            </div>
        </Panel>
    );
}
