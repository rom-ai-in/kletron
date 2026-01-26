"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Save, Folder, Check, AlertCircle, GitBranch } from "lucide-react";
import Link from "next/link";
import { Panel } from "@/src/components/ui/Panel";
import { Button } from "@/src/components/ui/Button";

type Config = {
    mcpDefaultDir: string;
};

type ValidationState = {
    valid: boolean;
    checked: boolean;
    error?: string;
    currentBranch?: string;
    branches?: string[];
};

export default function WorkspaceConfigPage() {
    const [config, setConfig] = useState<Config>({ mcpDefaultDir: "" });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [validating, setValidating] = useState(false);
    const [validation, setValidation] = useState<ValidationState>({ valid: false, checked: false });
    const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

    useEffect(() => {
        async function fetchConfig() {
            try {
                const res = await fetch("/api/config");
                if (!res.ok) throw new Error("Failed to load config");
                const data = await res.json();
                setConfig(data);
                // Put in initial validation state so user sees current status
                if (data.mcpDefaultDir) {
                    void validatePath(data.mcpDefaultDir);
                }
            } catch (e: any) {
                setMessage({ text: e.message || "Failed to load config", type: "error" });
            } finally {
                setLoading(false);
            }
        }
        fetchConfig();
    }, []);

    const validatePath = async (path: string) => {
        if (!path) {
            setValidation({ valid: false, checked: false });
            return;
        }

        setValidating(true);
        try {
            const res = await fetch("/api/validation/git", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ path }),
            });
            const data = await res.json();

            setValidation({
                checked: true,
                valid: data.valid,
                error: data.error,
                currentBranch: data.currentBranch,
                branches: data.branches
            });
        } catch (e) {
            setValidation({
                checked: true,
                valid: false,
                error: "Failed to connect to validation service"
            });
        } finally {
            setValidating(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setMessage(null);
        try {
            const res = await fetch("/api/config", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(config),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to save");

            setConfig(data);
            setMessage({ text: "Configuration saved successfully", type: "success" });
        } catch (e: any) {
            setMessage({ text: e.message || "Failed to save config", type: "error" });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center bg-bg-app">
                <p className="text-text-muted text-sm">Loading configuration...</p>
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col bg-bg-app overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border-subtle bg-bg-surface px-6 py-4">
                <div className="flex items-center gap-4">
                    <Link href="/config">
                        <button className="flex items-center justify-center rounded-md p-2 text-text-muted hover:bg-bg-component-hover hover:text-text-primary transition-colors">
                            <ArrowLeft className="h-4 w-4" />
                        </button>
                    </Link>
                    <div>
                        <h1 className="text-lg font-semibold text-text-primary">Workspace Configuration</h1>
                        <p className="text-sm text-text-muted">Manage your MCP repository root.</p>
                    </div>
                </div>
                <Button
                    onClick={handleSave}
                    disabled={saving || (validation.checked && !validation.valid)}
                    variant="primary"
                    className="flex items-center gap-2"
                >
                    <Save className="h-4 w-4" />
                    {saving ? "Saving..." : "Save Changes"}
                </Button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 scrollbar-elegant">
                <div className="mx-auto max-w-3xl space-y-6">
                    {message && (
                        <div
                            className={`p-3 rounded-md text-sm ${message.type === "success" ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" : "bg-red-500/10 text-red-500 border border-red-500/20"}`}
                        >
                            {message.text}
                        </div>
                    )}

                    <Panel className="p-0 overflow-hidden">
                        <div className="border-b border-border-subtle bg-bg-elevated/30 px-5 py-3">
                            <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                                <Folder className="h-4 w-4 text-emerald-500" />
                                Repository Settings
                            </h2>
                        </div>

                        <div className="p-5 space-y-5">
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-text-secondary">
                                    MCP Default Directory
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={config.mcpDefaultDir}
                                        onChange={(e) => {
                                            setConfig({ ...config, mcpDefaultDir: e.target.value });
                                            setValidation({ valid: false, checked: false }); // Reset validation on edit
                                        }}
                                        placeholder="/absolute/path/to/repo"
                                        className="flex-1 rounded-md border border-border-subtle bg-bg-app px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/20 transition-all"
                                    />
                                    <Button
                                        variant="secondary"
                                        onClick={() => validatePath(config.mcpDefaultDir)}
                                        disabled={validating || !config.mcpDefaultDir}
                                    >
                                        {validating ? "Checking..." : "Validate"}
                                    </Button>
                                </div>

                                {/* Validation Feedback */}
                                {validation.checked && (
                                    <div className={`mt-3 rounded-md p-3 text-sm border ${validation.valid ? "bg-emerald-500/5 border-emerald-500/20" : "bg-red-500/5 border-red-500/20"}`}>
                                        <div className="flex items-center gap-2 mb-1">
                                            {validation.valid ? (
                                                <Check className="h-4 w-4 text-emerald-500" />
                                            ) : (
                                                <AlertCircle className="h-4 w-4 text-red-500" />
                                            )}
                                            <span className={`font-semibold ${validation.valid ? "text-emerald-600" : "text-red-600"}`}>
                                                {validation.valid ? "Valid Git Repository" : "Validation Failed"}
                                            </span>
                                        </div>

                                        {!validation.valid && validation.error && (
                                            <p className="text-red-500 text-xs ml-6">{validation.error}</p>
                                        )}

                                        {validation.valid && (
                                            <div className="mt-2 ml-6 space-y-1 text-xs text-text-secondary">
                                                <div className="flex items-center gap-2">
                                                    <GitBranch className="h-3 w-3" />
                                                    <span>Current Branch: <strong className="text-text-primary">{validation.currentBranch}</strong></span>
                                                </div>
                                                {validation.branches && validation.branches.length > 0 && (
                                                    <div className="text-text-muted">
                                                        Available branches: {validation.branches.slice(0, 5).join(", ")}
                                                        {validation.branches.length > 5 && ` (+${validation.branches.length - 5} others)`}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                <p className="mt-2 text-xs text-text-muted">
                                    The absolute path to the repository you want to edit. Must contain a <code>.git</code> folder.
                                </p>
                            </div>
                        </div>
                    </Panel>
                </div>
            </div>
        </div>
    );
}
