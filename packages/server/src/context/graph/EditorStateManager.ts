/**
 * EditorStateManager - Gère l'état de l'éditeur (fichiers ouverts, curseur, etc.)
 */

import type { EditorState } from "@kletron/shared/context/graph";

export class EditorStateManager {
  private state: EditorState = {
    openFiles: [],
    recentEdits: [],
    visibleRanges: [],
  };

  getCurrentState(): EditorState {
    return this.state;
  }

  setActiveFile(filePath?: string): void {
    if (filePath) {
      this.state.activeFile = filePath;
    } else {
      delete this.state.activeFile;
    }
  }

  setOpenFiles(files: string[]): void {
    this.state.openFiles = files;
  }

  setCursorPosition(_file: string, _position: { line: number; column: number }): void {
    // Reserved for future use
  }

  addRecentEdit(path: string): void {
    const now = Date.now();
    this.state.recentEdits.push({ path, timestamp: now });

    if (this.state.recentEdits.length > 10) {
      this.state.recentEdits.shift();
    }
  }

  setVisibleRange(file: string, startLine: number, endLine: number): void {
    this.state.visibleRanges.push({ file, startLine, endLine });
    if (this.state.visibleRanges.length > 20) {
      this.state.visibleRanges.shift();
    }
  }
}

const managers = new Map<string, EditorStateManager>();

export function getEditorStateManager(workspaceId: string): EditorStateManager {
  let m = managers.get(workspaceId);
  if (!m) {
    m = new EditorStateManager();
    managers.set(workspaceId, m);
  }
  return m;
}

/** @deprecated Use getEditorStateManager(workspaceId) */
export const editorStateManager = new EditorStateManager();
