"use client";

import { useState, useCallback } from "react";
import { ArrowLeft, Folder, Trash2 } from "lucide-react";
import Link from "next/link";
import { Panel, Button } from "@numezis/ui/components/design-system";
import { useWorkspace } from "@numezis/ui/context/WorkspaceContext";
import { InlineAddWorkspaceForm } from "./InlineAddWorkspaceForm";

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
                        <p className="text-sm text-text-muted">Manage your workspaces and project folders.</p>
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
