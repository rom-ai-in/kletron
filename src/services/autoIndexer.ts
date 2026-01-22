import { EventEmitter } from "node:events";
import chokidar from "chokidar";

const formatterEmitter = new EventEmitter();
const dirtyFiles = new Set<string>();

let watcher: any = null;
let isWatching = false;

export function startWatcher(root: string) {
    if (isWatching) return;

    watcher = chokidar.watch(root, {
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
            dirtyFiles.add(path);
        }
    };

    watcher.on("add", handleFile);
    watcher.on("change", handleFile);
    watcher.on("unlink", handleFile);

    watcher.on("ready", () => {
        console.log(`[AutoIndex] Watcher ready on ${root}`);
        isWatching = true;
    });

    watcher.on("error", (error: Error) => {
        console.error(`[AutoIndex] Watcher error: ${error}`);
    });
}

export function getDirtyFiles(): string[] {
    const files = Array.from(dirtyFiles);
    dirtyFiles.clear();
    return files;
}

export function stopWatcher() {
    if (watcher) {
        void watcher.close();
        isWatching = false;
    }
}
