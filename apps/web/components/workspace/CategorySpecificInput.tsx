import React from "react";
import { normalizeToWorkModeId } from "@kletron/shared/workMode";

interface CategorySpecificInputProps {
  category: string;
  onSubmit: (message: string) => void;
}

export const CategorySpecificInput = ({ category, onSubmit }: CategorySpecificInputProps) => {
  const [inputValue, setInputValue] = React.useState("");
  const mode = normalizeToWorkModeId(category);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      onSubmit(inputValue);
      setInputValue("");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 border-t border-subtle">
      {mode === "code" && (
        <CodeModeInput value={inputValue} onChange={setInputValue} onSubmit={handleSubmit} />
      )}
      {mode === "work" && (
        <WorkModeInput value={inputValue} onChange={setInputValue} onSubmit={handleSubmit} />
      )}
    </form>
  );
};

interface InputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

const CodeModeInput = ({ value, onChange, onSubmit: _onSubmit }: InputProps) => {
  return (
    <div className="space-y-2">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Ask about code… e.g. “How do I implement authentication?”"
        className="w-full min-h-[80px] max-h-[200px] p-3 bg-surface rounded-lg border border-subtle focus:outline-none focus:ring-2 focus:ring-primary resize-y"
      />
      <div className="flex justify-between items-center">
        <button type="button" className="text-sm text-subtle hover:text-foreground">
          ⌘K
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          Send
        </button>
      </div>
    </div>
  );
};

const WorkModeInput = ({ value, onChange, onSubmit: _onSubmit }: InputProps) => {
  return (
    <div className="space-y-2">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Research, write, or plan… e.g. “Summarize this quarter’s priorities”"
        className="w-full min-h-[80px] max-h-[200px] p-3 bg-surface rounded-lg border border-subtle focus:outline-none focus:ring-2 focus:ring-primary resize-y"
      />
      <div className="flex justify-end">
        <button
          type="submit"
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          Send
        </button>
      </div>
    </div>
  );
};
