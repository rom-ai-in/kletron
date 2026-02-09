import { useEffect, useState } from "react";
import type { DiffRequest, WorkspaceInfo } from "../types";
import { applyHunksToContent, buildDiffRows, buildHunks } from "../utils";

export function useDiffs(workspace: WorkspaceInfo | null) {
  const [diffs, setDiffs] = useState<DiffRequest[]>([]);
  const [selectedDiffId, setSelectedDiffId] = useState<string | null>(null);
  const [selectedHunkId, setSelectedHunkId] = useState<string | null>(null);
  const [changesExpanded, setChangesExpanded] = useState(true);

  // Auto-select first diff
  useEffect(() => {
    if (diffs.length === 0) {
      setSelectedDiffId(null);
      return;
    }
    if (!selectedDiffId || !diffs.some((diff) => diff.editId === selectedDiffId)) {
      setSelectedDiffId(diffs[0].editId);
    }
  }, [diffs, selectedDiffId]);

  // Auto-select first hunk
  useEffect(() => {
    const diff = selectedDiffId
      ? diffs.find((entry) => entry.editId === selectedDiffId)
      : diffs[0];
    if (!diff || diff.hunks.length === 0) {
      setSelectedHunkId(null);
      return;
    }
    if (!selectedHunkId || !diff.hunks.some((hunk) => hunk.id === selectedHunkId)) {
      setSelectedHunkId(diff.hunks[0].id);
    }
  }, [diffs, selectedDiffId, selectedHunkId]);

  const selectedDiff = selectedDiffId
    ? diffs.find((diff) => diff.editId === selectedDiffId) ?? diffs[0]
    : diffs[0];
  const selectedHunk = selectedDiff?.hunks.find((hunk) => hunk.id === selectedHunkId) ?? selectedDiff?.hunks[0];
  const selectedRows = selectedHunk ? buildDiffRows(selectedHunk) : [];
  const diffTooLarge = selectedRows.length > 160;

  async function applyAllDiff(diffId: string) {
    const diff = diffs.find((d) => d.editId === diffId);
    if (!diff) return;
    if (!workspace) return;
    try {
      await window.numezis.applyFileChange(diff.filePath, diff.targetContent);
      setDiffs((prev) => prev.filter((d) => d.editId !== diffId));
    } catch {
      // ignore
    }
  }

  async function applyHunk(diffId: string, hunkId: string) {
    const diff = diffs.find((d) => d.editId === diffId);
    const hunk = diff?.hunks.find((h) => h.id === hunkId);
    if (!diff || !hunk) return;
    if (!workspace) return;

    const updatedBase = applyHunksToContent(diff.baseContent, [hunk]);
    try {
      await window.numezis.applyFileChange(diff.filePath, updatedBase);
    } catch {
      return;
    }

    const updated = {
      ...diff,
      baseContent: updatedBase,
      hunks: buildHunks(diff.editId, diff.filePath, updatedBase, diff.targetContent),
    };

    setDiffs((prev) => {
      if (updated.hunks.length === 0) return prev.filter((d) => d.editId !== diffId);
      return prev.map((d) => (d.editId === diffId ? updated : d));
    });
  }

  function rejectHunk(diffId: string, hunkId: string) {
    const diff = diffs.find((d) => d.editId === diffId);
    if (!diff) return;

    const remaining = diff.hunks.filter((h) => h.id !== hunkId);
    const updatedTarget = applyHunksToContent(diff.baseContent, remaining);
    const updated = {
      ...diff,
      targetContent: updatedTarget,
      hunks: buildHunks(diff.editId, diff.filePath, diff.baseContent, updatedTarget),
    };

    setDiffs((prev) => {
      if (updated.hunks.length === 0) return prev.filter((d) => d.editId !== diffId);
      return prev.map((d) => (d.editId === diffId ? updated : d));
    });
  }

  function rejectAllDiff(diffId: string) {
    setDiffs((prev) => prev.filter((d) => d.editId !== diffId));
  }

  function resetDiffs() {
    setDiffs([]);
  }

  return {
    diffs,
    setDiffs,
    selectedDiffId,
    setSelectedDiffId,
    selectedHunkId,
    setSelectedHunkId,
    changesExpanded,
    setChangesExpanded,
    selectedDiff,
    selectedHunk,
    selectedRows,
    diffTooLarge,
    applyAllDiff,
    applyHunk,
    rejectHunk,
    rejectAllDiff,
    resetDiffs,
  };
}
