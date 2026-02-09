'use client';

import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  Power,
  Pencil,
  ExternalLink,
  Wrench,
  Palette,
  Layers,
  Cloud,
  Settings2,
} from 'lucide-react';

export interface Skill {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  category?: 'design' | 'project-management' | 'deployment' | 'custom';
}

export interface SkillsManagerProps {
  skills: Skill[];
  onAdd?: (name: string) => void;
  onRemove?: (skillId: string) => void;
  onToggle?: (skillId: string, enabled: boolean) => void;
  onEdit?: (skillId: string) => void;
  className?: string;
}

const categoryIcons: Record<string, React.ReactNode> = {
  design: <Palette className="h-3.5 w-3.5" />,
  'project-management': <Layers className="h-3.5 w-3.5" />,
  deployment: <Cloud className="h-3.5 w-3.5" />,
  custom: <Settings2 className="h-3.5 w-3.5" />,
};

const categoryLabels: Record<string, string> = {
  design: 'Design',
  'project-management': 'Project Management',
  deployment: 'Deployment',
  custom: 'Custom',
};

export function SkillsManager({
  skills,
  onAdd,
  onRemove,
  onToggle,
  onEdit,
  className = '',
}: SkillsManagerProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');

  function handleAdd() {
    if (!newName.trim()) return;
    onAdd?.(newName.trim());
    setNewName('');
    setShowAdd(false);
  }

  // Group skills by category
  const grouped = skills.reduce<Record<string, Skill[]>>((acc, skill) => {
    const cat = skill.category ?? 'custom';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(skill);
    return acc;
  }, {});

  return (
    <div className={`space-y-3 ${className}`}>
      {Object.entries(grouped).map(([category, categorySkills]) => (
        <div key={category}>
          <div className="flex items-center gap-1.5 px-1 mb-1.5">
            <span className="text-text-muted">{categoryIcons[category] ?? <Wrench className="h-3.5 w-3.5" />}</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              {categoryLabels[category] ?? category}
            </span>
          </div>
          <div className="space-y-1">
            {categorySkills.map((skill) => (
              <div
                key={skill.id}
                className="flex items-center justify-between rounded-md border border-border-subtle bg-bg-surface/50 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-text-primary">{skill.name}</div>
                  <div className="text-[10px] text-text-muted truncate">{skill.description}</div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                  {onEdit && (
                    <button
                      type="button"
                      onClick={() => onEdit(skill.id)}
                      className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-state-hover transition-colors"
                      title="Edit skill"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {onToggle && (
                    <button
                      type="button"
                      onClick={() => onToggle(skill.id, !skill.enabled)}
                      className={`p-1 rounded transition-colors ${
                        skill.enabled
                          ? 'text-status-success-text hover:bg-state-hover'
                          : 'text-text-muted hover:bg-state-hover'
                      }`}
                      title={skill.enabled ? 'Disable' : 'Enable'}
                    >
                      <Power className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {onRemove && (
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Remove skill "${skill.name}"?`)) {
                          onRemove(skill.id);
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
            ))}
          </div>
        </div>
      ))}

      {skills.length === 0 && !showAdd && (
        <div className="rounded-md border border-border-subtle px-3 py-4 text-xs text-text-muted text-center">
          No skills configured. Add skills to extend Codex capabilities.
        </div>
      )}

      {showAdd ? (
        <div className="rounded-md border border-border-strong bg-bg-surface p-3 space-y-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd();
              if (e.key === 'Escape') setShowAdd(false);
            }}
            placeholder="Skill name (e.g. figma, linear, vercel)"
            className="w-full rounded-md bg-bg-app border border-border-subtle px-2 py-1 text-xs text-text-primary placeholder:text-text-muted focus:border-border-strong focus:outline-none"
            autoFocus
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
              disabled={!newName.trim()}
              className="rounded-md bg-bg-elevated border border-border-strong px-3 py-1 text-xs text-text-primary hover:bg-state-active disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create Skill
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
          Add Skill
        </button>
      )}
    </div>
  );
}
