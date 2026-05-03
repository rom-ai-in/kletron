/**
 * UI tool categories for agent transcript grouping (aligned with server tool classes where possible).
 */

export type ToolCategory = 'read' | 'write' | 'run' | 'search' | 'network' | 'other';

const READ: ReadonlySet<string> = new Set([
    'list_files',
    'read_file',
    'read_file_range',
    'describe_structure',
    'repo_metrics',
    'dependency_info',
    'bootstrap_context',
    'output_format',
    'git_log',
    'git_diff',
    'git_blame',
]);

const SEARCH: ReadonlySet<string> = new Set([
    'search_code',
    'semantic_code_search',
    'structural_search',
    'symbols_list',
    'find_symbol',
    'go_to_definition',
    'references',
    'git_grep',
    'todo_search',
]);

const NETWORK: ReadonlySet<string> = new Set(['web_search', 'fetch_url']);

const WRITE: ReadonlySet<string> = new Set(['write_file', 'str_replace_editor', 'write_todos']);

const RUN: ReadonlySet<string> = new Set(['execute_bash']);

/** Display order for collapsed summary (non-zero only). */
export const CATEGORY_ORDER: ToolCategory[] = ['read', 'search', 'write', 'run', 'network', 'other'];

const LABEL: Record<ToolCategory, string> = {
    read: 'Read',
    write: 'Write',
    run: 'Run',
    search: 'Search',
    network: 'Net',
    other: 'Other',
};

export function categoryLabel(cat: ToolCategory): string {
    return LABEL[cat];
}

/**
 * Strip MCP namespace: `someServer__read_file` → `read_file`
 */
function normalizeToolName(raw: string): string {
    const s = String(raw ?? '').trim().toLowerCase();
    if (!s) return '';
    const idx = s.indexOf('__');
    if (idx !== -1) return s.slice(idx + 2);
    return s;
}

export function categorizeToolName(toolName: string | undefined | null): ToolCategory {
    const name = normalizeToolName(toolName ?? '');
    if (!name) return 'other';
    if (READ.has(name)) return 'read';
    if (SEARCH.has(name)) return 'search';
    if (NETWORK.has(name)) return 'network';
    if (WRITE.has(name)) return 'write';
    if (RUN.has(name)) return 'run';
    if (name.includes('search') || name.includes('grep') || name.includes('symbol')) return 'search';
    if (name.includes('read') || name.includes('list') || name.includes('file')) return 'read';
    if (name.includes('write') || name.includes('patch') || name.includes('edit')) return 'write';
    if (name.includes('bash') || name.includes('shell') || name.includes('terminal') || name.includes('run_')) return 'run';
    if (name.includes('http') || name.includes('fetch') || name.includes('web')) return 'network';
    return 'other';
}

export function countToolCategories(toolNames: Array<string | undefined | null>): Record<ToolCategory, number> {
    const counts: Record<ToolCategory, number> = {
        read: 0,
        write: 0,
        run: 0,
        search: 0,
        network: 0,
        other: 0,
    };
    for (const n of toolNames) {
        counts[categorizeToolName(n)] += 1;
    }
    return counts;
}

/**
 * Build a short summary: "12 tools · Read 8 · Run 2"
 */
export function formatCategorySummary(
    total: number,
    counts: Record<ToolCategory, number>,
    options?: { maxParts?: number },
): string {
    const maxParts = options?.maxParts ?? 6;
    const parts: string[] = [];
    let n = 0;
    for (const cat of CATEGORY_ORDER) {
        const c = counts[cat];
        if (c <= 0) continue;
        parts.push(`${LABEL[cat]} ${c}`);
        n += 1;
        if (n >= maxParts) break;
    }
    const toolWord = total === 1 ? 'tool' : 'tools';
    if (parts.length === 0) return `${total} ${toolWord}`;
    return `${total} ${toolWord} · ${parts.join(' · ')}`;
}
