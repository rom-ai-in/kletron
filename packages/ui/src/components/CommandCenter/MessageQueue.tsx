'use client';

import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Pencil,
  ArrowUp,
  Trash2,
  Play,
  Check,
  X,
} from 'lucide-react';

export interface QueuedMessageItem {
  id: string;
  text: string;
  createdAt: string;
}

export interface MessageQueueProps {
  /** Queued messages to display */
  messages: QueuedMessageItem[];
  /** Called when user edits a queued message */
  onEdit?: (id: string, newText: string) => void;
  /** Called when user moves a message up in the queue */
  onMoveUp?: (id: string) => void;
  /** Called when user deletes a queued message */
  onDelete?: (id: string) => void;
  /** Called when user force-sends the next queued message immediately */
  onForceSend?: () => void;
  /** Whether the agent is currently streaming */
  streaming?: boolean;
  className?: string;
}

export function MessageQueue({
  messages,
  onEdit,
  onMoveUp,
  onDelete,
  onForceSend,
  streaming = false,
  className = '',
}: MessageQueueProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');

  if (messages.length === 0) return null;

  function startEdit(msg: QueuedMessageItem) {
    setEditingId(msg.id);
    setEditDraft(msg.text);
  }

  function saveEdit() {
    if (editingId && editDraft.trim()) {
      onEdit?.(editingId, editDraft.trim());
    }
    setEditingId(null);
    setEditDraft('');
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft('');
  }

  return (
    <div className={`border-t border-white/[0.06] bg-bg-surface/50 ${className}`}>
      {/* Header */}
      <button
        type="button"
        onClick={() => setCollapsed((p) => !p)}
        className="flex w-full items-center justify-between px-4 py-1.5 text-xs text-text-secondary hover:bg-state-hover/50 transition-colors"
      >
        <div className="flex items-center gap-1.5">
          {collapsed ? (
            <ChevronRight className="h-3 w-3 text-text-muted" />
          ) : (
            <ChevronDown className="h-3 w-3 text-text-muted" />
          )}
          <span className="font-medium">
            {messages.length} Queued
          </span>
        </div>
        {streaming && onForceSend && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-text-muted">Stop</span>
            <span className="text-[10px] text-text-muted">&#x2303;C</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onForceSend();
              }}
              className="ml-1 flex items-center gap-1 rounded-md border border-border-subtle bg-bg-elevated px-2 py-0.5 text-[10px] font-medium text-text-primary hover:bg-state-hover transition-colors"
            >
              <Play className="h-2.5 w-2.5" />
              Send Next
            </button>
          </div>
        )}
      </button>

      {/* Message list */}
      {!collapsed && (
        <div className="px-4 pb-2 space-y-1">
          {messages.map((msg, idx) => {
            const isEditing = editingId === msg.id;

            return (
              <div
                key={msg.id}
                className="group flex items-start gap-2 rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-state-hover/30"
              >
                {/* Queue position indicator */}
                <span className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border border-border-subtle text-[9px] text-text-muted">
                  {idx + 1}
                </span>

                {isEditing ? (
                  <div className="flex flex-1 items-center gap-1 min-w-0">
                    <input
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEdit();
                        if (e.key === 'Escape') cancelEdit();
                      }}
                      className="flex-1 min-w-0 rounded-md border border-border-subtle bg-bg-app px-2 py-1 text-xs text-text-primary outline-none focus:border-border-strong"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={saveEdit}
                      className="p-0.5 text-status-success-text hover:text-text-primary transition-colors"
                      title="Save"
                    >
                      <Check className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="p-0.5 text-text-muted hover:text-text-primary transition-colors"
                      title="Cancel"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="flex-1 min-w-0 truncate text-text-secondary">
                      {msg.text}
                    </span>

                    {/* Action buttons — visible on hover */}
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      {onEdit && (
                        <button
                          type="button"
                          onClick={() => startEdit(msg)}
                          className="p-0.5 rounded text-text-muted hover:text-text-primary hover:bg-state-hover transition-colors"
                          title="Edit message"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      )}
                      {onMoveUp && idx > 0 && (
                        <button
                          type="button"
                          onClick={() => onMoveUp(msg.id)}
                          className="p-0.5 rounded text-text-muted hover:text-text-primary hover:bg-state-hover transition-colors"
                          title="Move up"
                        >
                          <ArrowUp className="h-3 w-3" />
                        </button>
                      )}
                      {onDelete && (
                        <button
                          type="button"
                          onClick={() => onDelete(msg.id)}
                          className="p-0.5 rounded text-text-muted hover:text-status-error-text hover:bg-state-hover transition-colors"
                          title="Remove from queue"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
