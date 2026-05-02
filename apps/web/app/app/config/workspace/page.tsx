"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { ThreadApprovalMode } from "@kletron/shared/threadApprovalTypes";
import { parseThreadApprovalMode, THREAD_APPROVAL_MODES } from "@kletron/shared/threadApprovalTypes";
import {
    ArrowLeft,
    ArrowRight,
    Folder,
    ListFilter,
    MessageSquare,
    Plus,
    ShieldCheck,
    SlidersHorizontal,
    Terminal,
    Trash2,
    X,
} from "lucide-react";
import Link from "next/link";
import { Panel, Button } from "@kletron/ui/components/design-system";
import { useWorkspace } from "@kletron/ui/context/WorkspaceContext";
import { InlineAddWorkspaceForm } from "./InlineAddWorkspaceForm";

type ToolOverrideMode = "always_approve" | "always_require" | "default";

type ToolOverrideRow = { id: string; tool: string; mode: ToolOverrideMode };

export default function WorkspaceConfigPage() {
    const {
        workspaces,
        activeWorkspaceId,
        loading,
        error,
        switchWorkspace,
        refreshWorkspaces,
        deleteWorkspace,
    } = useWorkspace();

    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

    const [toolApprovalLoading, setToolApprovalLoading] = useState(true);
    const [toolApprovalSaving, setToolApprovalSaving] = useState(false);
    const [neverToolsInput, setNeverToolsInput] = useState("");
    const [readonlySourcesInput, setReadonlySourcesInput] = useState("");
    const [autoApproveSafeBash, setAutoApproveSafeBash] = useState(true);
    const [defaultThreadMode, setDefaultThreadMode] = useState<ThreadApprovalMode>("inherit");
    const [overrideRows, setOverrideRows] = useState<ToolOverrideRow[]>([]);
    const overrideRowId = useRef(0);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch("/api/config/tool-approval");
                if (!res.ok) {
                    if (!cancelled) {
                        setOverrideRows([{ id: `o-${++overrideRowId.current}`, tool: "", mode: "default" }]);
                    }
                    return;
                }
                const cfg = (await res.json()) as {
                    neverAutoApproveTools?: string[];
                    autoApproveSafeBash?: boolean;
                    defaultThreadApprovalMode?: ThreadApprovalMode;
                    autoApproveReadonlySources?: string[];
                    toolOverrides?: Record<string, ToolOverrideMode>;
                };
                if (cancelled) return;
                setNeverToolsInput((cfg.neverAutoApproveTools ?? []).join(", "));
                setReadonlySourcesInput((cfg.autoApproveReadonlySources ?? ["agent", "automation"]).join(", "));
                setAutoApproveSafeBash(cfg.autoApproveSafeBash !== false);
                setDefaultThreadMode(parseThreadApprovalMode(cfg.defaultThreadApprovalMode));
                const o = cfg.toolOverrides ?? {};
                const keys = Object.keys(o);
                if (keys.length === 0) {
                    setOverrideRows([{ id: `o-${++overrideRowId.current}`, tool: "", mode: "default" }]);
                } else {
                    setOverrideRows(
                        keys.map((k) => ({
                            id: `o-${++overrideRowId.current}`,
                            tool: k,
                            mode: o[k] ?? "default",
                        })),
                    );
                }
            } catch {
                if (!cancelled) {
                    setOverrideRows([{ id: `o-${++overrideRowId.current}`, tool: "", mode: "default" }]);
                }
            } finally {
                if (!cancelled) setToolApprovalLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const saveToolApproval = useCallback(async () => {
        setToolApprovalSaving(true);
        setMessage(null);
        try {
            const neverAutoApproveTools = neverToolsInput
                .split(",")
                .map((s) => s.trim().toLowerCase())
                .filter(Boolean);
            const autoApproveReadonlySources = readonlySourcesInput
                .split(",")
                .map((s) => s.trim().toLowerCase())
                .filter(Boolean);
            const toolOverrides = Object.fromEntries(
                overrideRows
                    .map((r) => [r.tool.trim().toLowerCase(), r.mode] as const)
                    .filter(([t]) => t.length > 0),
            ) as Record<string, ToolOverrideMode>;
            const res = await fetch("/api/config/tool-approval", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    neverAutoApproveTools,
                    autoApproveReadonlySources,
                    autoApproveSafeBash,
                    defaultThreadApprovalMode: defaultThreadMode,
                    replaceToolOverrides: true,
                    toolOverrides,
                }),
            });
            if (!res.ok) {
                const j = (await res.json().catch(() => ({}))) as { error?: string };
                throw new Error(j.error || `Save failed (${res.status})`);
            }
            setMessage({ text: "Tool approval settings saved.", type: "success" });
        } catch (e: any) {
            setMessage({ text: e?.message || "Failed to save tool approval settings", type: "error" });
        } finally {
            setToolApprovalSaving(false);
        }
    }, [neverToolsInput, readonlySourcesInput, autoApproveSafeBash, defaultThreadMode, overrideRows]);

    const defaultModeHint: Record<ThreadApprovalMode, string> = {
        inherit:
            "New threads follow the server-wide rules below. You can still pick a different mode for each chat in Agent.",
        confirm_everything:
            "New threads will ask before running any tool. Change anytime in Agent or here.",
        full_auto_thread:
            "New threads start in full auto for that conversation. Admin tools and your blocklist below still need approval.",
    };

    const handleWorkspaceCreated = useCallback(async (workspace: { id: string; name: string; rootPath: string }) => {
        await refreshWorkspaces();
        await switchWorkspace(workspace.id);
        setMessage({ text: `Workspace "${workspace.name}" added successfully`, type: "success" });
    }, [refreshWorkspaces, switchWorkspace]);

    const selectWorkspace = useCallback(async (workspaceId: string) => {
        setSaving(true);
        setMessage(null);
        try {
            await switchWorkspace(workspaceId);
            setMessage({ text: "Workspace switched successfully", type: "success" });
        } catch (e: any) {
            setMessage({ text: e.message || "Failed to select workspace", type: "error" });
        } finally {
            setSaving(false);
        }
    }, [switchWorkspace]);

    const handleDeleteWorkspace = useCallback(async (workspaceId: string) => {
        if (workspaceId === activeWorkspaceId) {
            setMessage({ text: "Cannot delete the active workspace", type: "error" });
            return;
        }
        try {
            await deleteWorkspace(workspaceId);
            setMessage({ text: "Workspace deleted successfully", type: "success" });
        } catch (e: any) {
            setMessage({ text: e.message || "Failed to delete workspace", type: "error" });
        }
    }, [activeWorkspaceId, deleteWorkspace]);

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center bg-bg-app">
                <p className="text-text-muted text-sm">Loading workspaces...</p>
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col bg-bg-app overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border-subtle bg-bg-surface px-6 py-4">
                <div className="flex items-center gap-4">
                    <Link href="/app/config">
                        <button className="flex items-center justify-center rounded-md p-2 text-text-muted hover:bg-bg-component-hover hover:text-text-primary transition-colors">
                            <ArrowLeft className="h-4 w-4" />
                        </button>
                    </Link>
                    <div>
                        <h1 className="text-lg font-semibold text-text-primary">Workspace Configuration</h1>
                        <p className="text-sm text-text-muted">
                            Map folders to workspaces below. Tool approval policy is stored once per deployment (not per folder).
                        </p>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 scrollbar-elegant">
                    <div className="mx-auto max-w-3xl space-y-6">
                        {message && (
                            <div
                                className={`p-3 rounded-md text-sm ${message.type === "success" ? "bg-status-success-bg text-status-success-text border border-status-success-border" : "bg-status-error-bg text-status-error-text border border-status-error-border"}`}
                            >
                                {message.text}
                            </div>
                        )}

                        {error && (
                            <div className="p-3 rounded-md text-sm bg-status-error-bg text-status-error-text border border-status-error-border">
                                {error}
                            </div>
                        )}

                        {/* Tool approvals — high on page for visibility */}
                        <Panel className="overflow-hidden border border-border-subtle shadow-sm ring-1 ring-white/[0.06]">
                            <div className="relative border-b border-border-subtle bg-gradient-to-r from-accent/[0.08] via-bg-elevated/90 to-bg-elevated/50 px-5 py-5 sm:px-6">
                                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                    <div className="flex gap-4 min-w-0">
                                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent/15 border border-accent/25 shadow-inner">
                                            <ShieldCheck className="h-6 w-6 text-accent" aria-hidden />
                                        </div>
                                        <div className="min-w-0 space-y-2">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h2 className="text-lg font-semibold text-text-primary tracking-tight">
                                                    Tool approvals
                                                </h2>
                                                <span className="rounded-full border border-border-subtle bg-bg-surface/80 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                                                    Server-wide
                                                </span>
                                            </div>
                                            <p className="text-sm text-text-secondary leading-relaxed max-w-xl">
                                                One policy for this Kletron instance (saved in server config). It is{" "}
                                                <span className="font-medium text-text-primary">not</span> tied to individual folders in the list
                                                below—those are code workspaces only. Baseline for{" "}
                                                <span className="font-medium text-text-primary">tool auto-approval</span> and{" "}
                                                <span className="font-medium text-text-primary">new thread defaults</span>. Per-chat overrides live in
                                                Agent.
                                            </p>
                                            <Link
                                                href="/app/agent"
                                                className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accent/90 transition-colors group"
                                            >
                                                Open Agent to change a single conversation
                                                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="p-5 sm:p-6 space-y-5">
                                {toolApprovalLoading ? (
                                    <p className="text-sm text-text-muted">Loading approval settings…</p>
                                ) : (
                                    <>
                                        <div className="rounded-xl border border-border-subtle bg-bg-surface/40 p-4 sm:p-5 space-y-3">
                                            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                                                <MessageSquare className="h-3.5 w-3.5 text-accent" aria-hidden />
                                                Default for new threads
                                            </div>
                                            <p className="text-xs text-text-muted leading-relaxed">
                                                Applied when you start a <strong className="font-medium text-text-secondary">new</strong> run from Agent.
                                                Existing threads keep their own mode until you change them in chat.
                                            </p>
                                            <label className="block space-y-2">
                                                <span className="sr-only">Default approval mode</span>
                                                <select
                                                    className="w-full max-w-lg rounded-lg border border-border-subtle bg-bg-elevated px-3 py-2.5 text-sm text-text-primary shadow-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/40"
                                                    value={defaultThreadMode}
                                                    onChange={(e) => setDefaultThreadMode(e.target.value as ThreadApprovalMode)}
                                                >
                                                    {THREAD_APPROVAL_MODES.map((m) => (
                                                        <option key={m} value={m}>
                                                            {m === "inherit"
                                                                ? "Server rules only (recommended)"
                                                                : m === "confirm_everything"
                                                                  ? "Ask before every tool"
                                                                  : "Full auto for that new thread"}
                                                        </option>
                                                    ))}
                                                </select>
                                                <p className="text-xs text-text-muted leading-relaxed border-l-2 border-accent/40 pl-3 py-0.5">
                                                    {defaultModeHint[defaultThreadMode]}
                                                </p>
                                            </label>
                                        </div>

                                        <div className="rounded-xl border border-border-subtle bg-bg-surface/40 p-4 sm:p-5">
                                            <div className="flex items-start gap-3">
                                                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bg-elevated border border-border-subtle">
                                                    <Terminal className="h-4 w-4 text-text-secondary" aria-hidden />
                                                </div>
                                                <div className="min-w-0 flex-1 space-y-1">
                                                    <label className="flex cursor-pointer items-start gap-3">
                                                        <input
                                                            type="checkbox"
                                                            checked={autoApproveSafeBash}
                                                            onChange={(e) => setAutoApproveSafeBash(e.target.checked)}
                                                            className="mt-1 rounded border-border-subtle text-accent focus:ring-accent/40"
                                                        />
                                                        <span>
                                                            <span className="block text-sm font-medium text-text-primary">
                                                                Auto-approve safe shell commands
                                                            </span>
                                                            <span className="block text-xs text-text-muted mt-0.5">
                                                                Read-only style commands only: <code className="text-[11px] font-mono text-text-secondary">ls</code>,{" "}
                                                                <code className="text-[11px] font-mono text-text-secondary">cat</code>,{" "}
                                                                <code className="text-[11px] font-mono text-text-secondary">git status</code>, etc. Riskier
                                                                commands still go through approval when required by policy.
                                                            </span>
                                                        </span>
                                                    </label>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="rounded-xl border border-border-subtle bg-bg-surface/40 p-4 sm:p-5 space-y-3">
                                            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                                                <ListFilter className="h-3.5 w-3.5 text-accent" aria-hidden />
                                                Always require approval
                                            </div>
                                            <p className="text-xs text-text-muted leading-relaxed">
                                                Tool names that must <strong className="font-medium text-text-secondary">never</strong> run without a prompt,
                                                even if the thread is in full auto. Comma-separated, case-insensitive.
                                            </p>
                                            <label className="block space-y-2">
                                                <span className="text-xs font-medium text-text-secondary">Blocked tools (comma-separated)</span>
                                                <input
                                                    type="text"
                                                    className="w-full rounded-lg border border-border-subtle bg-bg-elevated px-3 py-2.5 text-sm font-mono text-text-primary placeholder:text-text-muted/70 shadow-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                                                    placeholder="execute_bash, write_file, …"
                                                    value={neverToolsInput}
                                                    onChange={(e) => setNeverToolsInput(e.target.value)}
                                                    spellCheck={false}
                                                />
                                            </label>
                                        </div>

                                        <details className="group rounded-xl border border-border-subtle bg-bg-surface/40 open:border-accent/25 open:bg-bg-surface/60">
                                            <summary className="cursor-pointer list-none p-4 sm:p-5 [&::-webkit-details-marker]:hidden">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bg-elevated border border-border-subtle">
                                                            <SlidersHorizontal className="h-4 w-4 text-text-secondary" aria-hidden />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="text-sm font-medium text-text-primary">Advanced</div>
                                                            <p className="text-xs text-text-muted mt-0.5">
                                                                Read-only source allowlist and per-tool overrides (optional).
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <span className="text-xs font-medium text-accent shrink-0 group-open:hidden">Show</span>
                                                    <span className="text-xs font-medium text-accent shrink-0 hidden group-open:inline">Hide</span>
                                                </div>
                                            </summary>
                                            <div className="border-t border-border-subtle px-4 pb-4 pt-0 sm:px-5 sm:pb-5 space-y-5">
                                                <div className="space-y-3 pt-4">
                                                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                                                        Read-only tools by source
                                                    </div>
                                                    <p className="text-xs text-text-muted leading-relaxed">
                                                        For <span className="font-medium text-text-secondary">read-only</span> tools, auto-approve when
                                                        the run source matches. Use normalized names:{" "}
                                                        <code className="text-[11px] font-mono text-text-secondary">agent</code>,{" "}
                                                        <code className="text-[11px] font-mono text-text-secondary">automation</code>,{" "}
                                                        <code className="text-[11px] font-mono text-text-secondary">channel</code>,{" "}
                                                        <code className="text-[11px] font-mono text-text-secondary">unknown</code>. Comma-separated.
                                                    </p>
                                                    <label className="block space-y-2">
                                                        <span className="text-xs font-medium text-text-secondary">Auto-approve readonly for sources</span>
                                                        <input
                                                            type="text"
                                                            className="w-full rounded-lg border border-border-subtle bg-bg-elevated px-3 py-2.5 text-sm font-mono text-text-primary placeholder:text-text-muted/70 shadow-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                                                            placeholder="agent, automation"
                                                            value={readonlySourcesInput}
                                                            onChange={(e) => setReadonlySourcesInput(e.target.value)}
                                                            spellCheck={false}
                                                        />
                                                    </label>
                                                </div>

                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                                                            Per-tool overrides
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                setOverrideRows((rows) => [
                                                                    ...rows,
                                                                    {
                                                                        id: `o-${++overrideRowId.current}`,
                                                                        tool: "",
                                                                        mode: "default",
                                                                    },
                                                                ])
                                                            }
                                                            className="inline-flex items-center gap-1 rounded-md border border-border-subtle bg-bg-elevated px-2 py-1 text-xs font-medium text-text-primary hover:bg-bg-component-hover"
                                                        >
                                                            <Plus className="h-3.5 w-3.5" aria-hidden />
                                                            Add row
                                                        </button>
                                                    </div>
                                                    <p className="text-xs text-text-muted leading-relaxed">
                                                        Force a tool to always require approval or always auto-approve, regardless of class. Leave mode as
                                                        “Default” to use normal policy for that tool.
                                                    </p>
                                                    <div className="space-y-2">
                                                        {overrideRows.map((row) => (
                                                            <div
                                                                key={row.id}
                                                                className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2"
                                                            >
                                                                <input
                                                                    type="text"
                                                                    className="min-w-0 flex-1 rounded-lg border border-border-subtle bg-bg-elevated px-3 py-2 text-sm font-mono text-text-primary placeholder:text-text-muted/70 shadow-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                                                                    placeholder="tool_name"
                                                                    value={row.tool}
                                                                    onChange={(e) =>
                                                                        setOverrideRows((rows) =>
                                                                            rows.map((r) =>
                                                                                r.id === row.id ? { ...r, tool: e.target.value } : r,
                                                                            ),
                                                                        )
                                                                    }
                                                                    spellCheck={false}
                                                                />
                                                                <div className="flex items-center gap-2 shrink-0">
                                                                    <select
                                                                        className="rounded-lg border border-border-subtle bg-bg-elevated px-3 py-2 text-sm text-text-primary shadow-sm focus:outline-none focus:ring-2 focus:ring-accent/30 min-w-[11rem]"
                                                                        value={row.mode}
                                                                        onChange={(e) =>
                                                                            setOverrideRows((rows) =>
                                                                                rows.map((r) =>
                                                                                    r.id === row.id
                                                                                        ? { ...r, mode: e.target.value as ToolOverrideMode }
                                                                                        : r,
                                                                                ),
                                                                            )
                                                                        }
                                                                    >
                                                                        <option value="default">Default (policy)</option>
                                                                        <option value="always_require">Always require approval</option>
                                                                        <option value="always_approve">Always auto-approve</option>
                                                                    </select>
                                                                    <button
                                                                        type="button"
                                                                        aria-label="Remove override row"
                                                                        onClick={() =>
                                                                            setOverrideRows((rows) => {
                                                                                const next = rows.filter((x) => x.id !== row.id);
                                                                                return next.length
                                                                                    ? next
                                                                                    : [
                                                                                          {
                                                                                              id: `o-${++overrideRowId.current}`,
                                                                                              tool: "",
                                                                                              mode: "default",
                                                                                          },
                                                                                      ];
                                                                            })
                                                                        }
                                                                        className="rounded-md border border-border-subtle p-2 text-text-muted hover:bg-bg-component-hover hover:text-status-error-text"
                                                                    >
                                                                        <X className="h-4 w-4" aria-hidden />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </details>

                                        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between pt-1">
                                            <p className="text-[11px] text-text-muted max-w-md">
                                                Saves once to server-wide config. Running agents pick up changes on the next tool call.
                                            </p>
                                            <Button
                                                variant="primary"
                                                size="md"
                                                className="w-full sm:w-auto min-w-[200px]"
                                                onClick={() => void saveToolApproval()}
                                                disabled={toolApprovalSaving}
                                            >
                                                {toolApprovalSaving ? "Saving…" : "Save tool approval settings"}
                                            </Button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </Panel>

                        {workspaces.length === 0 ? (
                            <div className="space-y-6">
                                <div className="text-center space-y-2 py-8 border border-dashed border-border-strong rounded-xl bg-bg-surface">
                                    <Folder className="h-10 w-10 text-text-muted mx-auto" />
                                    <h3 className="text-lg font-medium text-text-primary">No Workspaces Found</h3>
                                    <p className="text-sm text-text-muted max-w-sm mx-auto">
                                        You need to map a local folder to track code changes and run agents. Create your first workspace below.
                                    </p>
                                </div>
                                <InlineAddWorkspaceForm onCreated={handleWorkspaceCreated} />
                            </div>
                        ) : (
                            <>
                                <InlineAddWorkspaceForm onCreated={handleWorkspaceCreated} />
                                {/* Workspaces List */}
                                <Panel className="p-0 overflow-hidden">
                                    <div className="border-b border-border-subtle bg-bg-elevated/30 px-5 py-3 flex items-center justify-between">
                                        <h2 className="text-sm font-semibold text-text-primary">Active Workspaces</h2>
                                <Button
                                    variant="secondary"
                                    onClick={() => void refreshWorkspaces()}
                                    disabled={loading}
                                    className="text-xs"
                                >
                                    Refresh
                                </Button>
                            </div>
                                    <div className="p-5 space-y-3">
                                        {workspaces.map((workspace) => {
                                    const isActive = workspace.id === activeWorkspaceId;
                                    const isHealthy = (workspace.health ?? "healthy") === "healthy" && workspace.selectable !== false;
                                    return (
                                        <div
                                            key={workspace.id}
                                            className={`flex items-center justify-between rounded-md border px-3 py-2 ${isActive ? "border-status-success-border bg-status-success-bg" : "border-border-subtle"
                                                }`}
                                        >
                                            <div className="min-w-0">
                                                <div className="text-sm font-medium text-text-primary truncate">
                                                    {workspace.name}
                                                </div>
                                                <div className="text-xs text-text-muted truncate">{workspace.rootPath}</div>
                                                {!isHealthy && (
                                                    <div className="mt-1 text-[11px] text-status-warning-text">
                                                        {workspace.health === "missing" ? "Path missing" : "Path inaccessible"} - {workspace.healthMessage || "Repair or remove this workspace"}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {isActive ? (
                                                    <span className="text-xs text-status-success-text">Active</span>
                                                ) : (
                                                    <Button
                                                        variant="secondary"
                                                        onClick={() => selectWorkspace(workspace.id)}
                                                        disabled={saving || !isHealthy}
                                                        size="sm"
                                                    >
                                                        Select
                                                    </Button>
                                                )}
                                                <Button
                                                    variant="secondary"
                                                    onClick={() => handleDeleteWorkspace(workspace.id)}
                                                    disabled={saving}
                                                    size="sm"
                                                    className="text-text-muted hover:text-status-error-text hover:border-status-error-border"
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </Panel>
                    </>
                )}
            </div>
        </div>
    </div>
  );
}
