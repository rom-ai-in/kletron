"use client";

import React, { useState, useCallback } from 'react';
import { EditorProvider } from '@/src/context/EditorContext';
import { FileTree } from './FileTree';
import { Terminal } from './Terminal';
import { SlashPalette } from './SlashPalette';
import { AgentPanel } from './Agent/AgentPanel';
import { Bot, PanelRightClose, PanelRightOpen } from 'lucide-react';

import { FileViewer } from './Editor/FileViewer';
import { FileTabs } from './Editor/FileTabs';
import { DiffOverlay } from './Editor/DiffOverlay';

/**
 * EditorPage – top‑level page that composes the FileTree, MonacoEditor, Terminal and SlashPalette.
 */
export const EditorPage: React.FC = () => {
    return (
        <EditorProvider>
            <EditorPageContent />
        </EditorProvider>
    );
};

const EditorPageContent: React.FC = () => {
    const [selectedFile, setSelectedFile] = useState<string>('');
    const [fileContent, setFileContent] = useState<string>('');
    const [savedContent, setSavedContent] = useState<string>('');
    const [isDirty, setIsDirty] = useState(false);
    const [isTerminalOpen, setIsTerminalOpen] = useState(true);
    const [showDiff, setShowDiff] = useState(false);
    const [isAgentPanelOpen, setIsAgentPanelOpen] = useState(false);
    const [showDiffOverlay, setShowDiffOverlay] = useState(true); // Default to open for visibility
    const [drawerWidth, setDrawerWidth] = useState(() => {
        if (typeof window !== 'undefined') {
            const savedWidth = localStorage.getItem('agentDrawerWidth');
            return savedWidth ? parseInt(savedWidth, 10) : 500;
        }
        return 500;
    });

    // Load file content when a file is selected
    const loadFile = useCallback(async (path: string) => {
        try {
            const response = await fetch(`/api/fs/read?path=${encodeURIComponent(path)}`);
            if (!response.ok) throw new Error("Failed to read file");

            const data = await response.json();
            setFileContent(data.content);
            setSavedContent(data.content);
            setSelectedFile(path);
            setIsDirty(false);
        } catch (e) {
            console.error(e);
            alert("Could not load file");
        }
    }, []);

    const handleSave = useCallback(async (content: string) => {
        try {
            const response = await fetch('/api/fs/write', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: selectedFile, content })
            });

            if (!response.ok) throw new Error("Failed to save");

            setSavedContent(content);
            setIsDirty(false);
            console.info('Saved', selectedFile);
        } catch (e) {
            console.error(e);
            alert("Failed to save file");
        }
    }, [selectedFile]);

    return (
        <div className="flex h-full w-full bg-bg-app text-text-primary overflow-hidden font-sans">
            <SlashPalette />

            {/* File Tree (Left) */}
            <div className="w-64 flex-shrink-0 border-r border-border-subtle flex flex-col bg-bg-surface">
                <FileTree onSelect={(path) => { void loadFile(path); }} currentFile={selectedFile} />
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0">

                {/* File Tab / Header */}
                <div className="h-9 border-b border-border-subtle flex items-center px-4 bg-bg-surface justify-between">
                    <div className="flex-1 min-w-0">
                        <FileTabs currentFile={selectedFile} />
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                            onClick={() => setShowDiffOverlay(!showDiffOverlay)}
                            className={`text-xs px-2 py-1 rounded transition-colors ${showDiffOverlay ? 'bg-state-selected text-text-primary' : 'text-text-muted hover:bg-state-hover hover:text-text-primary'}`}
                        >
                            {showDiffOverlay ? 'Hide Agent Diffs' : 'Agent Diffs'}
                        </button>
                        <button
                            onClick={() => setShowDiff(!showDiff)}
                            className={`text-xs px-2 py-1 rounded transition-colors ${showDiff ? 'bg-state-selected text-text-primary' : 'text-text-muted hover:bg-state-hover hover:text-text-primary'}`}
                        >
                            {showDiff ? 'Hide Editor Diff' : 'Editor Diff'}
                        </button>
                        <button
                            onClick={() => setIsAgentPanelOpen(!isAgentPanelOpen)}
                            className={`text-xs p-1.5 rounded transition-colors ${isAgentPanelOpen ? 'bg-state-selected text-text-primary' : 'text-text-muted hover:bg-state-hover hover:text-text-primary'}`}
                            title={isAgentPanelOpen ? "Close Agent Panel" : "Open Agent Panel"}
                        >
                            {isAgentPanelOpen ? <PanelRightClose className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                        </button>
                    </div>
                </div>

                {/* Editor Container + Diff Overlay Split */}
                <div className="flex-1 flex min-h-0 relative">
                    <div className="flex-1 flex flex-col min-w-0">
                        {/* Top: Monaco Editor */}
                        <div className={`w-full relative ${isTerminalOpen ? 'h-[70%]' : 'h-full'} transition-all duration-300`}>
                            {selectedFile ? (
                                <FileViewer
                                    fileId={selectedFile}
                                    fileContent={fileContent}
                                    savedContent={savedContent}
                                    showDiff={showDiff}
                                    onSave={(content) => { void handleSave(content); }}
                                    onChange={(val) => {
                                        setFileContent(val);
                                        setIsDirty(val !== savedContent);
                                    }}
                                />
                            ) : (
                                <div className="flex items-center justify-center h-full text-text-muted text-sm">
                                    Select a file to edit
                                </div>
                            )}
                        </div>

                        {/* Bottom: Terminal */}
                        {isTerminalOpen && (
                            <div className="h-[30%] w-full bg-black border-t border-border-subtle p-2 overflow-hidden">
                                <Terminal />
                            </div>
                        )}
                    </div>

                    {/* Right: Diff Overlay (Split View) */}
                    {showDiffOverlay && selectedFile && (
                        <div className="w-80 border-l border-border-subtle bg-bg-surface flex flex-col animate-in slide-in-from-right-10 duration-200">
                            <div className="p-2 border-b border-border-subtle text-xs font-bold text-text-muted uppercase tracking-wider flex items-center justify-between">
                                <span>Pending Agent Changes</span>
                                <span className="text-[10px] bg-red-500/10 text-red-400 px-1 rounded">Beta</span>
                            </div>
                            <DiffOverlay fileId={selectedFile} />
                        </div>
                    )}
                </div>

                {/* Status Bar Removed */}
            </div>


            {/* Agent Panel (Right) - Resizable */}
            {isAgentPanelOpen && (
                <div
                    className="flex-shrink-0 border-l-2 border-zinc-800 flex flex-col bg-bg-surface relative group"
                    style={{ width: `${drawerWidth}px` }}
                >
                    {/* Resize Handle */}
                    <div
                        className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-sky-500/50 transition-colors z-10"
                        onMouseDown={(e) => {
                            e.preventDefault();
                            const startX = e.clientX;
                            const startWidth = drawerWidth;

                            const handleMouseMove = (e: MouseEvent) => {
                                const newWidth = Math.max(300, Math.min(800, startWidth - (e.clientX - startX)));
                                setDrawerWidth(newWidth);
                                localStorage.setItem('agentDrawerWidth', newWidth.toString());
                            };

                            const handleMouseUp = () => {
                                document.removeEventListener('mousemove', handleMouseMove);
                                document.removeEventListener('mouseup', handleMouseUp);
                            };

                            document.addEventListener('mousemove', handleMouseMove);
                            document.addEventListener('mouseup', handleMouseUp);
                        }}
                    >
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-12 bg-zinc-700 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <AgentPanel onClose={() => setIsAgentPanelOpen(false)} />
                </div>
            )}
        </div>
    );
};

export default EditorPage;

