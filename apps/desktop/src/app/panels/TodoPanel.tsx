import { useState } from "react";
import { Plus, Check, Trash2, ListTodo, ChevronDown, ChevronRight } from "lucide-react";

export type TodoItem = {
  id: string;
  text: string;
  done: boolean;
  source?: "user" | "agent";
};

interface TodoPanelProps {
  items: TodoItem[];
  onAdd: (text: string) => void;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
}

export function TodoPanel({ items, onAdd, onToggle, onRemove }: TodoPanelProps) {
  const [newTask, setNewTask] = useState("");
  const [showDone, setShowDone] = useState(false);

  const pending = items.filter((i) => !i.done);
  const done = items.filter((i) => i.done);

  const handleSubmit = () => {
    if (!newTask.trim()) return;
    onAdd(newTask.trim());
    setNewTask("");
  };

  return (
    <div className="flex flex-col h-full">
      {/* Add task */}
      <div className="px-3 py-2 border-b border-border-subtle">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            placeholder="Add a task…"
            className="flex-1 rounded-md bg-bg-surface border border-border-subtle py-1.5 px-2 text-xs text-text-primary placeholder:text-text-muted focus:border-border-strong focus:outline-none"
            onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
          />
          <button type="button" onClick={handleSubmit} disabled={!newTask.trim()} className="p-1.5 rounded-md bg-bg-elevated border border-border-subtle text-text-muted hover:text-text-primary hover:bg-state-hover transition-colors disabled:opacity-40">
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-1 scrollbar-elegant">
        {pending.length === 0 && done.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-text-muted">
            <ListTodo className="w-8 h-8 mb-2 opacity-40" />
            <div className="text-xs">No tasks yet</div>
            <div className="text-[10px] mt-1">Add tasks to plan your work</div>
          </div>
        ) : (
          <>
            {pending.map((item) => (
              <div key={item.id} className="flex items-center gap-2 px-3 py-1.5 group hover:bg-state-hover transition-colors">
                <button type="button" onClick={() => onToggle(item.id)} className="w-4 h-4 rounded border border-border-subtle flex items-center justify-center hover:border-text-muted transition-colors flex-shrink-0" />
                <span className="flex-1 text-xs text-text-primary truncate">{item.text}</span>
                {item.source === "agent" && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-status-info-bg text-status-info-text">AI</span>}
                <button type="button" onClick={() => onRemove(item.id)} className="p-0.5 text-text-muted hover:text-status-error-text opacity-0 group-hover:opacity-100 transition-all">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}

            {done.length > 0 && (
              <>
                <button type="button" onClick={() => setShowDone(!showDone)} className="flex items-center gap-1 w-full px-3 py-1.5 mt-1 text-[11px] font-semibold uppercase tracking-wider text-text-muted hover:text-text-primary">
                  {showDone ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  Done ({done.length})
                </button>
                {showDone && done.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 px-3 py-1.5 group hover:bg-state-hover transition-colors opacity-60">
                    <button type="button" onClick={() => onToggle(item.id)} className="w-4 h-4 rounded border border-status-success flex items-center justify-center bg-status-success/20 flex-shrink-0">
                      <Check className="w-2.5 h-2.5 text-status-success-text" />
                    </button>
                    <span className="flex-1 text-xs text-text-muted line-through truncate">{item.text}</span>
                    <button type="button" onClick={() => onRemove(item.id)} className="p-0.5 text-text-muted hover:text-status-error-text opacity-0 group-hover:opacity-100 transition-all">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </div>

      <div className="px-3 py-1.5 border-t border-border-subtle text-[10px] text-text-muted">
        {pending.length} pending · {done.length} done
      </div>
    </div>
  );
}
