'use client';

import React, { useState } from 'react';
import { Plus, Trash2, Power, AlertCircle, CheckCircle, XCircle, Pencil, Check, X } from 'lucide-react';

export interface MCPServer {
    id: string;
    name: string;
    command: string;
    args?: string[];
    env?: Record<string, string>;
    enabled: boolean;
    status: 'connected' | 'disconnected' | 'error';
}

export interface MCPServerInput {
    name: string;
    command: string;
    args?: string[];
    env?: Record<string, string>;
}

export interface MCPServerConfigProps {
    servers: MCPServer[];
    onAdd?: (server: MCPServerInput) => void;
    onRemove?: (serverId: string) => void;
    onToggle?: (serverId: string, enabled: boolean) => void;
    onEdit?: (serverId: string, config: MCPServerInput) => void;
    className?: string;
}

function StatusDot({ status }: { status: MCPServer['status'] }) {
    const colors = {
        connected: 'bg-status-success',
        disconnected: 'bg-text-muted',
        error: 'bg-status-error',
    };
    return <span className={`w-2 h-2 rounded-full ${colors[status]}`} />;
}

export function MCPServerConfig({
    servers,
    onAdd,
    onRemove,
    onToggle,
    onEdit,
    className = '',
}: MCPServerConfigProps) {
    const [showAdd, setShowAdd] = useState(false);
    const [newName, setNewName] = useState('');
    const [newCommand, setNewCommand] = useState('');
    const [newArgs, setNewArgs] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editCommand, setEditCommand] = useState('');
    const [editArgs, setEditArgs] = useState('');

    function startEditing(server: MCPServer) {
        setEditingId(server.id);
        setEditName(server.name);
        setEditCommand(server.command);
        setEditArgs(server.args?.join(' ') || '');
    }

    function saveEdit() {
        if (!editingId || !editName.trim() || !editCommand.trim()) return;
        onEdit?.(editingId, {
            name: editName.trim(),
            command: editCommand.trim(),
            args: editArgs.trim() ? editArgs.split(' ') : undefined,
        });
        setEditingId(null);
    }

    function cancelEdit() {
        setEditingId(null);
    }

    function handleAdd() {
        if (!newName.trim() || !newCommand.trim()) return;
        onAdd?.({
            name: newName.trim(),
            command: newCommand.trim(),
            args: newArgs.trim() ? newArgs.split(' ') : undefined,
        });
        setNewName('');
        setNewCommand('');
        setNewArgs('');
        setShowAdd(false);
    }

    return (
        <div className={`space-y-2 ${className}`}>
            {servers.map(server => (
                <div key={server.id}>
                    {editingId === server.id ? (
                        <div className="rounded-md border border-border-strong bg-bg-surface p-3 space-y-2">
                            <input
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                placeholder="Server name"
                                className="w-full rounded-md bg-bg-app border border-border-subtle px-2 py-1 text-xs text-text-primary placeholder:text-text-muted focus:border-border-strong focus:outline-none"
                            />
                            <input
                                value={editCommand}
                                onChange={(e) => setEditCommand(e.target.value)}
                                placeholder="Command"
                                className="w-full rounded-md bg-bg-app border border-border-subtle px-2 py-1 text-xs text-text-primary placeholder:text-text-muted focus:border-border-strong focus:outline-none font-mono"
                            />
                            <input
                                value={editArgs}
                                onChange={(e) => setEditArgs(e.target.value)}
                                placeholder="Arguments (space-separated)"
                                className="w-full rounded-md bg-bg-app border border-border-subtle px-2 py-1 text-xs text-text-primary placeholder:text-text-muted focus:border-border-strong focus:outline-none font-mono"
                            />
                            <div className="flex items-center justify-end gap-2">
                                <button type="button" onClick={cancelEdit} className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-state-hover transition-colors" title="Cancel">
                                    <X className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    type="button"
                                    onClick={saveEdit}
                                    disabled={!editName.trim() || !editCommand.trim()}
                                    className="p-1 rounded text-status-success-text hover:bg-state-hover transition-colors disabled:opacity-50"
                                    title="Save"
                                >
                                    <Check className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between rounded-md border border-border-subtle bg-bg-surface/50 px-3 py-2">
                            <div className="flex items-center gap-2 min-w-0">
                                <StatusDot status={server.status} />
                                <div className="min-w-0">
                                    <div className="text-xs font-medium text-text-primary truncate">{server.name}</div>
                                    <div className="text-[10px] text-text-muted truncate font-mono">{server.command}</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                {onEdit && (
                                    <button
                                        type="button"
                                        onClick={() => startEditing(server)}
                                        className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-state-hover transition-colors"
                                        title="Edit"
                                    >
                                        <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => onToggle?.(server.id, !server.enabled)}
                                    className={`p-1 rounded transition-colors ${server.enabled ? 'text-status-success-text hover:bg-state-hover' : 'text-text-muted hover:bg-state-hover'}`}
                                    title={server.enabled ? 'Disable' : 'Enable'}
                                >
                                    <Power className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (window.confirm(`Remove "${server.name}"?`)) {
                                            onRemove?.(server.id);
                                        }
                                    }}
                                    className="p-1 rounded text-text-muted hover:text-status-error-text hover:bg-state-hover transition-colors"
                                    title="Remove"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            ))}

            {servers.length === 0 && !showAdd && (
                <div className="rounded-md border border-border-subtle px-3 py-4 text-xs text-text-muted text-center">
                    No MCP servers configured.
                </div>
            )}

            {showAdd ? (
                <div className="rounded-md border border-border-strong bg-bg-surface p-3 space-y-2">
                    <input
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="Server name"
                        className="w-full rounded-md bg-bg-app border border-border-subtle px-2 py-1 text-xs text-text-primary placeholder:text-text-muted focus:border-border-strong focus:outline-none"
                    />
                    <input
                        value={newCommand}
                        onChange={(e) => setNewCommand(e.target.value)}
                        placeholder="Command (e.g., npx @modelcontextprotocol/server-github)"
                        className="w-full rounded-md bg-bg-app border border-border-subtle px-2 py-1 text-xs text-text-primary placeholder:text-text-muted focus:border-border-strong focus:outline-none font-mono"
                    />
                    <input
                        value={newArgs}
                        onChange={(e) => setNewArgs(e.target.value)}
                        placeholder="Arguments (space-separated)"
                        className="w-full rounded-md bg-bg-app border border-border-subtle px-2 py-1 text-xs text-text-primary placeholder:text-text-muted focus:border-border-strong focus:outline-none font-mono"
                    />
                    <div className="flex items-center justify-end gap-2">
                        <button
                            type="button"
                            onClick={() => setShowAdd(false)}
                            className="px-3 py-1 text-xs text-text-muted hover:text-text-primary"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleAdd}
                            disabled={!newName.trim() || !newCommand.trim()}
                            className="rounded-md bg-bg-elevated border border-border-strong px-3 py-1 text-xs text-text-primary hover:bg-state-active disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Add Server
                        </button>
                    </div>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => setShowAdd(true)}
                    className="flex items-center gap-2 w-full rounded-md border border-dashed border-border-strong px-3 py-2 text-xs text-text-muted hover:text-text-primary hover:border-border-strong transition-colors"
                >
                    <Plus className="w-3.5 h-3.5" />
                    Add MCP Server
                </button>
            )}
        </div>
    );
}
