"use client";

import { useEffect, useState } from "react";
import { Wrench, Search, Play, Loader2, AlertCircle } from "lucide-react";

import { Panel } from "@/src/components/ui/Panel";
import { Button } from "@/src/components/ui/Button";
import { Skeleton } from "@/src/components/ui/Skeleton";
import { Modal } from "@/src/components/ui/Modal";

type ToolMeta = {
    name: string;
    label: string;
    description: string;
    file: string;
    categories: string[];
};

const TOOL_EXAMPLES: Record<string, object> = {
    list_files: { path: "src", maxDepth: 2 },
    read_file: { filePath: "package.json" },
    search_code: { query: "auth", maxResults: 5 },
    repo_metrics: { path: "." },
    describe_structure: { path: "." },
    git_log: { maxCount: 5 },
    todo_search: { path: "src" },
    symbols_list: { path: "src/services", maxFiles: 5 },
    web_search: { query: "latest typescript features" },
    fetch_url: { url: "https://example.com" },
    github_api: { resource: "issues", owner: "facebook", repo: "react", perPage: 3 },
    read_file_range: { filePath: "package.json", startLine: 1, endLine: 10 },
    git_diff: { path: "." },
    find_symbol: { query: "User" },
    execute_bash: { command: "ls -la" },
    dependency_info: { path: "." },
    git_grep: { query: "TODO" },
    git_blame: { filePath: "package.json" },
    structural_search: { pattern: "console.log($$$)", lang: "javascript" },
    go_to_definition: { filePath: "src/index.ts", line: 10, column: 5 },
    references: { filePath: "src/index.ts", line: 10, column: 5 },
    find_references: { filePath: "src/index.ts", line: 10, column: 5 },
    bootstrap_context: { path: "src" },
    locate_ui_feature: { queries: ["login button"] },
    write_file: { filePath: "test.txt", content: "Hello world" },
    str_replace_editor: { action: "view", filePath: "package.json" },
    output_format: { text: "Sample output" },
    semantic_code_search: { query: "authentication logic" },
};

