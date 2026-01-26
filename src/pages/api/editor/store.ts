// Basic in-memory store for the editor state
// In a real production app, this would be Redis.
// For the dev server, we use a global variable to survive HMR where possible,
// although API routes in Next.js Dev specificly might re-evaluate.
// We'll attach it to the global object.

import { EditorState } from "../../../types/editor";

const GLOBAL_KEY = '__NUMEZIS_EDITOR_STORE__';

const defaultState: EditorState = {
    openFiles: [],
    fileAgents: {},
    cursors: {},
    pendingDiffs: {},
    alerts: []
};

// @ts-ignore
if (!global[GLOBAL_KEY]) {
    // @ts-ignore
    global[GLOBAL_KEY] = defaultState;
}

// @ts-ignore
export const editorStore: EditorState = global[GLOBAL_KEY];

export const subscribers = new Set<(state: EditorState) => void>();

export function updateStore(updater: (prev: EditorState) => EditorState) {
    // @ts-ignore
    global[GLOBAL_KEY] = updater(global[GLOBAL_KEY]);
    // @ts-ignore
    const newState = global[GLOBAL_KEY];

    // Notify subscribers (SSE)
    subscribers.forEach(sub => sub(newState));
}
