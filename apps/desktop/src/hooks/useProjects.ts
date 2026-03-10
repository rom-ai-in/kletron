import { useState, useEffect, useCallback, useRef } from "react";
import type { Project } from "../types";
import { normPath } from "../utils";

const PROJECTS_STORAGE_KEY = "numezis.desktop.projects";

/** Derive a human-friendly project name from a file path */
function projectNameFromPath(rootPath: string, fallbackName?: string | null): string {
  const parts = rootPath.split(/[\\/]/).filter(Boolean);
  const folderName = parts[parts.length - 1];
  if (folderName) return folderName;
  return fallbackName || "Project";
}

export function useProjects(workspacePath?: string | null, workspaceName?: string | null, backendUrl?: string, getAccessToken?: () => Promise<string | null>) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const storageLoadedRef = useRef(false);

  // Load from localStorage on mount — migrate stale names & deduplicate
  useEffect(() => {
    try {
      const stored = localStorage.getItem(PROJECTS_STORAGE_KEY);
      if (stored) {
        let parsed = JSON.parse(stored) as Project[];
        let dirty = false;

        // Fix any projects that got named with a generic backend label
        parsed = parsed.map((p) => {
          if (
            p.rootPath &&
            (p.name === "Imported Workspace" || p.name === "Workspace" || p.name === "Project")
          ) {
            const better = projectNameFromPath(p.rootPath);
            if (better !== p.name) {
              dirty = true;
              return { ...p, name: better };
            }
          }
          return p;
        });

        // Deduplicate by normalised rootPath — merge threads, keep the entry with
        // the most threads as the "base" (preserves its id/name/timestamps).
        const seen = new Map<string, Project>();
        for (const p of parsed) {
          const key = normPath(p.rootPath);
          if (!key) continue; // skip projects with no rootPath
          const existing = seen.get(key);
          if (!existing) {
            seen.set(key, p);
          } else {
            const mergedThreads = [...new Set([...existing.threads, ...p.threads])];
            const winner = p.threads.length > existing.threads.length ? p : existing;
            seen.set(key, { ...winner, threads: mergedThreads });
          }
        }
        const deduped = Array.from(seen.values());
        if (deduped.length !== parsed.length) dirty = true;
        parsed = deduped;

        if (dirty) persistProjects(parsed);
        setProjects(parsed);
        if (parsed.length > 0 && !activeProjectId) {
          setActiveProjectId(parsed[0].id);
        }
      }
    } catch {
      // ignore
    }
    storageLoadedRef.current = true;
  }, []);

  // Auto-create a default project from the current workspace.
  // Uses functional updater to read the LATEST state (avoids race with localStorage load).
  useEffect(() => {
    if (!workspacePath) return;
    // Wait for localStorage to finish loading before auto-creating
    if (!storageLoadedRef.current) return;

    const wp = normPath(workspacePath);

    setProjects((prev) => {
      const exists = prev.some((p) => normPath(p.rootPath) === wp);
      if (exists) {
        // Activate the matching project — but only if it's not already active
        const proj = prev.find((p) => normPath(p.rootPath) === wp);
        if (proj) {
          // Schedule setActiveProjectId for next tick to avoid setState-in-setState
          // Use functional form to only update if the value actually changed
          queueMicrotask(() => setActiveProjectId((current) => current === proj.id ? current : proj.id));
        }
        return prev; // no change
      }
      const newProject: Project = {
        id: crypto.randomUUID(),
        name: projectNameFromPath(workspacePath, workspaceName),
        rootPath: wp, // store normalised path
        threads: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const next = [...prev, newProject];
      persistProjects(next);
      queueMicrotask(() => setActiveProjectId(newProject.id));
      return next;
    });
  }, [workspacePath]); // eslint-disable-line react-hooks/exhaustive-deps

  function persistProjects(list: Project[]) {
    try {
      localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(list));
    } catch {
      // ignore
    }
  }

  const addProject = useCallback(
    (name: string, rootPath: string) => {
      const np = normPath(rootPath);
      if (!np) return null; // reject empty paths

      // Block duplicates — if a project with the same rootPath exists, just activate it
      const existing = projects.find((p) => normPath(p.rootPath) === np);
      if (existing) {
        setActiveProjectId(existing.id);
        return existing;
      }

      const newProject: Project = {
        id: crypto.randomUUID(),
        name,
        rootPath: np, // persist the normalised path
        threads: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      let added = false;
      setProjects((prev) => {
        // Double-check inside updater to avoid race conditions
        const dup = prev.find((p) => normPath(p.rootPath) === np);
        if (dup) {
          // Activate the existing duplicate instead (schedule for next tick)
          queueMicrotask(() => setActiveProjectId(dup.id));
          return prev;
        }
        added = true;
        const next = [...prev, newProject];
        persistProjects(next);
        return next;
      });

      // Only set active to the new project if it was actually added
      if (added) {
        setActiveProjectId(newProject.id);
      }
      return added ? newProject : null;
    },
    [projects]
  );

  const removeProject = useCallback(
    (projectId: string) => {
      setProjects((prev) => {
        const next = prev.filter((p) => p.id !== projectId);
        persistProjects(next);
        // If we removed the active project, switch to the first remaining one
        setActiveProjectId((currentActive) =>
          currentActive === projectId ? (next[0]?.id ?? null) : currentActive
        );
        return next;
      });
    },
    []
  );

  const assignThread = useCallback(
    (projectId: string, threadId: string) => {
      setProjects((prev) => {
        const next = prev.map((p) => {
          if (p.id === projectId && !p.threads.includes(threadId)) {
            return { ...p, threads: [...p.threads, threadId], updatedAt: new Date().toISOString() };
          }
          return p;
        });
        persistProjects(next);
        return next;
      });
    },
    []
  );

  const unassignThread = useCallback(
    (threadId: string) => {
      setProjects((prev) => {
        const next = prev.map((p) => ({
          ...p,
          threads: p.threads.filter((t) => t !== threadId),
        }));
        persistProjects(next);
        return next;
      });
    },
    []
  );

  // Fetch projects from backend and merge with localStorage
  const fetchProjectsFromBackend = useCallback(async () => {
    if (!backendUrl || !getAccessToken) return;

    try {
      const token = await getAccessToken();
      if (!token) return;

      const response = await fetch(`${backendUrl}/api/projects`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        // If backend doesn't have projects API or it fails, just continue with localStorage
        return;
      }

      const backendProjects: Array<{
        id: string;
        name: string;
        rootPath: string;
        threads?: string[];
      }> = await response.json();

      if (backendProjects.length === 0) return;

      // Merge backend projects with localStorage projects
      setProjects((prevLocalProjects) => {
        const merged = new Map<string, Project>();

        // Add all local projects first
        for (const local of prevLocalProjects) {
          merged.set(local.id, { ...local });
        }

        // Add/update with backend projects
        for (const backend of backendProjects) {
          const existing = prevLocalProjects.find((p) => p.rootPath === backend.rootPath);
          if (existing) {
            // Update local project with backend data if needed
            merged.set(existing.id, {
              ...existing,
              name: backend.name || existing.name,
              threads: backend.threads || existing.threads,
              updatedAt: new Date().toISOString(),
            });
          } else {
            // Add new project from backend
            const newProject: Project = {
              id: crypto.randomUUID(), // Generate local ID for backend projects
              name: backend.name,
              rootPath: normPath(backend.rootPath),
              threads: backend.threads || [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            merged.set(newProject.id, newProject);
          }
        }

        const result = Array.from(merged.values());
        persistProjects(result);

        // If we added new projects and no active project, set the first one
        if (result.length > 0 && !activeProjectId) {
          setActiveProjectId(result[0].id);
        }

        return result;
      });
    } catch (error) {
      console.error("Failed to fetch projects from backend:", error);
      // Continue with localStorage projects on error
    }
  }, [backendUrl, getAccessToken, activeProjectId]);

  // Periodically sync with backend
  useEffect(() => {
    if (!backendUrl || !getAccessToken) return;

    const interval = setInterval(() => {
      void fetchProjectsFromBackend();
    }, 30000); // Sync every 30 seconds

    return () => clearInterval(interval);
  }, [backendUrl, getAccessToken, fetchProjectsFromBackend]);

  // Initial sync when backend is ready
  useEffect(() => {
    if (backendUrl && getAccessToken) {
      const timer = setTimeout(() => {
        void fetchProjectsFromBackend();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [backendUrl, getAccessToken, fetchProjectsFromBackend]);

  const activeProject = projects.find((p) => p.id === activeProjectId) ?? null;

  return {
    projects,
    activeProjectId,
    activeProject,
    setActiveProjectId,
    addProject,
    removeProject,
    assignThread,
    unassignThread,
    refreshProjects: fetchProjectsFromBackend, // Expose for manual refresh
  };
}
