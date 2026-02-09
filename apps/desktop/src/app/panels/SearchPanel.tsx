import { useState, useMemo } from "react";
import { Search, FileCode, X } from "lucide-react";

type FileEntry = { path: string; name: string; isDirectory: boolean };

interface SearchPanelProps {
  files: FileEntry[];
  onFileOpen?: (path: string) => void;
}

export function SearchPanel({ files, onFileOpen }: SearchPanelProps) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const lower = query.toLowerCase();
    return files
      .filter((f) => !f.isDirectory && f.path.toLowerCase().includes(lower))
      .slice(0, 50);
  }, [files, query]);

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-border-subtle">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search files…"
            className="w-full rounded-md bg-bg-surface border border-border-subtle py-1.5 pl-8 pr-8 text-xs text-text-primary placeholder:text-text-muted focus:border-border-strong focus:outline-none"
            autoFocus
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-1 scrollbar-elegant">
        {!query.trim() ? (
          <div className="px-3 py-8 text-xs text-text-muted text-center">Type to search across workspace files</div>
        ) : results.length === 0 ? (
          <div className="px-3 py-8 text-xs text-text-muted text-center">No files matching &quot;{query}&quot;</div>
        ) : (
          <>
            {results.map((file) => (
              <button key={file.path} type="button" onClick={() => onFileOpen?.(file.path)} className="flex items-center gap-2 w-full px-3 py-1.5 text-left hover:bg-state-hover transition-colors">
                <FileCode className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-text-primary truncate">{file.name}</div>
                  <div className="text-[10px] text-text-muted truncate">{file.path}</div>
                </div>
              </button>
            ))}
            <div className="px-3 py-1 text-[10px] text-text-muted">{results.length} result{results.length !== 1 ? "s" : ""}</div>
          </>
        )}
      </div>
    </div>
  );
}
