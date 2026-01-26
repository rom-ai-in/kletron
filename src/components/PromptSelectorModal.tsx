import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Modal } from "./ui/Modal";
import { Skeleton } from "./ui/Skeleton";

interface PromptFile {
    name: string;
    path: string;
}

interface PromptFolder {
    name: string;
    path: string;
    children: PromptFolder[];
}

interface PromptSelectorModalProps {
    isOpen: boolean;
    onClose: () => void;
    promptFolders: PromptFolder[];
    onSelectPrompt: (path: string) => Promise<void>;
}

export function PromptSelectorModal({
    isOpen,
    onClose,
    promptFolders,
    onSelectPrompt,
}: PromptSelectorModalProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
    const [selectedPath, setSelectedPath] = useState<string | null>(null);
    const [loadingFiles, setLoadingFiles] = useState<Set<string>>(new Set());
    const [folderFiles, setFolderFiles] = useState<Map<string, PromptFile[]>>(new Map());
    const [previewContent, setPreviewContent] = useState<string>("");
    const [loadingPreview, setLoadingPreview] = useState(false);

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setSearchQuery("");
            setSelectedPath(null);
            setPreviewContent("");
        }
    }, [isOpen]);

    // Toggle folder expansion
    const toggleFolder = async (folderPath: string) => {
        const newExpanded = new Set(expandedFolders);
        if (newExpanded.has(folderPath)) {
            newExpanded.delete(folderPath);
        } else {
            newExpanded.add(folderPath);
            // Load files if not already loaded
            if (!folderFiles.has(folderPath)) {
                await loadFolderFiles(folderPath);
            }
        }
        setExpandedFolders(newExpanded);
    };

    // Load files for a folder
    const loadFolderFiles = useCallback(async (folderPath: string) => {
        setLoadingFiles((prev) => new Set(prev).add(folderPath));
        try {
            const res = await fetch(`/api/prompts/files?dir=${encodeURIComponent(folderPath)}`);
            if (res.ok) {
                const data = await res.json();
                const files = Array.isArray(data.files) ? data.files : [];
                setFolderFiles((prev) => new Map(prev).set(folderPath, files));
            }
        } finally {
            setLoadingFiles((prev) => {
                const next = new Set(prev);
                next.delete(folderPath);
                return next;
            });
        }
    }, []);

    // Load prompt preview
    const loadPreview = async (path: string) => {
        setLoadingPreview(true);
        try {
            const res = await fetch(`/api/prompts/file?path=${encodeURIComponent(path)}`);
            if (res.ok) {
                const data = await res.json();
                setPreviewContent(data.content || "");
            }
        } finally {
            setLoadingPreview(false);
        }
    };

    // Handle file selection
    const handleSelectFile = async (path: string) => {
        setSelectedPath(path);
        await loadPreview(path);
    };

    // Handle using the selected prompt
    const handleUsePrompt = async () => {
        if (selectedPath) {
            await onSelectPrompt(selectedPath);
            onClose();
        }
    };

    // Recursive filter function
    const filterFolders = (folders: PromptFolder[], query: string): PromptFolder[] => {
        return folders.reduce<PromptFolder[]>((acc, folder) => {
            const matchesSelf = folder.name.toLowerCase().includes(query) || folder.path.toLowerCase().includes(query);
            const filteredChildren = filterFolders(folder.children, query);

            if (matchesSelf || filteredChildren.length > 0) {
                acc.push({
                    ...folder,
                    children: filteredChildren
                });
            }
            return acc;
        }, []);
    };

    // Filter and sort folders based on search
    const filteredFolders = useMemo(() => {
        const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

        let folders = promptFolders;
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            folders = filterFolders(folders, query);
        }

        return [...folders].sort((a, b) => collator.compare(a.name, b.name));
    }, [promptFolders, searchQuery]);

    // Automatically expand and load files when searching
    useEffect(() => {
        if (!searchQuery) return;

        const pathsToLoad = new Set<string>();
        const traverse = (nodes: PromptFolder[]) => {
            for (const node of nodes) {
                pathsToLoad.add(node.path);
                traverse(node.children);
            }
        };
        traverse(filteredFolders);

        setExpandedFolders(prev => {
            const next = new Set(prev);
            for (const path of pathsToLoad) {
                next.add(path);
            }
            return next;
        });

        // Trigger fetches for any expanded folder that doesn't have files yet
        for (const path of pathsToLoad) {
            if (!folderFiles.has(path) && !loadingFiles.has(path)) {
                void loadFolderFiles(path);
            }
        }
    }, [filteredFolders, searchQuery, folderFiles, loadingFiles, loadFolderFiles]);

    // Keyboard navigation
    useEffect(() => {
        if (!isOpen) return;

        function handleKeyDown(e: KeyboardEvent) {
            if (e.key === "Escape") {
                onClose();
            } else if (e.key === "Enter" && selectedPath) {
                e.preventDefault();
                void handleUsePrompt();
            }
        }

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, selectedPath, onClose]);

    return (
        <Modal
            open={isOpen}
            onClose={onClose}
            title="Prompt Templates"
            subtitle="Select a prompt"
            fullHeight={true}
            footer={
                <div className="flex justify-end">
                    <button
                        onClick={() => void handleUsePrompt()}
                        disabled={!selectedPath}
                        className="rounded-md bg-state-selected px-6 py-2 text-sm font-medium text-text-primary transition hover:bg-state-active disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Use Prompt
                    </button>
                </div>
            }
        >
            <div className="flex h-full min-h-[500px] gap-0 overflow-hidden">
                {/* Left panel: Folder tree */}
                <div className="flex w-[280px] flex-shrink-0 flex-col border-r border-border-subtle bg-bg-surface pr-0">
                    <div className="p-3 border-b border-border-subtle">
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Search prompts..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full rounded bg-bg-elevated border border-border-subtle px-2 py-1.5 text-[11px] text-text-primary placeholder:text-text-muted focus:border-border-strong focus:outline-none transition-colors"
                                autoFocus
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery("")}
                                    className="absolute right-2 top-2 text-text-muted hover:text-text-primary"
                                >
                                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Folder tree */}
                    <div className="flex-1 overflow-y-auto scrollbar-elegant p-0">
                        <div className="space-y-0.5 p-2">
                            {filteredFolders.map((folder) => (
                                <FolderNode
                                    key={folder.path}
                                    folder={folder}
                                    isExpanded={expandedFolders.has(folder.path)}
                                    files={folderFiles.get(folder.path)}
                                    isLoadingFiles={loadingFiles.has(folder.path)}
                                    selectedPath={selectedPath}
                                    onToggle={(path) => void toggleFolder(path)}
                                    onSelectFile={(path) => void handleSelectFile(path)}
                                    folderFiles={folderFiles}
                                    loadingFiles={loadingFiles}
                                    expandedFolders={expandedFolders}
                                />
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right panel: Preview */}
                <div className="flex flex-1 flex-col bg-bg-surface">
                    <div className="flex h-[45px] flex-none items-center justify-between border-b border-border-subtle px-4">
                        <h3 className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Preview</h3>
                        {selectedPath && (
                            <span className="text-[10px] text-text-muted truncate max-w-[300px]" title={selectedPath}>{selectedPath}</span>
                        )}
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 scrollbar-elegant bg-bg-surface">
                        {loadingPreview ? (
                            <div className="space-y-3 opacity-50">
                                <Skeleton className="h-4 w-1/3" />
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-5/6" />
                                <div className="h-4" />
                                <Skeleton className="h-4 w-2/3" />
                            </div>
                        ) : previewContent ? (
                            <div className="prose prose-invert prose-xs max-w-none">
                                <pre className="text-[11px] leading-relaxed text-text-secondary whitespace-pre-wrap break-words font-mono bg-transparent p-0 m-0 border-none">
                                    {previewContent}
                                </pre>
                            </div>
                        ) : (
                            <div className="flex h-full items-center justify-center text-text-muted">
                                <p className="text-[11px] italic">Select a prompt to preview content</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Modal>
    );
}

interface FolderNodeProps {
    folder: PromptFolder;
    isExpanded: boolean;
    files?: PromptFile[];
    isLoadingFiles: boolean;
    selectedPath: string | null;
    folderFiles: Map<string, PromptFile[]>;
    loadingFiles: Set<string>;
    expandedFolders: Set<string>;
    onToggle: (path: string) => void;
    onSelectFile: (path: string) => void;
}

function FolderNode({
    folder,
    isExpanded,
    files,
    isLoadingFiles,
    selectedPath,
    folderFiles,
    loadingFiles,
    expandedFolders,
    onToggle,
    onSelectFile,
}: FolderNodeProps) {
    return (
        <div>
            <button
                onClick={() => onToggle(folder.path)}
                className="flex w-full items-center gap-1.5 rounded bg-transparent px-2 py-1 text-left text-[12px] transition-colors hover:bg-state-hover group"
            >
                <span className={`transition-transform duration-200 text-[10px] ${isExpanded ? "rotate-90" : ""} text-text-muted group-hover:text-text-primary`}>
                    ▸
                </span>
                <span className="font-medium text-text-primary truncate">
                    {isExpanded ? "📂" : "📁"} {folder.name}
                </span>
                {folder.children.length > 0 && (
                    <span className="ml-auto text-[9px] text-text-muted opacity-60">
                        {folder.children.length}
                    </span>
                )}
            </button>

            {isExpanded && (
                <div className="ml-3 mt-0.5 space-y-0.5 border-l border-border-subtle pl-1">
                    {isLoadingFiles ? (
                        <div className="space-y-1 px-2 pt-1 opacity-50">
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-2/3" />
                        </div>
                    ) : files && files.length > 0 ? (
                        [...files]
                            .sort((a, b) => new Intl.Collator(undefined, { numeric: true }).compare(a.name, b.name))
                            .map((file) => (
                                <button
                                    key={file.path}
                                    onClick={() => onSelectFile(file.path)}
                                    className={`flex w-full items-start gap-2 rounded px-2 py-1 text-left text-[12px] transition-colors ${selectedPath === file.path
                                        ? "bg-state-selected text-text-primary font-medium"
                                        : "text-text-secondary hover:bg-state-hover hover:text-text-primary"
                                        }`}
                                >
                                    <span className="mt-0.5 text-[10px] opacity-70">📄</span>
                                    <span className="truncate">{file.name}</span>
                                </button>
                            ))
                    ) : (
                        <p className="px-2 py-1 text-[10px] text-text-muted italic opacity-60">No files</p>
                    )}
                    {[...folder.children]
                        .sort((a, b) => new Intl.Collator(undefined, { numeric: true }).compare(a.name, b.name))
                        .map((child) => (
                            <FolderNode
                                key={child.path}
                                folder={child}
                                isExpanded={expandedFolders.has(child.path)}
                                files={folderFiles.get(child.path)}
                                isLoadingFiles={loadingFiles.has(child.path)}
                                selectedPath={selectedPath}
                                onToggle={onToggle}
                                onSelectFile={onSelectFile}
                                folderFiles={folderFiles}
                                loadingFiles={loadingFiles}
                                expandedFolders={expandedFolders}
                            />
                        ))}
                </div>
            )}
        </div>
    );
}
