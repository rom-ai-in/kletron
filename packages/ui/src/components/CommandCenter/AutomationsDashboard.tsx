'use client';

import React, { useState } from 'react';
import {
  Plus,
  Play,
  Pause,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Trash2,
  Calendar,
  RefreshCw,
} from 'lucide-react';
import { Button } from '../design-system';

export type AutomationStatus = 'active' | 'paused' | 'completed' | 'failed';

export interface Automation {
  id: string;
  name: string;
  description?: string;
  schedule?: string;
  status: AutomationStatus;
  lastRunAt?: string;
  nextRunAt?: string;
}

export interface AutomationsDashboardProps {
  automations: Automation[];
  onAdd?: (name: string, description: string, schedule: string) => void;
  onRemove?: (id: string) => void;
  onToggle?: (id: string) => void;
  onRunNow?: (id: string) => void;
  onViewResults?: (id: string) => void;
  loading?: boolean;
  className?: string;
}

function StatusIcon({ status }: { status: AutomationStatus }) {
  switch (status) {
    case 'active':
      return <Play className="h-3.5 w-3.5 text-status-success-text" />;
    case 'paused':
      return <Pause className="h-3.5 w-3.5 text-text-muted" />;
    case 'completed':
      return <CheckCircle2 className="h-3.5 w-3.5 text-status-success-text" />;
    case 'failed':
      return <XCircle className="h-3.5 w-3.5 text-status-error-text" />;
    default:
      return <Clock className="h-3.5 w-3.5 text-text-muted" />;
  }
}

function formatRelativeTime(iso?: string | null): string {
  if (!iso) return 'Never';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Never';
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const SCHEDULE_PRESETS = [
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Every 6 hours', value: '0 */6 * * *' },
  { label: 'Daily at 9 AM', value: '0 9 * * *' },
  { label: 'Weekly on Monday', value: '0 9 * * 1' },
  { label: 'Custom', value: '' },
];

export function AutomationsDashboard({
  automations,
  onAdd,
  onRemove,
  onToggle,
  onRunNow,
  onViewResults,
  loading = false,
  className = '',
}: AutomationsDashboardProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newSchedule, setNewSchedule] = useState('0 9 * * *');
  const [customSchedule, setCustomSchedule] = useState('');
  const [selectedPreset, setSelectedPreset] = useState('0 9 * * *');

  function handleAdd() {
    if (!newName.trim()) return;
    const schedule = selectedPreset === '' ? customSchedule : selectedPreset;
    onAdd?.(newName.trim(), newDescription.trim(), schedule);
    setNewName('');
    setNewDescription('');
    setNewSchedule('0 9 * * *');
    setSelectedPreset('0 9 * * *');
    setCustomSchedule('');
    setShowAdd(false);
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-text-muted" />
          <span className="text-sm font-semibold text-text-primary">Automations</span>
          <span className="text-[10px] text-text-muted">({automations.length})</span>
        </div>
      </div>

      {/* Automation List */}
      {automations.map((automation) => (
        <div
          key={automation.id}
          className="rounded-md border border-border-subtle bg-bg-surface/50 overflow-hidden"
        >
          <div className="flex items-center justify-between px-3 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <StatusIcon status={automation.status} />
              <div className="min-w-0">
                <div className="text-xs font-medium text-text-primary truncate">{automation.name}</div>
                {automation.description && (
                  <div className="text-[10px] text-text-muted truncate">{automation.description}</div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0 ml-2">
              {onRunNow && (
                <button
                  type="button"
                  onClick={() => onRunNow(automation.id)}
                  className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-state-hover transition-colors"
                  title="Run now"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              )}
              {onToggle && (
                <button
                  type="button"
                  onClick={() => onToggle(automation.id)}
                  className={`p-1 rounded transition-colors ${
                    automation.status === 'active'
                      ? 'text-status-success-text hover:bg-state-hover'
                      : 'text-text-muted hover:bg-state-hover'
                  }`}
                  title={automation.status === 'active' ? 'Pause' : 'Resume'}
                >
                  {automation.status === 'active' ? (
                    <Pause className="w-3.5 h-3.5" />
                  ) : (
                    <Play className="w-3.5 h-3.5" />
                  )}
                </button>
              )}
              {onRemove && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Remove automation "${automation.name}"?`)) {
                      onRemove(automation.id);
                    }
                  }}
                  className="p-1 rounded text-text-muted hover:text-status-error-text hover:bg-state-hover transition-colors"
                  title="Remove"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4 px-3 py-1.5 border-t border-border-subtle bg-bg-elevated/30 text-[10px] text-text-muted">
            {automation.schedule && (
              <span className="flex items-center gap-1">
                <Clock className="w-2.5 h-2.5" /> {automation.schedule}
              </span>
            )}
            <span>Last: {formatRelativeTime(automation.lastRunAt)}</span>
            {automation.nextRunAt && <span>Next: {formatRelativeTime(automation.nextRunAt)}</span>}
          </div>
        </div>
      ))}

      {automations.length === 0 && !showAdd && !loading && (
        <div className="rounded-md border border-border-subtle px-3 py-6 text-xs text-text-muted text-center">
          No automations configured. Create one to run tasks on a schedule.
        </div>
      )}

      {loading && (
        <div className="rounded-md border border-border-subtle px-3 py-4 text-xs text-text-muted text-center">
          Loading automations...
        </div>
      )}

      {/* Add Form */}
      {showAdd ? (
        <div className="rounded-md border border-border-strong bg-bg-surface p-3 space-y-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Automation name (e.g. Daily issue triage)"
            className="w-full rounded-md bg-bg-app border border-border-subtle px-2 py-1 text-xs text-text-primary placeholder:text-text-muted focus:border-border-strong focus:outline-none"
            autoFocus
          />
          <textarea
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="Describe what this automation should do..."
            rows={2}
            className="w-full rounded-md bg-bg-app border border-border-subtle px-2 py-1 text-xs text-text-primary placeholder:text-text-muted focus:border-border-strong focus:outline-none resize-none"
          />
          <div>
            <label className="text-[10px] font-medium text-text-muted uppercase tracking-wider">Schedule</label>
            <div className="flex flex-wrap gap-1 mt-1">
              {SCHEDULE_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setSelectedPreset(preset.value)}
                  className={`px-2 py-1 rounded text-[10px] border transition-colors ${
                    selectedPreset === preset.value
                      ? 'border-border-strong bg-state-selected text-text-primary'
                      : 'border-border-subtle text-text-muted hover:text-text-primary hover:bg-state-hover'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            {selectedPreset === '' && (
              <input
                value={customSchedule}
                onChange={(e) => setCustomSchedule(e.target.value)}
                placeholder="Cron expression (e.g. 0 9 * * 1-5)"
                className="mt-1 w-full rounded-md bg-bg-app border border-border-subtle px-2 py-1 text-xs text-text-primary placeholder:text-text-muted focus:border-border-strong focus:outline-none font-mono"
              />
            )}
          </div>
          <div className="flex items-center justify-end gap-2 pt-1">
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
              disabled={!newName.trim()}
              className="rounded-md bg-bg-elevated border border-border-strong px-3 py-1 text-xs text-text-primary hover:bg-state-active disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create Automation
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
          Add Automation
        </button>
      )}
    </div>
  );
}
