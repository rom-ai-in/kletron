"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { ThreadApprovalMode } from "@kletron/shared/threadApprovalTypes";
import { parseThreadApprovalMode, THREAD_APPROVAL_MODES } from "@kletron/shared/threadApprovalTypes";
import {
    ArrowLeft,
    ArrowRight,
    Folder,
    MessageSquare,
    Plus,
    ShieldCheck,
    SlidersHorizontal,
    Terminal,
    Trash2,
    X,
} from "lucide-react";
import Link from "next/link";
import { Panel, Button, Badge, EmptyState, Modal } from "@kletron/ui/components/design-system";
import { useWorkspace } from "@kletron/ui/context/WorkspaceContext";
import { InlineAddWorkspaceForm } from "./InlineAddWorkspaceForm";

type ToolOverrideMode = "always_approve" | "always_require" | "default";

type ToolOverrideRow = { id: string; tool: string; mode: ToolOverrideMode };

type ToolApprovalPolicyMeta = {
    scope: "organization" | "deployment";
    hasOrganizationOverride: boolean;
};

const FALLBACK_TOOL_APPROVAL_DEFAULTS = {
    neverTools: "",
    readonlySources: "agent, automation",
    autoApproveSafeBash: true,
    defaultThreadMode: "inherit" as ThreadApprovalMode,
};

const inputClass =
    "w-full rounded-md border border-border-subtle bg-bg-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-focus-ring focus:border-border-strong";

