import React, { useState, useEffect, useMemo } from "react";
import { Modal } from "./ui/Modal";

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
    const loadFolderFiles = async (folderPath: string) => {
        setLoadingFiles((prev) => new Set(prev).add(folderPath));
        try {
            const res = await fetch(`/api/prompts/files?folder=${encodeURIComponent(folderPath)}`);
            if (res.ok) {
                const files = await res.json();
                setFolderFiles((prev) => new Map(prev).set(folderPath, files));
            }
        } finally {
            setLoadingFiles((prev) => {
                const next = new Set(prev);
                next.delete(folderPath);
                return next;
            });
        }
    };

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

    // Filter folders based on search
    const filteredFolders = useMemo(() => {
        if (!searchQuery) return promptFolders;
        const query = searchQuery.toLowerCase();
        return promptFolders.filter((folder) =>
            folder.path.toLowerCase().includes(query) || folder.name.toLowerCase().includes(query)
        );
    }, [promptFolders, searchQuery]);

    // Keyboard navigation
    useEffect(() => {
        if (!isOpen) return;

        function handleKeyDown(e: KeyboardEvent) {
            if (e.key === "Escape") {
                onClose();
            } else if (e.key === "Enter" && selectedPath) {
                e.preventDefault();
                handleUsePrompt();
            }
        }

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, selectedPath, onClose]);

    return (
        <Modal open={isOpen} onClose={onClose} title="Prompt Templates" subtitle="Select a prompt">
            <div className="flex h-[500px] gap-4">
                {/* Left panel: Folder tree */}
                <div className="flex w-1/2 flex-col gap-3">
                    {/* Search input */}
                    <input
                        type="text"
                        placeholder="Search prompts..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full rounded-md border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none transition focus:border-border-strong"
                        autoFocus
                    />

                    {/* Folder tree */}
                    <div className="flex-1 overflow-y-auto scrollbar-elegant">
                        <div className="space-y-1">
                            {filteredFolders.map((folder) => (
                                <FolderNode
                                    key={folder.path}
                                    folder={folder}
                                    isExpanded={expandedFolders.has(folder.path)}
                                    files={folderFiles.get(folder.path)}
                                    isLoadingFiles={loadingFiles.has(folder.path)}
                                    selectedPath={selectedPath}
                                    onToggle={toggleFolder}
                                    onSelectFile={handleSelectFile}
                                />
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right panel: Preview */}
                <div className="flex w-1/2 flex-col gap-3 border-l border-border-subtle pl-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">Preview</h3>
                        {selectedPath && (
                            <span className="text-[10px] font-mono text-text-muted">{selectedPath}</span>
                        )}
                    </div>
                    <div className="flex-1 overflow-y-auto rounded-lg border border-border-subtle bg-bg-surface p-3">
                        {loadingPreview ? (
                            <p className="text-sm text-text-muted">Loading preview...</p>
                        ) : previewContent ? (
                            <pre className="text-xs leading-relaxed text-text-primary whitespace-pre-wrap break-words">
                                {previewContent}
                            </pre>
                        ) : (
                            <p className="text-sm text-text-muted">Select a prompt to preview</p>
                        )}
                    </div>
                    <button
                        onClick={handleUsePrompt}
                        disabled={!selectedPath}
                        className="rounded-md bg-state-selected px-4 py-2 text-sm font-medium text-text-primary transition hover:bg-state-active disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Use Prompt
                    </button>
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
    onToggle: (path: string) => void;
    onSelectFile: (path: string) => void;
}

function FolderNode({
    folder,
    isExpanded,
    files,
    isLoadingFiles,
    selectedPath,
    onToggle,
    onSelectFile,
}: FolderNodeProps) {
    return (
        <div>
            <button
                onClick={() => onToggle(folder.path)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition hover:bg-state-hover"
            >
                <span className="text-text-muted">{isExpanded ? "▾" : "▸"}</span>
                <span className="font-medium text-text-primary">📁 {folder.name}</span>
                {folder.children.length > 0 && (
                    <span className="ml-auto text-xs text-text-muted">{folder.children.length}</span>
                )}
            </button>

            {isExpanded && (
                <div className="ml-4 mt-1 space-y-0.5">
                    {isLoadingFiles ? (
                        <p className="px-2 py-1 text-xs text-text-muted">Loading files...</p>
                    ) : files && files.length > 0 ? (
                        files.map((file) => (
                            <button
                                key={file.path}
                                onClick={() => onSelectFile(file.path)}
                                className={`flex w-full flex-col rounded-md px-2 py-1.5 text-left text-xs transition ${selectedPath === file.path
                                        ? "bg-state-selected border border-border-strong"
                                        : "hover:bg-state-hover"
                                    }`}
                            >
                                <span className="font-medium text-text-primary">{file.name}</span>
                                <span className="text-[10px] text-text-muted">{file.path}</span>
                            </button>
                        ))
                    ) : (
                        <p className="px-2 py-1 text-xs text-text-muted">No files</p>
                    )}
                    {folder.children.map((child) => (
                        <FolderNode
                            key={child.path}
                            folder={child}
                            isExpanded={isExpanded}
                            files={files}
                            isLoadingFiles={isLoadingFiles}
                            selectedPath={selectedPath}
                            onToggle={onToggle}
                            onSelectFile={onSelectFile}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
