// src/pages/api/github/repos.ts
import type { NextApiRequest, NextApiResponse } from "next";
import os from "node:os";
import path from "node:path";
import { requirePagesRouteAuth } from "@/src/lib/auth/apiAuth";

type RepoSummary = {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  clone_url: string;
  ssh_url: string;
  default_branch: string;
  updated_at: string;
  owner: { login: string };
};

function getReposRoot() {
  return (
    process.env.NUMEZIS_REPOS_DIR ||
    process.env.GITHUB_REPOS_DIR ||
    path.join(os.homedir(), "numezis-repos")
  );
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requirePagesRouteAuth(req, res);
  if (!auth) return;

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
    return;
  }

  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const reposRoot = getReposRoot();

  if (!token) {
    res.status(200).json({
      repos: [],
      reposRoot,
      error: "GITHUB_TOKEN (or GH_TOKEN) is not configured on the server.",
    });
    return;
  }

  const perPageRaw = Array.isArray(req.query.perPage) ? req.query.perPage[0] : req.query.perPage;
  const pageRaw = Array.isArray(req.query.page) ? req.query.page[0] : req.query.page;
  const perPage = Math.min(Number(perPageRaw) || 100, 100);
  const page = Math.max(Number(pageRaw) || 1, 1);

  try {
    const url = new URL("https://api.github.com/user/repos");
    url.searchParams.set("per_page", String(perPage));
    url.searchParams.set("page", String(page));
    url.searchParams.set("sort", "updated");
    url.searchParams.set("affiliation", "owner,collaborator,organization_member");

    const ghRes = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "numezis-code",
      },
    });

    if (!ghRes.ok) {
      const text = await ghRes.text();
      res.status(ghRes.status).json({
        repos: [],
        reposRoot,
        error: `GitHub API error (${ghRes.status}): ${text.slice(0, 200)}`,
      });
      return;
    }

    const data = (await ghRes.json()) as RepoSummary[];
    const repos = Array.isArray(data)
      ? data.map((repo) => ({
        id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        private: repo.private,
        html_url: repo.html_url,
        clone_url: repo.clone_url,
        ssh_url: repo.ssh_url,
        default_branch: repo.default_branch,
        updated_at: repo.updated_at,
        owner: { login: repo.owner?.login ?? "" },
      }))
      : [];

    res.status(200).json({ repos, reposRoot });
  } catch (e: any) {
    res.status(500).json({
      repos: [],
      reposRoot,
      error: e?.message || "Failed to fetch GitHub repositories.",
    });
  }
}