const selectClass =
    "w-full max-w-lg rounded-md border border-border-subtle bg-bg-elevated px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-focus-ring focus:border-border-strong";

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
    const [toolApprovalError, setToolApprovalError] = useState<string | null>(null);
    const [policyMeta, setPolicyMeta] = useState<ToolApprovalPolicyMeta | null>(null);
    const [toolApprovalSaving, setToolApprovalSaving] = useState(false);
    const [neverToolsInput, setNeverToolsInput] = useState("");
    const [readonlySourcesInput, setReadonlySourcesInput] = useState("");
    const [autoApproveSafeBash, setAutoApproveSafeBash] = useState(true);
    const [defaultThreadMode, setDefaultThreadMode] = useState<ThreadApprovalMode>("inherit");
    const [overrideRows, setOverrideRows] = useState<ToolOverrideRow[]>([]);
    const overrideRowId = useRef(0);

    const [fullAutoDefaultConfirmOpen, setFullAutoDefaultConfirmOpen] = useState(false);
    const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);

    useEffect(() => {
        let cancelled = false;
        void (async () => {
            setToolApprovalError(null);
            try {
                const res = await fetch("/api/config/tool-approval");
                const raw = (await res.json().catch(() => ({}))) as {
                    error?: string;
                    neverAutoApproveTools?: string[];
                    autoApproveSafeBash?: boolean;
                    defaultThreadApprovalMode?: ThreadApprovalMode;
                    autoApproveReadonlySources?: string[];
                    toolOverrides?: Record<string, ToolOverrideMode>;
                    policyMeta?: ToolApprovalPolicyMeta;
                };
                if (!res.ok) {
                    if (!cancelled) {
                        setToolApprovalError(raw.error || `Could not load tool approval policy (HTTP ${res.status}).`);
                        setPolicyMeta(null);
                        setNeverToolsInput(FALLBACK_TOOL_APPROVAL_DEFAULTS.neverTools);
                        setReadonlySourcesInput(FALLBACK_TOOL_APPROVAL_DEFAULTS.readonlySources);
                        setAutoApproveSafeBash(FALLBACK_TOOL_APPROVAL_DEFAULTS.autoApproveSafeBash);
                        setDefaultThreadMode(FALLBACK_TOOL_APPROVAL_DEFAULTS.defaultThreadMode);
                        setOverrideRows([{ id: `o-${++overrideRowId.current}`, tool: "", mode: "default" }]);
                    }
                    return;
                }
                if (cancelled) return;
                setPolicyMeta(raw.policyMeta ?? null);
                setNeverToolsInput((raw.neverAutoApproveTools ?? []).join(", "));
                setReadonlySourcesInput((raw.autoApproveReadonlySources ?? ["agent", "automation"]).join(", "));
                setAutoApproveSafeBash(raw.autoApproveSafeBash !== false);
                setDefaultThreadMode(parseThreadApprovalMode(raw.defaultThreadApprovalMode));
                const o = raw.toolOverrides ?? {};
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
                    setToolApprovalError("Network error — could not load tool approval policy.");
                    setPolicyMeta(null);
                    setNeverToolsInput(FALLBACK_TOOL_APPROVAL_DEFAULTS.neverTools);
                    setReadonlySourcesInput(FALLBACK_TOOL_APPROVAL_DEFAULTS.readonlySources);
                    setAutoApproveSafeBash(FALLBACK_TOOL_APPROVAL_DEFAULTS.autoApproveSafeBash);
                    setDefaultThreadMode(FALLBACK_TOOL_APPROVAL_DEFAULTS.defaultThreadMode);
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
            const saved = (await res.json().catch(() => ({}))) as { error?: string; policyMeta?: ToolApprovalPolicyMeta };
            if (!res.ok) {
                throw new Error(saved.error || `Save failed (${res.status})`);
            }
            if (saved.policyMeta) setPolicyMeta(saved.policyMeta);
            setMessage({ text: "Tool approval settings saved.", type: "success" });
        } catch (e: any) {
            setMessage({ text: e?.message || "Failed to save tool approval settings", type: "error" });
        } finally {
            setToolApprovalSaving(false);
        }
    }, [neverToolsInput, readonlySourcesInput, autoApproveSafeBash, defaultThreadMode, overrideRows]);

    const defaultModeHint: Record<ThreadApprovalMode, string> = {
        inherit:
            policyMeta?.scope === "organization"
                ? "New threads follow your organization’s rules below. You can still pick a different mode for each chat in Agent."
                : "New threads follow the deployment-wide rules below. You can still pick a different mode for each chat in Agent.",
        confirm_everything:
            "New threads will ask before running any tool. Change anytime in Agent or here.",
        full_auto_thread:
            "New threads start in full auto for that conversation. Admin tools and your blocklist below still need approval.",
    };

    const handleWorkspaceCreated = useCallback(
        async (workspace: { id: string; name: string; rootPath: string }) => {
            await refreshWorkspaces();
            await switchWorkspace(workspace.id);
            setMessage({ text: `Workspace "${workspace.name}" added successfully`, type: "success" });
        },
        [refreshWorkspaces, switchWorkspace],
    );

    const selectWorkspace = useCallback(
        async (workspaceId: string) => {
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
        },
        [switchWorkspace],
    );

    const confirmDeleteWorkspace = useCallback(async () => {
        if (!pendingDelete) return;
        const { id: workspaceId, name } = pendingDelete;
        setPendingDelete(null);
        if (workspaceId === activeWorkspaceId) {
            setMessage({ text: "Cannot delete the active workspace", type: "error" });
            return;
        }
        try {
            await deleteWorkspace(workspaceId);
            setMessage({ text: `Workspace "${name}" deleted`, type: "success" });
        } catch (e: any) {
            setMessage({ text: e.message || "Failed to delete workspace", type: "error" });
        }
    }, [activeWorkspaceId, deleteWorkspace, pendingDelete]);

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center bg-bg-app">
                <p className="text-sm text-text-muted">Loading workspaces…</p>
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col bg-bg-app overflow-hidden">
            <Modal
                open={fullAutoDefaultConfirmOpen}
                onClose={() => setFullAutoDefaultConfirmOpen(false)}
                title="Default full auto for new threads"
                subtitle="New chats will start with tools running automatically for that thread (except your blocklist and Kletron admin tools). You can still change mode per chat in Agent."
                footer={
                    <div className="flex justify-end gap-2">
                        <Button variant="ghost" onClick={() => setFullAutoDefaultConfirmOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            variant="primary"
                            onClick={() => {
                                if (typeof sessionStorage !== "undefined") {
                                    sessionStorage.setItem("kletron-full-auto-default-thread-ok", "1");
                                }
                                setDefaultThreadMode("full_auto_thread");
                                setFullAutoDefaultConfirmOpen(false);
                            }}
                        >
                            Use full auto by default
                        </Button>
                    </div>
                }
            >
                <p className="text-sm text-text-secondary">
                    Applies to new sessions only — same guardrail pattern as choosing full auto on the Agent page.
                </p>
            </Modal>

            <Modal
                open={pendingDelete !== null}
                onClose={() => setPendingDelete(null)}
                title="Delete workspace?"
                subtitle={
                    pendingDelete
                        ? `"${pendingDelete.name}" will be removed from Kletron. Files on disk are not deleted.`
                        : undefined
                }
                footer={
                    <div className="flex justify-end gap-2">
                        <Button variant="ghost" onClick={() => setPendingDelete(null)}>
                            Cancel
                        </Button>
                        <Button variant="danger" onClick={() => void confirmDeleteWorkspace()}>
                            Delete
                        </Button>
                    </div>
                }
            >
                <p className="text-sm text-text-secondary">This cannot be undone in Kletron configuration.</p>
            </Modal>

            <div className="flex shrink-0 items-center justify-between border-b border-border-subtle bg-bg-surface px-6 py-4">
                <div className="flex min-w-0 items-center gap-4">
                    <Link
                        href="/app/config"
                        className="flex items-center justify-center rounded-md p-2 text-text-muted transition-colors hover:bg-bg-component-hover hover:text-text-primary"
                        aria-label="Back to configuration"
                    >
                        <ArrowLeft className="h-4 w-4" aria-hidden />
                    </Link>
                    <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-text-secondary/10 text-text-secondary">
                            <Folder className="h-4 w-4" aria-hidden />
                        </div>
                        <div className="min-w-0">
                            <h1 className="truncate text-lg font-semibold text-text-primary">Workspace</h1>
                            <p className="text-sm text-text-muted">
                                Working folders; tool approval follows your organization policy (or deployment-wide when no org context).
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto scrollbar-elegant">
                <div className="w-full space-y-6 px-6 py-6 lg:px-8 lg:py-8">
                    {message && (
                        <div
                            role="status"
                            className={`rounded-md border px-4 py-3 text-sm ${
                                message.type === "success"
                                    ? "border-status-success-border bg-status-success-bg text-status-success-text"
                                    : "border-status-error-border bg-status-error-bg text-status-error-text"
                            }`}
                        >
                            {message.text}
                        </div>
                    )}

                    {error && (
                        <div
                            role="alert"
                            className="rounded-md border border-status-error-border bg-status-error-bg px-4 py-3 text-sm text-status-error-text"
                        >
                            {error}
                        </div>
                    )}

                    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12 xl:gap-8">
                        {/* Workspaces */}
                        <div className="space-y-6 xl:col-span-5">
                            {workspaces.length === 0 ? (
                                <EmptyState
                                    variant="no-data"
                                    title="No workspace yet"
                                    description="Map a local folder so agents can read and edit your repo."
                                    className="border border-dashed border-border-subtle bg-bg-surface py-10"
                                />
                            ) : (
                                <Panel className="overflow-hidden p-0">
                                    <div className="flex items-center justify-between border-b border-border-subtle bg-bg-surface px-5 py-3">
                                        <h2 className="text-sm font-semibold text-text-primary">Workspaces</h2>
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            onClick={() => void refreshWorkspaces()}
                                            disabled={loading}
                                        >
                                            Refresh
                                        </Button>
                                    </div>
                                    <ul className="divide-y divide-border-subtle">
                                        {workspaces.map((workspace) => {
                                            const isActive = workspace.id === activeWorkspaceId;
                                            const isHealthy =
                                                (workspace.health ?? "healthy") === "healthy" &&
                                                workspace.selectable !== false;
                                            return (
                                                <li
                                                    key={workspace.id}
                                                    className={`flex items-center justify-between gap-3 px-5 py-3 ${
                                                        isActive ? "bg-status-success-bg/40" : "bg-bg-app"
                                                    }`}
                                                >
                                                    <div className="min-w-0 flex-1">
                                                        <div className="truncate text-sm font-medium text-text-primary">
                                                            {workspace.name}
                                                        </div>
                                                        <div className="truncate font-mono text-xs text-text-muted">
                                                            {workspace.rootPath}
                                                        </div>
                                                        {!isHealthy && (
                                                            <p className="mt-1 text-xs text-status-warning-text">
                                                                {workspace.health === "missing"
                                                                    ? "Path missing"
                                                                    : "Path inaccessible"}
                                                                {workspace.healthMessage
                                                                    ? ` — ${workspace.healthMessage}`
                                                                    : ""}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div className="flex shrink-0 items-center gap-2">
                                                        {isActive ? (
                                                            <Badge variant="success" size="sm" uppercase={false}>
                                                                Active
                                                            </Badge>
                                                        ) : (
                                                            <Button
                                                                variant="secondary"
                                                                size="sm"
                                                                onClick={() => void selectWorkspace(workspace.id)}
                                                                disabled={saving || !isHealthy}
                                                            >
                                                                Select
                                                            </Button>
                                                        )}
                                                        <Button
                                                            variant="secondary"
                                                            size="sm"
                                                            onClick={() =>
                                                                setPendingDelete({ id: workspace.id, name: workspace.name })
                                                            }
                                                            disabled={saving}
                                                            className="text-text-muted hover:border-status-error-border hover:text-status-error-text"
                                                            aria-label="Delete workspace"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </Panel>
                            )}

                            <InlineAddWorkspaceForm onCreated={handleWorkspaceCreated} />
                        </div>

                        {/* Tool approvals */}
                        <div className="xl:col-span-7">
                            <Panel className="overflow-hidden p-0">
                                <div className="border-b border-border-subtle bg-bg-surface px-5 py-4">
                                    <div className="flex flex-wrap items-center gap-2 gap-y-1">
                                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-bg-elevated text-text-secondary">
                                            <ShieldCheck className="h-4 w-4" aria-hidden />
                                        </div>
                                        <h2 className="text-sm font-semibold text-text-primary">Tool approvals</h2>
                                        <Badge variant="outline" size="sm" uppercase={false}>
                                            {policyMeta?.scope === "organization" ? "Organization" : "Deployment"}
                                        </Badge>
                                        {policyMeta?.scope === "organization" && !policyMeta?.hasOrganizationOverride ? (
                                            <Badge variant="outline" size="sm" uppercase={false}>
                                                Inherited defaults
                                            </Badge>
                                        ) : null}
                                    </div>
                                    <p className="mt-2 text-xs text-text-secondary">
                                        {policyMeta?.scope === "organization"
                                            ? "Your organization’s policy; changes do not affect other tenants. Per-chat overrides stay in Agent."
                                            : "Deployment-level policy (no organization context). Per-chat overrides stay in Agent."}
                                    </p>
                                    <Link
                                        href="/app/agent"
                                        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-text-secondary hover:text-text-primary"
                                    >
                                        Open Agent for this conversation only
                                        <ArrowRight className="h-3 w-3" aria-hidden />
                                    </Link>
                                </div>

                                <div className="space-y-6 bg-bg-app p-5">
                                    {toolApprovalLoading ? (
                                        <p className="text-sm text-text-muted">Loading approval settings…</p>
                                    ) : (
                                        <>
                                            {toolApprovalError ? (
                                                <div
                                                    role="alert"
                                                    className="rounded-md border border-status-error-border bg-status-error-bg px-4 py-3 text-sm text-status-error-text"
                                                >
                                                    {toolApprovalError}{" "}
                                                    <button
                                                        type="button"
                                                        className="font-medium underline"
                                                        onClick={() => {
                                                            setToolApprovalLoading(true);
                                                            setToolApprovalError(null);
                                                            void fetch("/api/config/tool-approval")
                                                                .then(async (res) => {
                                                                    const raw = (await res.json().catch(() => ({}))) as {
                                                                        error?: string;
                                                                        neverAutoApproveTools?: string[];
                                                                        autoApproveSafeBash?: boolean;
                                                                        defaultThreadApprovalMode?: ThreadApprovalMode;
                                                                        autoApproveReadonlySources?: string[];
                                                                        toolOverrides?: Record<string, ToolOverrideMode>;
                                                                        policyMeta?: ToolApprovalPolicyMeta;
                                                                    };
                                                                    if (!res.ok) {
                                                                        setToolApprovalError(
                                                                            raw.error ||
                                                                                `Could not load tool approval policy (HTTP ${res.status}).`,
                                                                        );
                                                                        return;
                                                                    }
                                                                    setPolicyMeta(raw.policyMeta ?? null);
                                                                    setNeverToolsInput((raw.neverAutoApproveTools ?? []).join(", "));
                                                                    setReadonlySourcesInput(
                                                                        (raw.autoApproveReadonlySources ?? ["agent", "automation"]).join(
                                                                            ", ",
                                                                        ),
                                                                    );
                                                                    setAutoApproveSafeBash(raw.autoApproveSafeBash !== false);
                                                                    setDefaultThreadMode(parseThreadApprovalMode(raw.defaultThreadApprovalMode));
                                                                    const o = raw.toolOverrides ?? {};
                                                                    const keys = Object.keys(o);
                                                                    if (keys.length === 0) {
                                                                        setOverrideRows([
                                                                            { id: `o-${++overrideRowId.current}`, tool: "", mode: "default" },
                                                                        ]);
                                                                    } else {
                                                                        setOverrideRows(
                                                                            keys.map((k) => ({
                                                                                id: `o-${++overrideRowId.current}`,
                                                                                tool: k,
                                                                                mode: o[k] ?? "default",
                                                                            })),
                                                                        );
                                                                    }
                                                                    setToolApprovalError(null);
                                                                })
                                                                .catch(() => {
                                                                    setToolApprovalError(
                                                                        "Network error — could not load tool approval policy.",
                                                                    );
                                                                })
                                                                .finally(() => setToolApprovalLoading(false));
                                                        }}
                                                    >
                                                        Retry
                                                    </button>
                                                </div>
                                            ) : null}
                                            <section className="space-y-2">
                                                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                                                    <MessageSquare className="h-3.5 w-3.5" aria-hidden />
                                                    Default for new threads
                                                </div>
                                                <p className="text-xs text-text-muted">{defaultModeHint[defaultThreadMode]}</p>
                                                <label className="block space-y-2">
                                                    <span className="sr-only">Default approval mode</span>
                                                    <select
                                                        className={selectClass}
                                                        value={defaultThreadMode}
                                                        onChange={(e) => {
                                                            const mode = e.target.value as ThreadApprovalMode;
                                                            if (mode === "full_auto_thread") {
                                                                const key = "kletron-full-auto-default-thread-ok";
                                                                if (
                                                                    typeof sessionStorage !== "undefined" &&
                                                                    !sessionStorage.getItem(key)
                                                                ) {
                                                                    setFullAutoDefaultConfirmOpen(true);
                                                                    return;
                                                                }
                                                            }
                                                            setDefaultThreadMode(mode);
                                                        }}
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
                                                </label>
                                            </section>

                                            <section className="space-y-3 border-t border-border-subtle pt-6">
                                                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                                                    <Terminal className="h-3.5 w-3.5" aria-hidden />
                                                    Shell
                                                </div>
                                                <label className="flex cursor-pointer items-start gap-3">
                                                    <input
                                                        type="checkbox"
                                                        checked={autoApproveSafeBash}
                                                        onChange={(e) => setAutoApproveSafeBash(e.target.checked)}
                                                        className="mt-1 rounded border-border-subtle text-accent focus:ring-accent/40"
                                                    />
                                                    <span>
                                                        <span className="block text-sm text-text-primary">
                                                            Auto-approve safe shell commands
                                                        </span>
                                                        <span className="mt-0.5 block text-xs text-text-muted">
                                                            Read-only style commands only (
                                                            <code className="font-mono text-[11px]">ls</code>,{" "}
                                                            <code className="font-mono text-[11px]">cat</code>,{" "}
                                                            <code className="font-mono text-[11px]">git status</code>
                                                            , …). Riskier commands still follow policy.
                                                        </span>
                                                    </span>
                                                </label>
                                            </section>

                                            <section className="space-y-2 border-t border-border-subtle pt-6">
                                                <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                                                    Always require approval
                                                </p>
                                                <p className="text-xs text-text-muted">
                                                    Tool names that never run without a prompt (comma-separated, case-insensitive).
                                                </p>
                                                <input
                                                    type="text"
                                                    className={`${inputClass} font-mono text-sm`}
                                                    placeholder="execute_bash, write_file, …"
                                                    value={neverToolsInput}
                                                    onChange={(e) => setNeverToolsInput(e.target.value)}
                                                    spellCheck={false}
                                                />
                                            </section>

                                            <details className="group border-t border-border-subtle pt-6">
                                                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium text-text-primary [&::-webkit-details-marker]:hidden">
                                                    <span className="flex items-center gap-2">
                                                        <SlidersHorizontal className="h-4 w-4 text-text-muted" aria-hidden />
                                                        Advanced
                                                    </span>
                                                    <span className="text-xs font-normal text-text-muted group-open:hidden">
                                                        Show
                                                    </span>
                                                    <span className="hidden text-xs font-normal text-text-muted group-open:inline">
                                                        Hide
                                                    </span>
                                                </summary>
                                                <div className="mt-4 space-y-5">
                                                    <div className="space-y-2">
                                                        <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                                                            Read-only tools by source
                                                        </p>
                                                        <p className="text-xs text-text-muted">
                                                            Auto-approve read-only tools when the run source matches (
                                                            <code className="font-mono text-[11px]">agent</code>,{" "}
                                                            <code className="font-mono text-[11px]">automation</code>, …).
                                                            Comma-separated.
                                                        </p>
                                                        <input
                                                            type="text"
                                                            className={`${inputClass} font-mono text-sm`}
                                                            placeholder="agent, automation"
                                                            value={readonlySourcesInput}
                                                            onChange={(e) => setReadonlySourcesInput(e.target.value)}
                                                            spellCheck={false}
                                                        />
                                                    </div>

                                                    <div className="space-y-3">
                                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                                            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                                                                Per-tool overrides
                                                            </p>
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
                                                                className="inline-flex items-center gap-1 rounded-md border border-border-subtle bg-bg-elevated px-2 py-1 text-xs font-medium text-text-primary hover:bg-state-hover"
                                                            >
                                                                <Plus className="h-3.5 w-3.5" aria-hidden />
                                                                Add row
                                                            </button>
                                                        </div>
                                                        <p className="text-xs text-text-muted">
                                                            Force always require or always auto-approve for a tool name. “Default” uses normal policy.
                                                        </p>
                                                        <div className="space-y-2">
                                                            {overrideRows.map((row) => (
                                                                <div
                                                                    key={row.id}
                                                                    className="flex flex-col gap-2 sm:flex-row sm:items-center"
                                                                >
                                                                    <input
                                                                        type="text"
                                                                        className={`${inputClass} min-w-0 flex-1 font-mono`}
                                                                        placeholder="tool_name"
                                                                        value={row.tool}
                                                                        onChange={(e) =>
                                                                            setOverrideRows((rows) =>
                                                                                rows.map((r) =>
                                                                                    r.id === row.id
                                                                                        ? { ...r, tool: e.target.value }
                                                                                        : r,
                                                                                ),
                                                                            )
                                                                        }
                                                                        spellCheck={false}
                                                                    />
                                                                    <div className="flex shrink-0 items-center gap-2">
                                                                        <select
                                                                            className={`${selectClass} min-w-[11rem] max-w-none`}
                                                                            value={row.mode}
                                                                            onChange={(e) =>
                                                                                setOverrideRows((rows) =>
                                                                                    rows.map((r) =>
                                                                                        r.id === row.id
                                                                                            ? {
                                                                                                  ...r,
                                                                                                  mode: e.target
                                                                                                      .value as ToolOverrideMode,
                                                                                              }
                                                                                            : r,
                                                                                    ),
                                                                                )
                                                                            }
                                                                        >
                                                                            <option value="default">
                                                                                Default (policy)
                                                                            </option>
                                                                            <option value="always_require">
                                                                                Always require approval
                                                                            </option>
                                                                            <option value="always_approve">
                                                                                Always auto-approve
                                                                            </option>
                                                                        </select>
                                                                        <button
                                                                            type="button"
                                                                            aria-label="Remove override row"
                                                                            onClick={() =>
                                                                                setOverrideRows((rows) => {
                                                                                    const next = rows.filter(
                                                                                        (x) => x.id !== row.id,
                                                                                    );
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
                                                                            className="rounded-md border border-border-subtle p-2 text-text-muted hover:bg-state-hover hover:text-status-error-text"
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

                                            <div className="flex flex-col-reverse gap-3 border-t border-border-subtle pt-6 sm:flex-row sm:items-center sm:justify-between">
                                                <p className="text-[11px] text-text-muted">
                                                    Saves to server config; agents pick this up on the next tool call.
                                                </p>
                                                <Button
                                                    variant="primary"
                                                    size="md"
                                                    className="w-full shrink-0 sm:w-auto"
                                                    onClick={() => void saveToolApproval()}
                                                    disabled={toolApprovalSaving || Boolean(toolApprovalError)}
                                                >
                                                    {toolApprovalSaving ? "Saving…" : "Save tool approvals"}
                                                </Button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </Panel>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