export default function ToolsConfigPage() {
    const [tools, setTools] = useState<ToolMeta[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    // Test Modal State
    const [testTool, setTestTool] = useState<ToolMeta | null>(null);
    const [testArgs, setTestArgs] = useState("{}");
    const [isRunning, setIsRunning] = useState(false);
    const [testResult, setTestResult] = useState<string | null>(null);
    const [testError, setTestError] = useState<string | null>(null);

    useEffect(() => {
        const fetchTools = async () => {
            try {
                const res = await fetch("/api/tools/list");
                if (res.ok) {
                    const data = await res.json();
                    setTools(Array.isArray(data) ? data : []);
                }
            } catch {
                // Ignore error
            } finally {
                setLoading(false);
            }
        };
        void fetchTools();
    }, []);

    const filteredTools = tools.filter((t) => {
        const q = searchQuery.toLowerCase();
        return (
            t.name.toLowerCase().includes(q) ||
            t.label.toLowerCase().includes(q) ||
            t.description.toLowerCase().includes(q) ||
            t.categories.some((c) => c.toLowerCase().includes(q))
        );
    });

    const openTestModal = (tool: ToolMeta) => {
        setTestTool(tool);
        const example = TOOL_EXAMPLES[tool.name];
        setTestArgs(example ? JSON.stringify(example, null, 2) : "{}");
        setTestResult(null);
        setTestError(null);
    };

    const runTest = async () => {
        if (!testTool) return;
        setIsRunning(true);
        setTestResult(null);
        setTestError(null);

        try {
            let parsedArgs = {};
            try {
                parsedArgs = JSON.parse(testArgs);
            } catch (e) {
                throw new Error("Invalid JSON arguments");
            }

            const res = await fetch("/api/tools/execute", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    toolName: testTool.name,
                    args: parsedArgs,
                }),
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "Execution failed");
            }
            setTestResult(data.result);
        } catch (err: any) {
            setTestError(err.message || "Unknown error");
        } finally {
            setIsRunning(false);
        }
    };

    return (
        <div className="flex h-full flex-col bg-bg-app">
            <div className="flex items-center justify-between border-b border-border-subtle bg-bg-surface px-6 py-4">
                <div className="flex items-center gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <Wrench className="h-5 w-5 text-text-muted" />
                            <h1 className="text-lg font-semibold text-text-primary">Tool Configuration</h1>
                        </div>
                        <p className="text-sm text-text-muted">
                            {tools.length} tools available for agents. Read-only view.
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-4 border-b border-border-subtle bg-bg-surface px-6 py-3">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                    <input
                        type="text"
                        placeholder="Search tools..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full rounded-md border border-border-subtle bg-bg-elevated pl-9 pr-3 py-1.5 text-sm text-text-primary placeholder-text-muted focus:border-border-strong focus:outline-none focus:ring-1 focus:ring-focus-ring"
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 scrollbar-elegant">
                {loading ? (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                            <Panel key={i} className="h-40 p-4 space-y-3">
                                <Skeleton className="h-6 w-1/2" />
                                <Skeleton className="h-4 w-3/4" />
                                <Skeleton className="h-4 w-full" />
                            </Panel>
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {filteredTools.map((tool) => (
                            <Panel key={tool.name} className="flex flex-col p-4 transition hover:border-border-strong group">
                                <div className="mb-2 flex items-start justify-between">
                                    <div className="min-w-0 pr-2">
                                        <h3 className="font-semibold text-text-primary truncate" title={tool.label}>{tool.label}</h3>
                                        <div className="font-mono text-xs text-text-muted truncate" title={tool.name}>{tool.name}</div>
                                    </div>
                                    <div className="flex shrink-0 gap-2">
                                        <Button size="xs" variant="secondary" onClick={() => openTestModal(tool)}>
                                            <Play className="h-3 w-3 mr-1" />
                                            Test
                                        </Button>
                                    </div>
                                </div>
                                <div className="mb-2 flex flex-wrap gap-1">
                                    {tool.categories.map((cat) => (
                                        <span
                                            key={cat}
                                            className="rounded bg-bg-elevated px-1.5 py-0.5 text-[10px] font-medium text-text-secondary border border-border-subtle"
                                        >
                                            {cat}
                                        </span>
                                    ))}
                                </div>
                                <p className="mb-4 flex-1 text-sm text-text-secondary line-clamp-3" title={tool.description}>
                                    {tool.description}
                                </p>
                                <div className="mt-auto border-t border-border-subtle pt-3">
                                    <div className="flex items-center gap-2 text-xs text-text-muted">
                                        <span className="font-mono truncate" title={tool.file}>
                                            {tool.file}
                                        </span>
                                    </div>
                                </div>
                            </Panel>
                        ))}
                        {filteredTools.length === 0 && (
                            <div className="col-span-full py-12 text-center text-text-muted">
                                No tools found matching &quot;{searchQuery}&quot;
                            </div>
                        )}
                    </div>
                )}
            </div>

            <Modal
                open={!!testTool}
                onClose={() => setTestTool(null)}
                title={`Test Tool: ${testTool?.label}`}
                subtitle={testTool?.description}
                footer={
                    <div className="flex justify-end gap-2">
                        <Button variant="secondary" onClick={() => setTestTool(null)}>Cancel</Button>
                        <Button onClick={() => void runTest()} disabled={isRunning}>
                            {isRunning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Run Tool
                        </Button>
                    </div>
                }
            >
                <div className="space-y-4">
                    <div>
                        <label className="mb-1 block text-xs font-semibold text-text-secondary">
                            Arguments (JSON)
                        </label>
                        <textarea
                            value={testArgs}
                            onChange={(e) => setTestArgs(e.target.value)}
                            className="h-32 w-full rounded-md border border-border-subtle bg-bg-elevated p-3 font-mono text-xs text-text-primary focus:border-border-strong focus:outline-none"
                            placeholder='{"path": "src"}'
                        />
                    </div>

                    {testError && (
                        <div className="rounded-md border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300 flex items-start gap-2">
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            <span className="whitespace-pre-wrap font-mono">{testError}</span>
                        </div>
                    )}

                    {testResult !== null && (
                        <div>
                            <label className="mb-1 block text-xs font-semibold text-text-secondary">
                                Result
                            </label>
                            <div className="max-h-64 cursor-text overflow-auto whitespace-pre-wrap rounded-md border border-border-subtle bg-bg-app p-3 font-mono text-xs text-text-secondary">
                                {testResult}
                            </div>
                        </div>
                    )}
                </div>
            </Modal>
        </div>
    );
}
