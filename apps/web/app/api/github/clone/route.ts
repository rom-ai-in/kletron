import { NextResponse } from "next/server";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import simpleGit from "simple-git";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import { setActiveWorkspaceFromPath } from "@kletron/server/services/workspaceService";
import { McpClient } from "@kletron/mcp-client/client";

type CloneRequest = {
  repoUrl?: string;
  fullName?: string;
  branch?: string;
};

type ParsedRepo = {
  owner: string;
  repo: string;
  repoUrl: string;
};

function getReposRoot() {
  return (
    process.env.KLETRON_REPOS_DIR ||
    process.env.GITHUB_REPOS_DIR ||
    path.join(os.homedir(), "kletron-repos")
  );
}

function stripGitSuffix(value: string) {
  return value.replace(/\.git$/i, "");
}

function parseRepoInput(input?: string, fullName?: string): ParsedRepo | null {
  const candidate = (input || fullName || "").trim();
  if (!candidate) return null;
  const isSafe = (value: string) => /^[A-Za-z0-9_.-]+$/.test(value);

  const httpsMatch = candidate.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/i);
  if (httpsMatch) {
    const owner = httpsMatch[1];
    const repo = stripGitSuffix(httpsMatch[2]);
    if (!isSafe(owner) || !isSafe(repo)) return null;
    return {
      owner,
      repo,
      repoUrl: `https://github.com/${owner}/${repo}.git`,
    };
  }

  const sshMatch = candidate.match(/^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/i);
  if (sshMatch) {
    const owner = sshMatch[1];
    const repo = stripGitSuffix(sshMatch[2]);
    if (!isSafe(owner) || !isSafe(repo)) return null;
    return {
      owner,
      repo,
      repoUrl: `git@github.com:${owner}/${repo}.git`,
    };
  }

  const shortMatch = candidate.match(/^([^/]+)\/([^/]+)$/);
  if (shortMatch) {
    const owner = shortMatch[1];
    const repo = stripGitSuffix(shortMatch[2]);
    if (!isSafe(owner) || !isSafe(repo)) return null;
    return {
      owner,
      repo,
      repoUrl: `https://github.com/${owner}/${repo}.git`,
    };
  }

  return null;
}

function withToken(repoUrl: string) {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!token) return repoUrl;
  try {
    const url = new URL(repoUrl);
    if (url.username) return repoUrl;
    url.username = encodeURIComponent(token);
    return url.toString();
  } catch {
    return repoUrl;
  }
}

async function ensureRepoPath(repoPath: string) {
  if (!fs.existsSync(repoPath)) return false;
  const gitDir = path.join(repoPath, ".git");
  return fs.existsSync(gitDir) && fs.statSync(gitDir).isDirectory();
}

export async function POST(request: Request) {
  const auth = await requireAppRouteAuth(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({} as CloneRequest))) as CloneRequest;
  const parsed = parseRepoInput(body.repoUrl, body.fullName);
  if (!parsed) {
    return NextResponse.json(
      { error: "Invalid repo input. Provide a GitHub URL or owner/repo." },
      { status: 400 }
    );
  }

  const reposRoot = getReposRoot();
  const repoPath = path.join(reposRoot, parsed.owner, parsed.repo);
  const parentDir = path.dirname(repoPath);

  try {
    fs.mkdirSync(parentDir, { recursive: true });

    let status: "cloned" | "exists" = "cloned";
    const isGitRepo = await ensureRepoPath(repoPath);
    if (isGitRepo) {
      status = "exists";
    } else {
      if (fs.existsSync(repoPath)) {
        return NextResponse.json(
          { error: "Target path exists but is not a git repository." },
          { status: 400 }
        );
      }
      const git = simpleGit();
      const cloneArgs: string[] = [];
      if (body.branch) {
        cloneArgs.push("--branch", body.branch, "--single-branch");
      }
      await git.clone(withToken(parsed.repoUrl), repoPath, cloneArgs);
    }

    const workspace = await setActiveWorkspaceFromPath(auth.userId, repoPath, `${parsed.owner}/${parsed.repo}`);
    await McpClient.reloadInstance();

    return NextResponse.json({
      status,
      repoPath,
      workingFolder: workspace.rootPath,
      workspaceId: workspace._id?.toString() ?? null,
      reposRoot,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: (error as Error)?.message || "Failed to clone repository." },
      { status: 500 }
    );
  }
}
