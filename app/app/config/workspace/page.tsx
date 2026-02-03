"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Save, Folder, Check, AlertCircle, Github, Loader2 } from "lucide-react";
import Link from "next/link";
import { Panel, Button } from "@/src/components/design-system";

type Config = {
    workingFolder: string;
};

type ValidationState = {
    valid: boolean;
    checked: boolean;
    error?: string;
};

type GitValidationState = {
    valid: boolean;
    checked: boolean;
    error?: string;
    currentBranch?: string;
    branches?: string[];
};

type GithubRepo = {
    id: number;
    name: string;
    full_name: string;
    private: boolean;
    html_url: string;
    clone_url: string;
    ssh_url: string;
    default_branch: string;
    updated_at: string;
    owner: { login: string };
};

export default function WorkspaceConfigPage() {
    const [config, setConfig] = useState<Config>({ workingFolder: "" });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [validating, setValidating] = useState(false);
    const [validation, setValidation] = useState<ValidationState>({ valid: false, checked: false });
    const [gitValidating, setGitValidating] = useState(false);
    const [gitValidation, setGitValidation] = useState<GitValidationState>({ valid: false, checked: false });
    const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
    const [ghRepos, setGhRepos] = useState<GithubRepo[]>([]);
    const [ghReposRoot, setGhReposRoot] = useState<string | null>(null);
    const [ghLoading, setGhLoading] = useState(false);
    const [ghError, setGhError] = useState<string | null>(null);
    const [ghSearch, setGhSearch] = useState("");
    const [selectedRepoFullName, setSelectedRepoFullName] = useState<string>("");
    const [customRepoInput, setCustomRepoInput] = useState("");
    const [cloning, setCloning] = useState(false);

    useEffect(() => {
        async function fetchConfig() {
            try {
                const res = await fetch("/api/config");
                if (!res.ok) throw new Error("Failed to load config");
                const data = await res.json();
                setConfig(data);
                if (data.workingFolder) {
                    void validatePath(data.workingFolder);
                }
            } catch (e: any) {
                setMessage({ text: e.message || "Failed to load config", type: "error" });
            } finally {
                setLoading(false);
            }
        }
        fetchConfig();
    }, []);

    useEffect(() => {
        void fetchGithubRepos();
    }, []);

    const validatePath = async (path: string) => {
        if (!path) {
            setValidation({ valid: false, checked: false });
            setGitValidation({ valid: false, checked: false });
            return;
        }

        setValidating(true);
        try {
            const res = await fetch("/api/validation/folder", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ path }),
            });
            const data = await res.json();

            setValidation({
                checked: true,
                valid: data.valid,
                error: data.error,
            });

            if (data.valid) {
                await validateGitRepo(path);
            } else {
                setGitValidation({ valid: false, checked: false });
            }
        } catch (e) {
            setValidation({
                checked: true,
                valid: false,
                error: "Failed to connect to validation service"
            });
            setGitValidation({ valid: false, checked: false });
        } finally {
            setValidating(false);
        }
    };

    const validateGitRepo = async (path: string) => {
        setGitValidating(true);
        try {
            const res = await fetch("/api/validation/git", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ path }),
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "Failed to validate git repository");
            }

            setGitValidation({
                checked: true,
                valid: !!data.valid,
                error: data.error,
                currentBranch: data.currentBranch,
                branches: Array.isArray(data.branches) ? data.branches : [],
            });
        } catch (e: any) {
            setGitValidation({
                checked: true,
                valid: false,
                error: e.message || "No GitHub repo detected",
            });
        } finally {
            setGitValidating(false);
        }
    };

    const handleSave = async () => {
        if (!validation.valid || !gitValidation.valid) {
            setMessage({ text: "Please select a valid GitHub repository folder before saving.", type: "error" });
            return;
        }

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

    const fetchGithubRepos = async () => {
        setGhLoading(true);
        setGhError(null);
        try {
            const res = await fetch("/api/github/repos");
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "Failed to load GitHub repositories");
            }
            setGhRepos(Array.isArray(data.repos) ? data.repos : []);
            if (data.reposRoot) setGhReposRoot(data.reposRoot);
            if (data.error) setGhError(data.error);
        } catch (e: any) {
            setGhError(e.message || "Failed to load GitHub repositories");
        } finally {
            setGhLoading(false);
        }
    };

    const filteredRepos = useMemo(() => {
        if (!ghSearch.trim()) return ghRepos;
        const q = ghSearch.toLowerCase();
        return ghRepos.filter((repo) =>
            repo.full_name.toLowerCase().includes(q) ||
            repo.name.toLowerCase().includes(q)
        );
    }, [ghRepos, ghSearch]);

    const selectedRepo = useMemo(
        () => ghRepos.find((repo) => repo.full_name === selectedRepoFullName) || null,
        [ghRepos, selectedRepoFullName]
    );

    const handleCloneRepo = async () => {
        if (!selectedRepo && !customRepoInput.trim()) {
            setMessage({ text: "Select a repository or paste a GitHub URL first.", type: "error" });
            return;
        }

        setCloning(true);
        setMessage(null);
        try {
            const payload = selectedRepo
                ? { repoUrl: selectedRepo.clone_url, fullName: selectedRepo.full_name }
                : { repoUrl: customRepoInput.trim() };
            const res = await fetch("/api/github/clone", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "Failed to clone repository");
            }

            if (data.workingFolder) {
                setConfig({ workingFolder: data.workingFolder });
                void validatePath(data.workingFolder);
            }
            if (data.reposRoot) setGhReposRoot(data.reposRoot);

            setMessage({
                text: data.status === "exists"
                    ? "Repository already exists. Set as working folder."
                    : "Repository cloned and selected as working folder.",
                type: "success",
            });
        } catch (e: any) {
            setMessage({ text: e.message || "Failed to clone repository", type: "error" });
        } finally {
            setCloning(false);
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
                    <Link href="/app/config">
                        <button className="flex items-center justify-center rounded-md p-2 text-text-muted hover:bg-bg-component-hover hover:text-text-primary transition-colors">
                            <ArrowLeft className="h-4 w-4" />
                        </button>
                    </Link>
                    <div>
                        <h1 className="text-lg font-semibold text-text-primary">Workspace Configuration</h1>
                        <p className="text-sm text-text-muted">Manage your working folder for repositories.</p>
                    </div>
                </div>
                <Button
                    onClick={handleSave}
                    disabled={saving || !validation.valid || !gitValidation.valid}
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
                                Working Folder Settings
                            </h2>
                        </div>

                        <div className="p-5 space-y-5">
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-text-secondary">
                                    Working Folder Path
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={config.workingFolder}
                                        onChange={(e) => {
                                            setConfig({ ...config, workingFolder: e.target.value });
                                            setValidation({ valid: false, checked: false });
                                            setGitValidation({ valid: false, checked: false });
                                        }}
                                        placeholder="/absolute/path/to/folder"
                                        className="flex-1 rounded-md border border-border-subtle bg-bg-app px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/20 transition-all"
                                    />
                                    <Button
                                        variant="secondary"
                                        onClick={() => validatePath(config.workingFolder)}
                                        disabled={validating || !config.workingFolder}
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
                                                {validation.valid ? "Valid Working Folder" : "Validation Failed"}
                                            </span>
                                        </div>

                                        {!validation.valid && validation.error && (
                                            <p className="text-red-500 text-xs ml-6">{validation.error}</p>
                                        )}
                                    </div>
                                )}

                                {validation.checked && validation.valid && (
                                    <div className={`mt-3 rounded-md p-3 text-sm border ${gitValidation.valid ? "bg-emerald-500/5 border-emerald-500/20" : "bg-zinc-500/5 border-zinc-500/20"}`}>
                                        <div className="flex items-center gap-2 mb-1">
                                            {gitValidating ? (
                                                <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
                                            ) : gitValidation.valid ? (
                                                <Check className="h-4 w-4 text-emerald-500" />
                                            ) : (
                                                <AlertCircle className="h-4 w-4 text-zinc-400" />
                                            )}
                                            <span className={`font-semibold ${gitValidation.valid ? "text-emerald-600" : "text-zinc-400"}`}>
                                                {gitValidating ? "Checking GitHub repo..." : gitValidation.valid ? "Approved" : "No GitHub repo detected"}
                                            </span>
                                        </div>

                                        {gitValidation.valid ? (
                                            <div className="ml-6 space-y-2">
                                                {gitValidation.currentBranch && (
                                                    <p className="text-xs text-text-muted">
                                                        Current branch: <span className="font-semibold text-text-secondary">{gitValidation.currentBranch}</span>
                                                    </p>
                                                )}
                                                {!!gitValidation.branches?.length && (
                                                    <div className="flex flex-wrap gap-2">
                                                        {gitValidation.branches.map((branch) => (
                                                            <span
                                                                key={branch}
                                                                className="rounded-full border border-border-subtle bg-bg-app px-2 py-0.5 text-[11px] text-text-secondary"
                                                            >
                                                                {branch}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            gitValidation.error && (
                                                <p className="text-zinc-400 text-xs ml-6">{gitValidation.error}</p>
                                            )
                                        )}
                                    </div>
                                )}

                                <p className="mt-2 text-xs text-text-muted">
                                    The folder where your GitHub repository is stored. GitHub repos only.
                                </p>
                            </div>
                        </div>
                    </Panel>

                    <Panel className="p-0 overflow-hidden">
                        <div className="border-b border-border-subtle bg-bg-elevated/30 px-5 py-3">
                            <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                                <Github className="h-4 w-4 text-emerald-500" />
                                GitHub Repository Selector
                            </h2>
                        </div>

                        <div className="p-5 space-y-4">
                            <p className="text-xs text-text-muted">
                                Select a GitHub repository to clone locally and set as the active workspace.
                                {ghReposRoot ? ` Clones will be stored under ${ghReposRoot}.` : ""}
                            </p>

                            {ghError && (
                                <div className="rounded-md border border-zinc-500/30 bg-zinc-500/10 p-3 text-xs text-zinc-300">
                                    {ghError}
                                </div>
                            )}

                            <div className="flex flex-col gap-2">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                    <input
                                        type="text"
                                        value={ghSearch}
                                        onChange={(e) => setGhSearch(e.target.value)}
                                        placeholder="Filter repositories..."
                                        className="flex-1 rounded-md border border-border-subtle bg-bg-app px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/20 transition-all"
                                    />
                                    <Button
                                        variant="secondary"
                                        onClick={fetchGithubRepos}
                                        disabled={ghLoading}
                                    >
                                        {ghLoading ? "Loading..." : "Refresh"}
                                    </Button>
                                </div>

                                <select
                                    className="w-full rounded-md border border-border-subtle bg-bg-app px-3 py-2 text-sm text-text-primary focus:border-emerald-500 focus:outline-none"
                                    value={selectedRepoFullName}
                                    onChange={(e) => setSelectedRepoFullName(e.target.value)}
                                    disabled={ghLoading || ghRepos.length === 0}
                                >
                                    <option value="">Select a repository...</option>
                                    {filteredRepos.map((repo) => (
                                        <option key={repo.id} value={repo.full_name}>
                                            {repo.full_name} {repo.private ? "(private)" : ""}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-medium text-text-secondary">
                                    Or paste a GitHub repo URL / owner/name
                                </label>
                                <input
                                    type="text"
                                    value={customRepoInput}
                                    onChange={(e) => setCustomRepoInput(e.target.value)}
                                    placeholder="https://github.com/owner/repo or owner/repo"
                                    className="w-full rounded-md border border-border-subtle bg-bg-app px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/20 transition-all"
                                />
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <Button
                                    variant="primary"
                                    onClick={handleCloneRepo}
                                    disabled={cloning || (!selectedRepo && !customRepoInput.trim())}
                                >
                                    {cloning ? "Cloning..." : "Clone & Select"}
                                </Button>
                                {selectedRepo && (
                                    <a
                                        className="text-xs text-text-muted underline decoration-dashed"
                                        href={selectedRepo.html_url}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        View on GitHub
                                    </a>
                                )}
                            </div>
                        </div>
                    </Panel>
                </div>
            </div>
        </div>
    );
}
