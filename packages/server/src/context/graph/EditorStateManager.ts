/**
 * EditorStateManager - Gère l'état de l'éditeur (fichiers ouverts, curseur, etc.)
 */

import type { EditorState } from '@kletron/shared/context/graph';

export class EditorStateManager {
  private state: EditorState = {
    openFiles: [],
    recentEdits: [],
    visibleRanges: []
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

  setCursorPosition(file: string, position: { line: number; column: number }): void {
    // TODO: implémenter
  }

  addRecentEdit(path: string): void {
    const now = Date.now();
    this.state.recentEdits.push({ path, timestamp: now });
    
    // Garder seulement les 10 derniers edits
    if (this.state.recentEdits.length > 10) {
      this.state.recentEdits.shift();
    }
  }

  setVisibleRange(file: string, startLine: number, endLine: number): void {
    // TODO: implémenter
  }
}

export const editorStateManager = new EditorStateManager();
