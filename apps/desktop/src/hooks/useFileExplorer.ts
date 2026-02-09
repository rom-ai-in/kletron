import { useCallback, useEffect, useState } from "react";
import type { OpenFile } from "../types";
import { detectLanguage } from "../utils";

type FileEntry = { path: string; name: string; isDirectory: boolean };

export function useFileExplorer(workspacePath: string | null) {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Load root files on workspace change
  useEffect(() => {
    if (!workspacePath) {
      setFiles([]);
      setExpandedPaths(new Set());
      return;
    }
    void loadDirectory("");
  }, [workspacePath]);

  const loadDirectory = useCallback(async (relativePath: string) => {
    if (!workspacePath) return;
    try {
      setLoading(true);
      const entries = await window.numezis.listFiles(relativePath, 1);
      if (relativePath === "") {
        setFiles(entries);
      } else {
        // Merge children into existing file list
        setFiles((prev) => {
          const filtered = prev.filter(
            (f) => !f.path.startsWith(relativePath + "/") || f.path === relativePath
          );
          return [...filtered, ...entries.filter((e) => e.path !== relativePath)];
        });
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [workspacePath]);

  async function toggleDirectory(dirPath: string) {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(dirPath)) {
        next.delete(dirPath);
      } else {
        next.add(dirPath);
        void loadDirectory(dirPath);
      }
      return next;
    });
  }

  // Extensions that are always binary — never try to display as text
  const BINARY_EXTENSIONS = new Set([
    "db", "sqlite", "sqlite3",
    "png", "jpg", "jpeg", "gif", "webp", "ico", "bmp", "tiff", "svg",
    "woff", "woff2", "ttf", "otf", "eot",
    "zip", "tar", "gz", "bz2", "7z", "rar",
    "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
    "exe", "dll", "so", "dylib", "o", "a",
    "mp3", "mp4", "wav", "ogg", "flac", "avi", "mov", "mkv", "webm",
    "wasm", "class", "pyc", "pyo",
    "DS_Store",
  ]);

  function isBinaryFile(filename: string): boolean {
    // Check exact filename matches (e.g. ".DS_Store")
    const basename = filename.split("/").pop() || filename;
    if (BINARY_EXTENSIONS.has(basename)) return true;
    // Check extension
    const ext = basename.split(".").pop()?.toLowerCase() || "";
    return BINARY_EXTENSIONS.has(ext);
  }

  function looksLikeBinaryContent(content: string): boolean {
    // If a significant portion of the first 512 chars are non-printable, it's binary
    const sample = content.slice(0, 512);
    let nonPrintable = 0;
    for (let i = 0; i < sample.length; i++) {
      const code = sample.charCodeAt(i);
      if (code < 32 && code !== 9 && code !== 10 && code !== 13) {
        nonPrintable++;
      }
    }
    return sample.length > 0 && nonPrintable / sample.length > 0.1;
  }

  async function openFile(filePath: string) {
    // Check if already open
    const existing = openFiles.find((f) => f.path === filePath);
    if (existing) {
      setActiveFileId(filePath);
      return;
    }

    const filename = filePath.split("/").pop() || filePath;

    // Reject known binary files without even reading them
    if (isBinaryFile(filename)) {
      const newFile: OpenFile = {
        path: filePath,
        filename,
        content: "",
        originalContent: "",
        language: "binary",
      };
      setOpenFiles((prev) => [...prev, newFile]);
      setActiveFileId(filePath);
      return;
    }

    try {
      const content = await window.numezis.readFile(filePath);

      // Detect binary content that slipped through extension check
      if (looksLikeBinaryContent(content)) {
        const newFile: OpenFile = {
          path: filePath,
          filename,
          content: "",
          originalContent: "",
          language: "binary",
        };
        setOpenFiles((prev) => [...prev, newFile]);
        setActiveFileId(filePath);
        return;
      }

      const language = detectLanguage(filename);
      const newFile: OpenFile = {
        path: filePath,
        filename,
        content,
        originalContent: content,
        language,
      };
      setOpenFiles((prev) => [...prev, newFile]);
      setActiveFileId(filePath);
    } catch {
      // ignore
    }
  }

  function closeFile(filePath: string) {
    setOpenFiles((prev) => prev.filter((f) => f.path !== filePath));
    if (activeFileId === filePath) {
      setActiveFileId((prev) => {
        const remaining = openFiles.filter((f) => f.path !== filePath);
        return remaining.length > 0 ? remaining[remaining.length - 1].path : null;
      });
    }
  }

  function updateFileContent(filePath: string, content: string) {
    setOpenFiles((prev) =>
      prev.map((f) => (f.path === filePath ? { ...f, content } : f))
    );
  }

  async function saveFile(filePath: string) {
    const file = openFiles.find((f) => f.path === filePath);
    if (!file) return;
    try {
      await window.numezis.writeFile(filePath, file.content);
      setOpenFiles((prev) =>
        prev.map((f) => (f.path === filePath ? { ...f, originalContent: file.content } : f))
      );
    } catch {
      // ignore
    }
  }

  async function refreshFiles() {
    if (!workspacePath) return;
    await loadDirectory("");
  }

  function collapseAll() {
    setExpandedPaths(new Set());
  }

  const activeFile = openFiles.find((f) => f.path === activeFileId) ?? null;

  return {
    files,
    expandedPaths,
    selectedPath,
    setSelectedPath,
    openFiles,
    activeFileId,
    setActiveFileId,
    activeFile,
    loading,
    toggleDirectory,
    openFile,
    closeFile,
    updateFileContent,
    saveFile,
    refreshFiles,
    collapseAll,
  };
}
