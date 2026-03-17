import { NextResponse } from "next/server";
import os from "node:os";
import path from "node:path";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";

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
    process.env.KLETRON_REPOS_DIR ||
    process.env.GITHUB_REPOS_DIR ||
    path.join(os.homedir(), "kletron-repos")
  );
}

export async function GET(request: Request) {
  const auth = await requireAppRouteAuth(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const reposRoot = getReposRoot();

  if (!token) {
    return NextResponse.json({
      repos: [],
      reposRoot,
      error: "GITHUB_TOKEN (or GH_TOKEN) is not configured on the server.",
    });
  }

  const { searchParams } = new URL(request.url);
  const perPageRaw = searchParams.get("perPage");
  const pageRaw = searchParams.get("page");
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
        "User-Agent": "kletron",
      },
    });

    if (!ghRes.ok) {
      const text = await ghRes.text();
      return NextResponse.json(
        {
          repos: [],
          reposRoot,
          error: `GitHub API error (${ghRes.status}): ${text.slice(0, 200)}`,
        },
        { status: ghRes.status }
      );
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

    return NextResponse.json({ repos, reposRoot });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        repos: [],
        reposRoot,
        error: (error as Error)?.message || "Failed to fetch GitHub repositories.",
      },
      { status: 500 }
    );
  }
}
