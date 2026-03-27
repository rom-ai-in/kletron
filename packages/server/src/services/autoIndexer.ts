import { EventEmitter } from "node:events";
import fs from "node:fs";
import chokidar, { type FSWatcher } from "chokidar";

const formatterEmitter = new EventEmitter();

type WorkspaceWatcher = {
    watcher: FSWatcher | null;
    dirtyFiles: Set<string>;
    isWatching: boolean;
    root: string;
};

const watcherKey = Symbol.for("kletron.indexer.watchers");
if (!(globalThis as any)[watcherKey]) {
    (globalThis as any)[watcherKey] = new Map<string, WorkspaceWatcher>();
}

const watcherMap: Map<string, WorkspaceWatcher> = (globalThis as any)[watcherKey];

function getWorkspaceWatcher(workspaceId: string, root: string): WorkspaceWatcher {
    const existing = watcherMap.get(workspaceId);
    if (existing) return existing;
    const watcher: WorkspaceWatcher = {
        watcher: null,
        dirtyFiles: new Set<string>(),
        isWatching: false,
        root,
    };
    watcherMap.set(workspaceId, watcher);
    return watcher;
}

export function startWatcher(workspaceId: string, root: string) {
    if (!fs.existsSync(root)) {
        console.warn(`[AutoIndex] Watcher not started for missing path: ${root}`);
        return;
    }
    const state = getWorkspaceWatcher(workspaceId, root);
    if (state.isWatching && state.root === root) return;
    if (state.watcher) {
        void state.watcher.close();
    }

    state.root = root;
    state.watcher = chokidar.watch(root, {
        ignored: [
            /(^|[\/\\])\../, // ignore dotfiles
            /node_modules/,
            /\.next/,
            /dist/,
            /\.git/
        ],
        persistent: true,
        ignoreInitial: true, // Don't fire "add" events for initial scan
        awaitWriteFinish: {
            stabilityThreshold: 1000,
            pollInterval: 100
        }
    });

    const handleFile = (path: string) => {
        // Only track relevant extensions
        if (path.match(/\.(ts|tsx|js|jsx|md|txt)$/)) {
            // console.log(`[Watcher] File dirty: ${path}`);
            state.dirtyFiles.add(path);
        }
    };

    state.watcher.on("add", handleFile);
    state.watcher.on("change", handleFile);
    state.watcher.on("unlink", handleFile);

    state.watcher.on("ready", () => {
        console.log(`[AutoIndex] Watcher ready on ${root}`);
        state.isWatching = true;
    });

    state.watcher.on("error", (error: unknown) => {
        console.error(`[AutoIndex] Watcher error: ${String(error)}`);
    });
}

export function getDirtyFiles(workspaceId: string): string[] {
    const state = watcherMap.get(workspaceId);
    if (!state) return [];
    const files = Array.from(state.dirtyFiles);
    state.dirtyFiles.clear();
    return files;
}

export function stopWatcher(workspaceId?: string) {
    if (workspaceId) {
        const state = watcherMap.get(workspaceId);
        if (state?.watcher) {
            void state.watcher.close();
        }
        if (state) {
            state.isWatching = false;
        }
        return;
    }

    for (const state of watcherMap.values()) {
        if (state.watcher) {
            void state.watcher.close();
        }
        state.isWatching = false;
    }
}
